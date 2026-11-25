export const PAGE_SIZE = 8;

export const LIGHT_MODE = "light",
	DARK_MODE = "dark",
	SYSTEM_MODE = "system";
export const DEFAULT_THEME = LIGHT_MODE; // 仅作为向后兼容的默认值，实际使用 siteConfig.themeColor.defaultMode

/**
 * 页面背景风格（2026-11-24）
 * - `classic`：本站沿用了很久的黑白极简 —— 亮色纯白、暗色纯黑，灰阶全部零色度
 * - `warm`：暖纸 —— 亮色奶油米白 + 三团淡柔光，暗色仍是纯黑（站长要求暗色不动）
 *
 * 两者通过 `<html data-backdrop="...">` 切换，只影响亮色主题的令牌；
 * 暗色的 `:root.dark` 两套共用，切到 warm 不会有任何变化。
 */
export const BACKDROP_CLASSIC = "classic",
	BACKDROP_WARM = "warm";
export type BackdropStyle =
	| typeof BACKDROP_CLASSIC
	| typeof BACKDROP_WARM;
export const DEFAULT_BACKDROP_STYLE: BackdropStyle = BACKDROP_WARM;

// Banner height unit: vh
export const BANNER_HEIGHT = 35;
export const BANNER_HEIGHT_EXTEND = 30;
export const BANNER_HEIGHT_HOME = BANNER_HEIGHT + BANNER_HEIGHT_EXTEND;

// The height the main panel overlaps the banner, unit: rem
export const MAIN_PANEL_OVERLAPS_BANNER_HEIGHT = 3.5;

// Page width: rem
export const PAGE_WIDTH = 100;

// Category constants
export const UNCATEGORIZED = "uncategorized";
