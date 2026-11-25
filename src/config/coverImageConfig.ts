import type { CoverImageConfig } from "../types/config";

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
		// 2026-11-25：摘除了 29 张黑白原稿图（原编号 2/3/4/6/7/9/10/11/13/15/18/19/20/21/
		// 23/24/26/27/28/29/31/32/39/40/51/52/53/57/61），归档在项目根 _archive/covers-bw/，
		// 随机池只留彩色图 —— 站长反馈「列表封面老是抽到黑白图」
		apis: [
			"/assets/images/covers/1.webp",
			"/assets/images/covers/5.webp",
			"/assets/images/covers/8.webp",
			"/assets/images/covers/12.webp",
			"/assets/images/covers/14.webp",
			"/assets/images/covers/16.webp",
			"/assets/images/covers/17.webp",
			"/assets/images/covers/22.webp",
			"/assets/images/covers/25.png",
			"/assets/images/covers/30.webp",
			"/assets/images/covers/33.png",
			"/assets/images/covers/34.webp",
			"/assets/images/covers/35.webp",
			"/assets/images/covers/36.webp",
			"/assets/images/covers/37.webp",
			"/assets/images/covers/38.png",
			"/assets/images/covers/41.webp",
			"/assets/images/covers/42.webp",
			"/assets/images/covers/43.webp",
			"/assets/images/covers/44.webp",
			"/assets/images/covers/45.webp",
			"/assets/images/covers/46.webp",
			"/assets/images/covers/47.webp",
			"/assets/images/covers/48.webp",
			"/assets/images/covers/49.png",
			"/assets/images/covers/50.webp",
			"/assets/images/covers/54.png",
			"/assets/images/covers/55.png",
			"/assets/images/covers/56.webp",
			"/assets/images/covers/58.webp",
			"/assets/images/covers/59.webp",
			"/assets/images/covers/60.webp",
			"/assets/images/covers/62.webp",
		],
		// API失败时的回退图片路径（相对于src目录或以/开头的public目录路径）
		fallback: "assets/images/cover.avif",
		// 是否显示加载动画
		showLoading: false,
	},
};
