#!/usr/bin/env node

/**
 * 从 Hao Wallpaper 导入壁纸脚本
 * 功能：
 * 1. 扫描 C:\Users\dumplingandcake\AppData\Roaming\Hao Wallpaper\WallpaperDownloads 中的所有子文件夹
 * 2. 复制每个子文件夹中的 wallpaper.png 到 public/assets/images/sjtapi/
 * 3. 重命名为数字形式并更新配置文件
 *
 * 使用方法：
 *   node scripts/import-wallpapers.mjs
 */

import { readdirSync, copyFileSync, existsSync, statSync } from "fs";
import { join, extname } from "path";
import { execSync } from "child_process";

const HAO_WALLPAPER_DIR = "C:/Users/dumplingandcake/AppData/Roaming/Hao Wallpaper/WallpaperDownloads";
const TARGET_DIR = join(process.cwd(), "public/assets/images/sjtapi");

function main() {
	// 检查源目录是否存在
	if (!existsSync(HAO_WALLPAPER_DIR)) {
		console.error(`❌ 源目录不存在: ${HAO_WALLPAPER_DIR}`);
		process.exit(1);
	}

	// 检查目标目录是否存在
	if (!existsSync(TARGET_DIR)) {
		console.error(`❌ 目标目录不存在: ${TARGET_DIR}`);
		process.exit(1);
	}

	// 读取源目录中的所有子文件夹
	const entries = readdirSync(HAO_WALLPAPER_DIR);
	let copiedCount = 0;

	console.log(`📁 扫描目录: ${HAO_WALLPAPER_DIR}`);
	console.log("");

	for (const entry of entries) {
		const entryPath = join(HAO_WALLPAPER_DIR, entry);

		// 检查是否是目录
		if (!statSync(entryPath).isDirectory()) continue;

		// 检查目录中是否有 wallpaper.png
		const wallpaperPath = join(entryPath, "wallpaper.png");
		if (!existsSync(wallpaperPath)) continue;

		// 复制文件（使用临时名称，稍后由 rename-images.mjs 统一重命名）
		const tempName = `wallpaper_import_${Date.now()}_${copiedCount}.png`;
		const targetPath = join(TARGET_DIR, tempName);

		copyFileSync(wallpaperPath, targetPath);
		console.log(`  ✓ ${entry}/wallpaper.png → ${tempName}`);
		copiedCount++;
	}

	console.log("");
	console.log(`📊 共复制 ${copiedCount} 张图片`);

	if (copiedCount === 0) {
		console.log("没有找到新的壁纸文件");
		return;
	}

	// 运行重命名脚本
	console.log("");
	console.log("🔄 正在重命名并更新配置...");
	try {
		execSync("node scripts/rename-images.mjs", { stdio: "inherit", cwd: process.cwd() });
	} catch (error) {
		console.error("❌ 重命名脚本执行失败");
		process.exit(1);
	}
}

main();
