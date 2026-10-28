#!/usr/bin/env node

/**
 * 动态图片迁入正文
 * ---------------------------------------------------------------------------
 * 把动态 md 里 frontmatter 的 `images:` 属性迁移成**正文 Markdown 图片语法**，
 * 目的是让 Obsidian 打开 md 时能直接看到图片（图片现在都在远端图床）。
 *
 * 迁移前：
 *   ---
 *   published: 2026-10-20 12:06:46
 *   images:
 *     - https://img.tsh520.cn/.../a.jpg
 *   ---
 *   用了半年了才知道…
 *
 * 迁移后：
 *   ---
 *   published: 2026-10-20 12:06:46
 *   ---
 *   用了半年了才知道…
 *
 *   ![](https://img.tsh520.cn/.../a.jpg)
 *
 * 用法:
 *   node scripts/动态图片迁入正文/index.mjs [--dry-run] [--force]
 *
 *   --dry-run  只预览不落盘
 *   --force    正文里已经有图片时也重跑（先把现有图片语法剔除再追加）
 *
 * 特性：
 *   - 幂等：正文已有图片、frontmatter 已无 images 的文件直接跳过
 *   - 保留每个文件原有的换行符（CRLF 的文件不会被改成 LF，反之亦然）
 *   - 视频 URL（.mp4 等）同样迁进正文，由渲染层按扩展名识别
 */

import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const force = args.includes("--force");
/** --sample=<文件路径片段>：打印该文件的迁移结果（用于落盘前核对格式） */
const sampleArg = args.find((arg) => arg.startsWith("--sample="));
const sample = sampleArg ? sampleArg.slice("--sample=".length) : "";

const MOMENTS_DIR = path.resolve(process.cwd(), "src", "content", "动态");

/** 与 src/utils/moment-media.ts 的 MEDIA_RE 保持一致（只用于剔除，不做提取） */
const MEDIA_RE =
	/!\[[^\]]*\]\(\s*<?[^)\s]+>?(?:\s+["'][^"']*["'])?\s*\)|<(?:img|video)\b[^>]*?\ssrc\s*=\s*["'][^"']+["'][^>]*>/gi;

function listMdFiles(dir) {
	const out = [];
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) out.push(...listMdFiles(full));
		else if (entry.name.toLowerCase().endsWith(".md")) out.push(full);
	}
	return out;
}

/** 去掉 YAML 标量的外层引号 */
function unquote(value) {
	const trimmed = value.trim();
	if (
		(trimmed.startsWith('"') && trimmed.endsWith('"')) ||
		(trimmed.startsWith("'") && trimmed.endsWith("'"))
	) {
		if (trimmed.length >= 2) return trimmed.slice(1, -1).trim();
	}
	return trimmed;
}

/** 行内数组：`[a, b]` → ["a", "b"] */
function parseInlineList(raw) {
	const inner = raw.trim().replace(/^\[/, "").replace(/\]$/, "");
	if (!inner.trim()) return [];
	return inner
		.split(",")
		.map(unquote)
		.filter(Boolean);
}

/** 从 frontmatter 行里摘出 images 块，返回 URL 列表 + 删掉该块后的剩余行 */
function extractImages(fmLines) {
	const urls = [];
	const rest = [];
	let inImages = false;

	for (const line of fmLines) {
		if (/^images\s*:/.test(line)) {
			const inline = (line.match(/^images\s*:\s*(.*)$/u)?.[1] ?? "").trim();
			if (inline) urls.push(...parseInlineList(inline));
			inImages = true;
			continue;
		}

		if (inImages) {
			if (line.trim() === "") continue;
			if (/^\s+-\s*/.test(line)) {
				urls.push(unquote(line.replace(/^\s+-\s*/u, "")));
				continue;
			}
			if (/^\S/.test(line)) {
				inImages = false; // images 块结束，落到下一行正常处理
			} else {
				continue; // 缩进的非列表行（多行标量延续），随块丢弃
			}
		}

		rest.push(line);
	}

	return { urls: urls.map(unquote).filter(Boolean), rest };
}

const toMarkdownImage = (url) =>
	/[\s()<>]/.test(url) ? `![](<${url}>)` : `![](${url})`;

function processFile(file) {
	const raw = fs.readFileSync(file, "utf8");
	const eol = raw.includes("\r\n") ? "\r\n" : "\n";

	// 统一成 LF 处理，写回时再按原换行拼接
	const lines = raw.replace(/\r\n/gu, "\n").split("\n");
	if (lines[0]?.trim() !== "---") return { skipped: "无 frontmatter" };

	const fmEnd = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
	if (fmEnd < 0) return { skipped: "frontmatter 未闭合" };

	const fmLines = lines.slice(1, fmEnd);
	const bodyLines = lines.slice(fmEnd + 1);
	const { urls, rest: newFmLines } = extractImages(fmLines);

	const body = bodyLines.join("\n");
	const strippedBody = body.replace(MEDIA_RE, " ").replace(/[ \t]+$/gmu, "");
	const existingInBody = (body.match(MEDIA_RE) ?? []).length;

	if (urls.length === 0) {
		if (existingInBody > 0) return { skipped: "已迁移（正文已有图片）" };
		if (!force) return { skipped: "无图片" };
	}

	if (existingInBody > 0 && !force) {
		return { skipped: "正文已有图片，跳过（需覆盖用 --force）" };
	}

	const trimmedBody = strippedBody.trim();
	const imageBlock = urls.map(toMarkdownImage).join(eol);
	const newBody = trimmedBody
		? `${trimmedBody}${eol}${eol}${imageBlock}${eol}`
		: `${imageBlock}${eol}`;

	const next =
		["---", ...newFmLines, "---", ""].join(eol) + eol + newBody;

	if (!dryRun) fs.writeFileSync(file, next, "utf8");
	return { urls, eol, next };
}

const files = listMdFiles(MOMENTS_DIR);
let migrated = 0;
let skipped = 0;
let imageCount = 0;
const skippedReasons = new Map();

console.log(`扫描到 ${files.length} 个动态文件\n`);

for (const file of files) {
	const result = processFile(file);
	const rel = path.relative(process.cwd(), file);

	if (result.skipped) {
		skipped++;
		skippedReasons.set(result.skipped, (skippedReasons.get(result.skipped) ?? 0) + 1);
		continue;
	}

	migrated++;
	imageCount += result.urls.length;
	if (dryRun) console.log(`[预览] ${rel} — ${result.urls.length} 张`);
	if (sample && rel.includes(sample)) {
		console.log(`\n----- ${rel} 迁移结果 -----\n${result.next}----------\n`);
	}
}

console.log(
	`\n${dryRun ? "预览完成（未落盘）" : "迁移完成"}：迁移 ${migrated} 个文件 / ${imageCount} 个媒体；跳过 ${skipped} 个`,
);
for (const [reason, count] of skippedReasons) {
	console.log(`  - ${reason}: ${count}`);
}
if (dryRun && migrated > 0) {
	console.log("\n确认无误后去掉 --dry-run 再跑一次即可落盘。");
}
