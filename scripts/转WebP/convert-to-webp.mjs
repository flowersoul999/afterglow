#!/usr/bin/env node
/**
 * 图片批量转 WebP 脚本
 * 用法：node convert-to-webp.mjs <图片文件夹路径>
 *
 * 功能：
 * 1. 将 jpg/png/jpeg/avif/gif 等转为 WebP 格式
 * 2. 压缩至适合网站的大小（最大宽度 1920px，quality 80）
 * 3. 重命名为 1.webp, 2.webp, 3.webp ...（已有文件不会重名）
 * 4. 已符合规范的 WebP 文件（≤500KB）跳过不处理，保留原名
 */

import { readdir, stat, rename, unlink, mkdir, rm } from "node:fs/promises";
import { join, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const MAX_WIDTH = 1920;
const QUALITY = 80;
const MAX_SIZE_KB = 500; // 超过此大小的 WebP 也会重新压缩

async function convertToWebp(folderPath) {
	const absPath = resolve(process.cwd(), folderPath);

	let files;
	try {
		files = await readdir(absPath);
	} catch {
		console.error(`❌ 文件夹不存在: ${absPath}`);
		process.exit(1);
	}

	const imageExts = new Set([".jpg", ".jpeg", ".png", ".avif", ".gif", ".webp", ".bmp", ".tiff"]);
	const images = files.filter((f) => {
		const ext = extname(f).toLowerCase();
		return imageExts.has(ext) && !f.startsWith(".");
	});

	if (images.length === 0) {
		console.log("📭 文件夹中没有图片文件");
		return;
	}

	console.log(`📁 找到 ${images.length} 张图片\n`);

	// 临时目录
	const tmpDir = join(absPath, ".tmp_convert");
	await mkdir(tmpDir, { recursive: true });

	// 找出已有数字命名的最大编号
	const existingNums = files
		.filter((f) => /^\d+\.webp$/i.test(f))
		.map((f) => parseInt(f.replace(/\.webp$/i, ""), 10));
	let counter = existingNums.length > 0 ? Math.max(...existingNums) : 0;

	const toKeep = [];
	const converted = [];

	for (const file of images) {
		const filePath = join(absPath, file);
		const fileStat = await stat(filePath);
		const ext = extname(file).toLowerCase();
		const sizeKB = fileStat.size / 1024;

		// 已经是 WebP 且大小合理，跳过
		if (ext === ".webp" && sizeKB <= MAX_SIZE_KB) {
			toKeep.push(file);
			console.log(`⏭️  ${file} (${formatSize(sizeKB)}) — 已符合规范，保留`);
			continue;
		}

		// 需要转换
		counter++;
		const newName = `${counter}.webp`;
		const tmpPath = join(tmpDir, newName);

		try {
			await sharp(filePath)
				.resize({ width: MAX_WIDTH, withoutEnlargement: true })
				.webp({ quality: QUALITY })
				.toFile(tmpPath);

			const newStat = await stat(tmpPath);
			const newSizeKB = newStat.size / 1024;
			const savings = sizeKB > 0 ? ((1 - newSizeKB / sizeKB) * 100).toFixed(0) : 0;

			console.log(
				`✅ ${file} → ${newName}  (${formatSize(sizeKB)} → ${formatSize(newSizeKB)}${savings > 0 ? `, -${savings}%` : ""})`,
			);
			converted.push({ file, newName });
		} catch (err) {
			console.error(`❌ 处理失败: ${file} — ${err.message}`);
			counter--; // 失败回退计数
		}
	}

	// 删除原始文件（保留符合条件的）
	const keepSet = new Set(toKeep);
	for (const file of images) {
		if (keepSet.has(file)) continue;
		const filePath = join(absPath, file);
		try {
			await unlink(filePath);
		} catch {
			// 可能已被删除
		}
	}

	// 移出临时文件
	const tmpFiles = await readdir(tmpDir);
	for (const tmpFile of tmpFiles) {
		const src = join(tmpDir, tmpFile);
		const dst = join(absPath, tmpFile);
		try {
			await rename(src, dst);
		} catch (err) {
			console.error(`❌ 移动失败: ${tmpFile} — ${err.message}`);
		}
	}

	// 清理
	await rm(tmpDir, { recursive: true, force: true });

	const keepCount = toKeep.length;
	const convertCount = converted.length;
	console.log(`\n📊 完成！`);
	if (keepCount > 0) console.log(`   保留原文件: ${keepCount} 个`);
	if (convertCount > 0) console.log(`   转换为 WebP: ${convertCount} 个`);
	console.log(`   共计: ${keepCount + convertCount} 个`);
}

function formatSize(kb) {
	if (kb < 1024) return `${kb.toFixed(0)}KB`;
	return `${(kb / 1024).toFixed(1)}MB`;
}

// 入口
const folderPath = process.argv[2];
if (!folderPath) {
	console.log("用法：node scripts/convert-to-webp/convert-to-webp.mjs <图片文件夹路径>");
	console.log("示例：node scripts/convert-to-webp/convert-to-webp.mjs scripts/convert-to-webp/图片");
	process.exit(1);
}

convertToWebp(folderPath).catch((err) => {
	console.error("❌ 脚本执行失败:", err.message);
	process.exit(1);
});