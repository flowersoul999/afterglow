#!/usr/bin/env node

/**
 * 图片重命名脚本
 * 功能：
 * 1. 将 public/assets/images/sjtapi/ 文件夹中的图片重命名为数字形式（1.png, 2.png, ...）
 * 2. 自动更新 src/config/coverImageConfig.ts 配置文件
 *
 * 使用方法：
 *   node scripts/rename-images.mjs
 */

import { readdirSync, renameSync, writeFileSync, existsSync } from "fs";
import { join, extname } from "path";

const IMAGE_DIR = join(process.cwd(), "public/assets/images/sjtapi");
const CONFIG_FILE = join(process.cwd(), "src/config/coverImageConfig.ts");

// 支持的图片格式
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif"]);

function main() {
	// 检查目录是否存在
	if (!existsSync(IMAGE_DIR)) {
		console.error(`❌ 目录不存在: ${IMAGE_DIR}`);
		process.exit(1);
	}

	// 读取目录中的所有文件
	const files = readdirSync(IMAGE_DIR);

	// 筛选出图片文件并排序
	const imageFiles = files
		.filter((file) => {
			const ext = extname(file).toLowerCase();
			return IMAGE_EXTENSIONS.has(ext);
		})
		.sort((a, b) => {
			// 如果已经是数字名称，按数字排序
			const numA = parseInt(a, 10);
			const numB = parseInt(b, 10);
			if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
			if (!isNaN(numA)) return -1;
			if (!isNaN(numB)) return 1;
			// 否则按文件名排序
			return a.localeCompare(b);
		});

	console.log(`📁 找到 ${imageFiles.length} 个图片文件`);

	// 重命名文件为数字形式
	const renamedFiles = [];
	let counter = 1;

	for (const file of imageFiles) {
		const ext = extname(file).toLowerCase();
		const newName = `${counter}${ext}`;
		const oldPath = join(IMAGE_DIR, file);
		const newPath = join(IMAGE_DIR, newName);

		// 如果文件名已经是数字形式，跳过重命名
		if (file === newName) {
			console.log(`  ✓ ${file} (已命名)`);
		} else {
			renameSync(oldPath, newPath);
			console.log(`  ✗ ${file} → ${newName}`);
		}

		renamedFiles.push({ name: newName, path: `/assets/images/sjtapi/${newName}` });
		counter++;
	}

	// 生成配置文件内容
	const configContent = `import type { CoverImageConfig } from "../types/config";

/**
 * 文章封面图配置
 *
 * enableInPost - 是否在文章详情页显示封面图
 *
 * 随机封面图使用说明：
 * 1. 在文章的 Frontmatter 中添加 image: "api" 即可使用随机图功能
 * 2. 系统会依次尝试所有配置的 API，全部失败后使用备用图片
 *
 * // 文章 Frontmatter 示例：
 * ---
 * title: 文章标题
 * image: "api"
 * ---
 */
export const coverImageConfig: CoverImageConfig = {
	// 是否在文章详情页显示封面图
	enableInPost: false,

	randomCoverImage: {
		// 随机封面图功能开关
		enable: true,
		// 封面图API列表
		apis: [
${renamedFiles.map((f) => `\t\t\t"${f.path}",`).join("\n")}
		],
		// API失败时的回退图片路径（相对于src目录或以/开头的public目录路径）
		fallback: "assets/images/cover.avif",
		// 是否显示加载动画
		showLoading: false,
	},
};
`;

	// 写入配置文件
	writeFileSync(CONFIG_FILE, configContent, "utf-8");

	console.log(`\n✅ 配置文件已更新: ${CONFIG_FILE}`);
	console.log(`📊 共 ${renamedFiles.length} 张图片`);
}

main();
