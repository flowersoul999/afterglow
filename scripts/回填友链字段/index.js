/* 一次性脚本：为 src/content/友链/*.md 回填 added（git 首次添加日期）与 group: friend
   已存在对应字段的文件自动跳过，幂等可重跑。
   注意：added 写裸日期（如 2026-08-12），Astro 解析为 Date 才能通过 z.date() 校验，
   因此用行级文本插入，不走 gray-matter 重序列化，避免格式噪音。 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const FRIENDS_DIR = path.join(import.meta.dirname, "../../src/content/友链");

// 取文件的首次添加日期（YYYY-MM-DD），失败返回 null
function getFirstAddDate(filePath) {
	const rel = path
		.relative(process.cwd(), filePath)
		.split(path.sep)
		.join("/");
	// 首选 --follow（跟进重命名）；取输出最后一行 = 最老的提交 = 首次添加
	const attempts = [
		["git", ["log", "--follow", "--diff-filter=A", "--format=%ad", "--date=short", "--", rel]],
		["git", ["log", "--format=%ad", "--date=short", "--", rel]],
	];
	for (const [cmd, args] of attempts) {
		try {
			const out = execFileSync(cmd, args, {
				encoding: "utf8",
				stdio: ["ignore", "pipe", "ignore"],
			});
			const lines = out.split("\n").filter(Boolean);
			if (lines.length > 0) return lines[lines.length - 1].trim();
		} catch {
			/* 该命令失败则尝试 fallback */
		}
	}
	return null;
}

const files = fs
	.readdirSync(FRIENDS_DIR)
	.filter((f) => f.endsWith(".md"))
	.sort();
const ok = [];
const skipped = [];
const failed = [];

for (const file of files) {
	const filePath = path.join(FRIENDS_DIR, file);
	const raw = fs.readFileSync(filePath, "utf8");
	const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	if (!m) {
		failed.push(`${file}（无 frontmatter）`);
		continue;
	}

	const fm = m[1];
	const hasAdded = /^added:/m.test(fm);
	const hasGroup = /^group:/m.test(fm);

	if (hasAdded && hasGroup) {
		skipped.push(file);
		continue;
	}

	// 保持原文件行尾风格（AstrBot 发布的文件是 CRLF）
	const eol = raw.includes("\r\n") ? "\r\n" : "\n";

	if (!hasAdded) {
		const date = getFirstAddDate(filePath);
		if (!date) {
			failed.push(`${file}（git 取不到日期）`);
			continue;
		}
		const lines = [`added: ${date}`];
		if (!hasGroup) lines.push("group: friend");
		const updated = raw.replace(
			m[0],
			`---${eol}${fm}${eol}${lines.join(eol)}${eol}---`,
		);
		fs.writeFileSync(filePath, updated);
		ok.push(file);
	} else {
		// 只有 group 缺失
		const updated = raw.replace(m[0], `---${eol}${fm}${eol}group: friend${eol}---`);
		fs.writeFileSync(filePath, updated);
		ok.push(file);
	}
}

console.log(`✅ 已回填 ${ok.length} 个：\n  ${ok.join("\n  ")}`);
if (skipped.length) console.log(`⏭  已跳过（字段齐全）${skipped.length} 个：\n  ${skipped.join("\n  ")}`);
if (failed.length) {
	console.error(`❌ 失败 ${failed.length} 个（需手动处理）：\n  ${failed.join("\n  ")}`);
	process.exit(1);
}
