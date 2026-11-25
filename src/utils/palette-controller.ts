/**
 * 全站配色预设（2026-11-25 从旧博客 old-Jojo-blog 的「色彩配置」移植）
 *
 * 旧博客的做法是往 <html> 上 setProperty 一堆 --color-* 内联变量；
 * 本站的色彩体系是 oklch 设计令牌（tokens/colors.css），所以分两条路：
 *
 *   1. **命名预设**（春暖 / 秋实 / 晴空 / 夜深）：
 *      纯 CSS 实现 —— `<html data-palette="spring">` 命中 colors.css 里的令牌组，
 *      无需 JS 参与渲染，首帧即生效。
 *   2. **随机配色**（旧博客的「随机配色」按钮）：
 *      没有固定的 CSS 块可命中，所以按随机色相现算一组变量，
 *      以**内联变量**写到 <html>（data-palette="random" 只作状态标记），
 *      选择与变量值都存 localStorage。
 *
 * 两条路共同遵守的约定：**只作用于亮色**。
 * 暗色主题（.dark）永远纯黑 —— 内联变量会盖过 :root.dark，所以在暗色下必须清掉，
 * 切回亮色再补回来。这也意味着「夜深」预设是在亮色档下呈现的深色皮肤，
 * 访问者再切真实暗色主题时仍是纯黑。
 */

export const PALETTE_STORAGE_KEY = "paletteStyle";
export const PALETTE_RANDOM_KEY = "paletteRandomVars";

export type PaletteId =
	| "default"
	| "spring"
	| "autumn"
	| "sky"
	| "night"
	| "random";

export interface PaletteOption {
	id: Exclude<PaletteId, "random">;
	label: string;
	/** 面板色点的两段色：左半 / 右半，取该套配色的主色与辅色 */
	swatch: [string, string];
}

export const PALETTE_OPTIONS: PaletteOption[] = [
	{ id: "default", label: "默认", swatch: ["#f4f6fc", "#1d2130"] },
	{ id: "spring", label: "春暖", swatch: ["#9ee7d1", "#eddd62"] },
	{ id: "autumn", label: "秋实", swatch: ["#de4331", "#fcc841"] },
	{ id: "sky", label: "晴空", swatch: ["#2fcbe7", "#8fdbe9"] },
	{ id: "night", label: "夜深", swatch: ["#0a051f", "#2a48f3"] },
];

const VALID_IDS: PaletteId[] = [
	"default",
	"spring",
	"autumn",
	"sky",
	"night",
	"random",
];

/** 随机配色可能写入的全部内联变量名 —— 清理时按这张表逐个 removeProperty */
const RANDOM_VAR_KEYS = [
	"--page-bg",
	"--primary",
	"--deep-text",
	"--title-active",
	"--border",
	"--line-color",
	"--line-divider",
	"--meta-divider",
	"--content-meta",
	"--btn-content",
	"--btn-plain-bg-hover",
	"--btn-plain-bg-active",
	"--btn-card-bg-hover",
	"--btn-card-bg-active",
	"--inline-code-bg",
	"--inline-code-color",
	"--selection-bg",
	"--codeblock-bg",
	"--codeblock-topbar-bg",
	"--license-block-bg",
	"--intro-surface-bg",
	"--link-underline",
	"--link-hover",
	"--link-active",
	"--navbar-bg",
	"--navbar-highlight-bg",
	"--navbar-highlight-text",
	"--float-panel-bg",
	"--toc-btn-hover",
	"--toc-btn-active",
	"--toc-item-active",
	"--ambient-warm",
	"--ambient-violet",
	"--ambient-mint",
	"--glass-card-bg",
	"--glass-card-border",
	"--glass-card-shadow",
	"--glass-card-inset",
	"--glass-wash-1",
	"--glass-wash-2",
	"--glass-wash-3",
	"--glass-base-1",
	"--glass-base-2",
	"--glass-base-3",
	"--glass-bubble-1",
	"--glass-bubble-2",
	"--glass-bubble-3",
	"--glass-bubble-4",
	"--glass-bubble-5",
	"--glass-bubble-6",
	"--tag-graph-surface",
	"--tag-graph-text",
	"--tag-graph-muted",
] as const;

/* ───────────────────────── 读写 ───────────────────────── */

export function getStoredPalette(): PaletteId {
	if (typeof localStorage === "undefined") return "default";
	try {
		const stored = localStorage.getItem(PALETTE_STORAGE_KEY);
		if (stored && (VALID_IDS as string[]).includes(stored)) {
			return stored as PaletteId;
		}
	} catch {
		/* 隐私模式：读不到就落默认 */
	}
	return "default";
}

function readRandomVars(): Record<string, string> | null {
	try {
		const raw = localStorage.getItem(PALETTE_RANDOM_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as Record<string, string>;
		return parsed && typeof parsed === "object" ? parsed : null;
	} catch {
		return null;
	}
}

function setInlineVars(vars: Record<string, string>): void {
	const root = document.documentElement;
	for (const [key, value] of Object.entries(vars)) {
		root.style.setProperty(key, value);
	}
}

export function clearInlineVars(): void {
	const root = document.documentElement;
	for (const key of RANDOM_VAR_KEYS) root.style.removeProperty(key);
}

/* ───────────────────── 随机配色生成 ───────────────────── */

/** hsl → hex：泡泡色最终喂给 canvas，必须是浏览器能直接解析的字面量 */
function hslToHex(h: number, s: number, l: number): string {
	const sat = s / 100;
	const lig = l / 100;
	const k = (n: number) => (n + h / 30) % 12;
	const a = sat * Math.min(lig, 1 - lig);
	const channel = (n: number) => {
		const value =
			lig - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
		return Math.round(255 * value)
			.toString(16)
			.padStart(2, "0");
	};
	return `#${channel(0)}${channel(8)}${channel(4)}`;
}

/**
 * 按随机色相现算一套配色。
 * 数值刻意与 colors.css 里四套预设的结构对齐（同样的明度/彩度台阶），
 * 保证不管随机到哪个色相，文字对比度与卡片通透感都在同一水平。
 */
function buildRandomPalette(): Record<string, string> {
	const h = Math.round(Math.random() * 360);
	const h2 = Math.round((h + 40 + Math.random() * 120) % 360);
	const oklch = (l: number, c: number, hue: number) =>
		`oklch(${l} ${c} ${hue})`;

	// 泡泡色：同色相家族 + 一点补色，明度高、彩度中等，模糊后不发灰
	const bubbles = [
		hslToHex(h, 72, 66),
		hslToHex((h + 30) % 360, 60, 78),
		hslToHex((h + 200) % 360, 55, 62),
		hslToHex((h + 15) % 360, 78, 60),
		hslToHex((h + 320) % 360, 60, 72),
		hslToHex(h, 72, 66),
	];

	return {
		"--page-bg": oklch(0.972, 0.016, h),
		"--primary": oklch(0.44, 0.09, h2),
		"--deep-text": oklch(0.21, 0.02, h),
		"--title-active": oklch(0.33, 0.05, h2),
		"--border": oklch(0.83, 0.024, h),
		"--line-color": oklch(0.88, 0.02, h),
		"--line-divider": oklch(0.88, 0.02, h),
		"--meta-divider": oklch(0.78, 0.022, h),
		"--content-meta": oklch(0.46, 0.024, h),
		"--btn-content": oklch(0.28, 0.024, h),
		"--btn-plain-bg-hover": oklch(0.94, 0.026, h),
		"--btn-plain-bg-active": oklch(0.905, 0.03, h),
		"--btn-card-bg-hover": oklch(0.95, 0.024, h),
		"--btn-card-bg-active": oklch(0.92, 0.028, h),
		"--inline-code-bg": oklch(0.945, 0.022, h),
		"--inline-code-color": oklch(0.25, 0.026, h),
		"--selection-bg": oklch(0.9, 0.045, h2),
		"--codeblock-bg": oklch(0.962, 0.012, h),
		"--codeblock-topbar-bg": oklch(0.935, 0.02, h),
		"--license-block-bg": oklch(0.962, 0.014, h),
		"--intro-surface-bg": oklch(0.955, 0.02, h),
		"--link-underline": oklch(0.86, 0.022, h),
		"--link-hover": oklch(0.5, 0.09, h2),
		"--link-active": oklch(0.32, 0.05, h2),
		"--navbar-bg": "rgba(255, 255, 255, 0.46)",
		"--navbar-highlight-bg": oklch(0.28, 0.07, h2),
		"--navbar-highlight-text": oklch(0.98, 0.008, h),
		"--float-panel-bg": "rgba(255, 255, 255, 0.62)",
		"--toc-btn-hover": oklch(0.94, 0.026, h),
		"--toc-btn-active": oklch(0.905, 0.03, h),
		"--toc-item-active": oklch(0.22, 0.06, h2),
		"--ambient-warm": oklch(0.85, 0.08, h2),
		"--ambient-violet": oklch(0.88, 0.05, (h + 120) % 360),
		"--ambient-mint": oklch(0.9, 0.05, (h + 240) % 360),
		"--glass-card-bg": "rgba(255, 255, 255, 0.44)",
		"--glass-card-border": "rgba(255, 255, 255, 0.62)",
		"--glass-card-shadow": "rgba(40, 52, 80, 0.2)",
		"--glass-card-inset": "rgba(255, 255, 255, 0.5)",
		"--glass-wash-1": `hsla(${h}, 70%, 70%, 0.28)`,
		"--glass-wash-2": `hsla(${h2}, 70%, 78%, 0.2)`,
		"--glass-wash-3": `hsla(${(h + 200) % 360}, 65%, 72%, 0.16)`,
		"--glass-base-1": oklch(0.974, 0.016, h),
		"--glass-base-2": oklch(0.966, 0.02, h2),
		"--glass-base-3": oklch(0.97, 0.018, (h + 120) % 360),
		"--glass-bubble-1": bubbles[0],
		"--glass-bubble-2": bubbles[1],
		"--glass-bubble-3": bubbles[2],
		"--glass-bubble-4": bubbles[3],
		"--glass-bubble-5": bubbles[4],
		"--glass-bubble-6": bubbles[5],
		"--tag-graph-surface": hslToHex(h, 25, 97),
		"--tag-graph-text": hslToHex(h, 20, 12),
		"--tag-graph-muted": hslToHex(h, 12, 38),
	};
}

/* ───────────────────────── 应用 ───────────────────────── */

function isDarkMode(): boolean {
	return document.documentElement.classList.contains("dark");
}

/** 把当前选择写进 DOM（不改 localStorage） */
function renderPalette(id: PaletteId): void {
	const root = document.documentElement;
	clearInlineVars();

	if (id === "random") {
		const vars = readRandomVars() ?? buildRandomPalette();
		if (isDarkMode()) {
			// 暗色下不铺随机内联变量（会盖掉纯黑令牌），但记号留着，切回亮色再补
			root.setAttribute("data-palette", "random");
			return;
		}
		setInlineVars(vars);
		root.setAttribute("data-palette", "random");
		return;
	}

	if (id === "default") root.removeAttribute("data-palette");
	else root.setAttribute("data-palette", id);
}

/** 访问者选色板：写 localStorage + 应用到 DOM + 广播 */
export function applyPalette(id: PaletteId): void {
	const next = (VALID_IDS as string[]).includes(id) ? id : "default";

	if (next === "random") {
		// 每次点「随机」都重新掷一次，选择与结果一起存
		const vars = buildRandomPalette();
		try {
			localStorage.setItem(PALETTE_RANDOM_KEY, JSON.stringify(vars));
		} catch {
			/* 存不进去只在本次生效 */
		}
		clearInlineVars();
		if (!isDarkMode()) setInlineVars(vars);
		document.documentElement.setAttribute("data-palette", "random");
	} else {
		try {
			localStorage.removeItem(PALETTE_RANDOM_KEY);
		} catch {
			/* ignore */
		}
		renderPalette(next);
	}

	try {
		localStorage.setItem(PALETTE_STORAGE_KEY, next);
	} catch {
		/* 隐私模式：本次生效，刷新回落默认 */
	}

	window.dispatchEvent(new CustomEvent("palette-change", { detail: next }));
}

/** 明暗主题切换时对齐：暗色清内联变量，亮色把随机配色补回来 */
function syncPaletteWithTheme(): void {
	if (isDarkMode()) {
		clearInlineVars();
		return;
	}
	if (getStoredPalette() === "random") {
		const vars = readRandomVars();
		if (vars) setInlineVars(vars);
	}
}

let initialized = false;

/** 初始化：只跑一次。首帧的 data-palette / 内联变量由 Layout.astro 的 head 脚本负责 */
export function initPalette(): void {
	if (initialized) return;
	initialized = true;

	document.addEventListener("theme-change", syncPaletteWithTheme);
	// 兜底：任何路径（含 View Transitions 快照）改动了 .dark 都对齐一次
	new MutationObserver(syncPaletteWithTheme).observe(document.documentElement, {
		attributes: true,
		attributeFilter: ["class"],
	});
}

/** 面板色点的选中态同步（供导航栏脚本调用） */
export function syncPaletteSwatches(
	container: ParentNode,
	selector = "[data-nav-tools-palette]",
): void {
	const current = getStoredPalette();
	container.querySelectorAll<HTMLElement>(selector).forEach((button) => {
		button.setAttribute(
			"aria-checked",
			String(button.dataset.navToolsPalette === current),
		);
	});
}
