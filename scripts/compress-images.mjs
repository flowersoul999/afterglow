#!/usr/bin/env node

/**
 * 批量压缩图片脚本
 * 支持压缩多个目录下的图片
 *
 * 使用方法：
 *   node scripts/compress-images.mjs              # 压缩所有目录
 *   node scripts/compress-images.mjs --dir=sjtapi  # 只压缩指定目录
 *   node scripts/compress-images.mjs --quality=85  # 自定义质量
 *   node scripts/compress-images.mjs --dry-run     # 仅预览
 *   node scripts/compress-images.mjs --min=1024    # 最小文件大小 (KB)
 */

import sharp from "sharp";
import { readdirSync, statSync, unlinkSync, existsSync } from "fs";
import { join, extname, basename } from "path";

const BASE_DIR = join(process.cwd(), "public/assets/images");
const QUALITY = parseInt(process.argv.find(a => a.startsWith("--quality="))?.split("=")[1] || "80");
const DRY_RUN = process.argv.includes("--dry-run");
const MIN_SIZE_KB = parseInt(process.argv.find(a => a.startsWith("--min="))?.split("=")[1] || "500");
const DIR_FILTER = process.argv.find(a => a.startsWith("--dir="))?.split("=")[1];

// 要压缩的目录列表
const IMAGE_DIRS = [
	{ name: "sjtapi", path: join(BASE_DIR, "sjtapi"), recursive: false },
	{ name: "mobile-bg", path: join(BASE_DIR, "mobile-bg"), recursive: false },
	{ name: "home", path: join(BASE_DIR, "home"), recursive: true },
];

// 支持的图片格式
const COMPRESS_FORMATS = new Set([".png", ".jpg", ".jpeg", ".bmp", ".tiff"]);
const RECOMPRESS_FORMATS = new Set([".webp"]); // 已经是 webp 的也可以重新压缩

async function compressImage(inputPath, outputPath, isWebp) {
	if (isWebp && inputPath === outputPath) {
		// 已经是 webp 且路径相同，使用临时文件
		const tempPath = outputPath + ".tmp";
		const info = await sharp(inputPath)
			.webp({ quality: QUALITY })
			.toFile(tempPath);
		// 替换原文件
		const { renameSync } = await import("fs");
		renameSync(tempPath, outputPath);
		return info;
	}
	// 其他格式转 webp
	return await sharp(inputPath)
		.webp({ quality: QUALITY })
		.toFile(outputPath);
}

async function processDir(dirConfig) {
	const { name, path: dirPath, recursive } = dirConfig;

	if (!existsSync(dirPath)) {
		console.log(`⚠️  目录不存在: ${name}`);
		return { processed: 0, skipped: 0, originalSize: 0, compressedSize: 0 };
	}

	console.log(`\n📁 ${name}/`);
	console.log("─".repeat(40));

	let totalOriginalSize = 0;
	let totalCompressedSize = 0;
	let processed = 0;
	let skipped = 0;

	async function processFiles(dir, prefix = "") {
		const entries = readdirSync(dir, { withFileTypes: true });

		for (const entry of entries) {
			const fullPath = join(dir, entry.name);

			if (entry.isDirectory() && recursive) {
				await processFiles(fullPath, `${prefix}${entry.name}/`);
				continue;
			}

			if (!entry.isFile()) continue;

			const ext = extname(entry.name).toLowerCase();
			const isCompressFormat = COMPRESS_FORMATS.has(ext);
			const isRecompressFormat = RECOMPRESS_FORMATS.has(ext);

			if (!isCompressFormat && !isRecompressFormat) continue;

			// 跳过测试文件
			if (entry.name.includes("-test")) continue;

			const stats = statSync(fullPath);
			const originalSize = stats.size;

			// 跳过小于阈值的文件
			if (originalSize < MIN_SIZE_KB * 1024) {
				console.log(`⏭️  跳过 ${prefix}${entry.name} (${(originalSize / 1024).toFixed(0)}KB < ${MIN_SIZE_KB}KB)`);
				skipped++;
				continue;
			}

			const nameWithoutExt = basename(entry.name, ext);
			const outputPath = join(dir, `${nameWithoutExt}.webp`);

			if (DRY_RUN) {
				console.log(`📋 [预览] ${prefix}${entry.name} (${(originalSize / 1024 / 1024).toFixed(2)}MB) → ${nameWithoutExt}.webp`);
				totalOriginalSize += originalSize;
				processed++;
				continue;
			}

			try {
				const info = await compressImage(fullPath, outputPath, isRecompressFormat);
				const compressedSize = info.size;
				const ratio = ((1 - compressedSize / originalSize) * 100).toFixed(1);

				console.log(`✅ ${prefix}${entry.name} (${(originalSize / 1024 / 1024).toFixed(2)}MB) → ${nameWithoutExt}.webp (${(compressedSize / 1024 / 1024).toFixed(2)}MB, -${ratio}%)`);

				// 删除原文件（仅当文件名不同时）
				if (fullPath !== outputPath && existsSync(fullPath)) {
					unlinkSync(fullPath);
				}

				totalOriginalSize += originalSize;
				totalCompressedSize += compressedSize;
				processed++;
			} catch (err) {
				console.error(`❌ ${prefix}${entry.name} 压缩失败:`, err.message);
			}
		}
	}

	await processFiles(dirPath);

	return { processed, skipped, originalSize: totalOriginalSize, compressedSize: totalCompressedSize };
}

async function main() {
	console.log(`🎯 压缩质量: ${QUALITY}%`);
	console.log(`📏 最小文件: ${MIN_SIZE_KB}KB`);
	console.log(`🔍 模式: ${DRY_RUN ? "预览" : "执行"}`);

	let totalProcessed = 0;
	let totalSkipped = 0;
	let totalOriginalSize = 0;
	let totalCompressedSize = 0;

	for (const dirConfig of IMAGE_DIRS) {
		if (DIR_FILTER && dirConfig.name !== DIR_FILTER) continue;

		const result = await processDir(dirConfig);
		totalProcessed += result.processed;
		totalSkipped += result.skipped;
		totalOriginalSize += result.originalSize;
		totalCompressedSize += result.compressedSize;
	}

	console.log("");
	console.log("═".repeat(50));

	if (DRY_RUN) {
		console.log(`📋 预览完成: ${totalProcessed} 张图片待压缩, ${totalSkipped} 张跳过`);
		console.log(`📊 当前总大小: ${(totalOriginalSize / 1024 / 1024).toFixed(2)} MB`);
		console.log(`💡 去掉 --dry-run 参数执行实际压缩`);
	} else {
		console.log(`✅ 压缩完成: ${totalProcessed} 张已压缩, ${totalSkipped} 张跳过`);
		if (totalProcessed > 0) {
			console.log(`📊 原始总大小: ${(totalOriginalSize / 1024 / 1024).toFixed(2)} MB`);
			console.log(`📊 压缩后大小: ${(totalCompressedSize / 1024 / 1024).toFixed(2)} MB`);
			console.log(`📊 节省空间: ${((1 - totalCompressedSize / totalOriginalSize) * 100).toFixed(1)}%`);
		}
	}
}

main().catch(console.error);
