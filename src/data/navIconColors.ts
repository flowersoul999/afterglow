/**
 * 网站导航（/projects/）卡片图标配色
 *
 * 站点 logo 走 astro-icon 的 `simple-icons:*` 单色路径，默认继承
 * `.nav-card__icon { color: var(--deep-text) }` —— 在黑白主题下整屏图标
 * 全被染成墨色，看着像一屏黑白图。这里按 Simple Icons 官方品牌色给每个
 * slug 配一个颜色，再算一份暗色主题专用的提亮版（黑底上深品牌色会糊掉），
 * 由 projects.astro 以 CSS 变量写到卡片上，图标本身就恢复成彩色。
 *
 * 数据源：simple-icons 官方 `_data/simple-icons.json`（2026-11-25 快照）。
 * 官方已移除 / 改名的 7 个（vuedotjs、visualstudiocode、qwen、nodedotjs、
 * moonshotai、deepseek、cursor）按各品牌公开主色手写补齐。
 */

/** Simple Icons slug（不含 `simple-icons:` 前缀）→ 官方品牌色 */
export const SIMPLE_ICON_COLORS: Record<string, string> = {
	github: "#181717",
	zhihu: "#0084FF",
	vuedotjs: "#4FC08D",
	vite: "#646CFF",
	visualstudiocode: "#007ACC",
	vercel: "#000000",
	typescript: "#3178C6",
	tailwindcss: "#06B6D4",
	svelte: "#FF3E00",
	supabase: "#3FCF8E",
	stackoverflow: "#F58025",
	qwen: "#615CED",
	postman: "#FF6C37",
	pnpm: "#F69220",
	perplexity: "#1FB8CD",
	openai: "#412991",
	npm: "#CB3837",
	nodedotjs: "#5FA04E",
	netlify: "#00C7B7",
	moonshotai: "#3B6CFF",
	mdnwebdocs: "#000000",
	leetcode: "#FFA116",
	juejin: "#007FFF",
	jsdelivr: "#E84D3D",
	iconify: "#1769AA",
	huggingface: "#FFD21E",
	greasyfork: "#670000",
	googlegemini: "#8E75B2",
	googlefonts: "#4285F4",
	freecodecamp: "#0A0A23",
	fontawesome: "#538DD7",
	dribbble: "#EA4C89",
	docker: "#2496ED",
	deepseek: "#4D6BFE",
	cursor: "#000000",
	csdn: "#FC5531",
	cloudflare: "#F38020",
	claude: "#D97757",
	bytedance: "#3C8CFF",
	bilibili: "#00A1D6",
	astro: "#BC52EE",
};

/**
 * 分类色：给没有品牌 logo、只能用 material-symbols 通用图标的站点用。
 * key 与 projects.astro 的 CATEGORY_META 一致（按文件夹名取）。
 */
export const CATEGORY_ICON_COLORS: Record<string, string> = {
	我的网站: "#E8792B",
	常用网站: "#3B82F6",
	在用网站: "#3B82F6",
	工具网站: "#0D9488",
	开发者工具: "#2563EB",
	开发者服务平台: "#0EA5E9",
	AI: "#8B5CF6",
	"AI 工具": "#8B5CF6",
	学习网站: "#F59E0B",
	文档: "#6366F1",
	设计资源: "#EC4899",
	实用项目: "#10B981",
	API: "#0D9488",
	资源网站: "#D97706",
	影视网站: "#EF4444",
	其他网站: "#64748B",
	未分类: "#64748B",
};

export interface NavIconColor {
	/** 亮色主题（白底）用：过亮的颜色压暗一点，免得糊在白卡片里 */
	light: string;
	/** 暗色主题（黑底）用：过暗的颜色往白色方向提亮，保证看得见 */
	dark: string;
}

/** 按感知亮度把颜色往白 / 黑方向混一档，色相与饱和度尽量保留 */
function tune(hex: string, dark: boolean): string {
	const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
	if (!m) return hex;
	const n = Number.parseInt(m[1], 16);
	let r = (n >> 16) & 255;
	let g = (n >> 8) & 255;
	let b = n & 255;
	const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

	let t = 0;
	if (dark && lum < 0.6) t = (0.6 - lum) / (1 - lum);
	else if (!dark && lum > 0.82) t = (lum - 0.82) / lum;

	if (t > 0) {
		const target = dark ? 255 : 0;
		r = Math.round(r + (target - r) * t);
		g = Math.round(g + (target - g) * t);
		b = Math.round(b + (target - b) * t);
	}
	return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/** 取某个站点图标在该分类下的亮 / 暗两版颜色 */
export function navIconColor(
	icon: string | undefined,
	category: string,
): NavIconColor {
	const prefix = "simple-icons:";
	const slug = icon?.startsWith(prefix) ? icon.slice(prefix.length) : "";
	const base =
		(slug && SIMPLE_ICON_COLORS[slug]) ||
		CATEGORY_ICON_COLORS[category] ||
		"#64748B";
	return { light: tune(base, false), dark: tune(base, true) };
}
