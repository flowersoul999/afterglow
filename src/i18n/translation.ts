import type I18nKey from "./i18nKey";
import { zh_CN } from "./languages/zh_CN";

/**
 * 单语言站点（简体中文）。
 *
 * 主题原本带 5 份翻译（en / zh_CN / zh_TW / ja / ru），但本站 `SITE_LANG = "zh_CN"` 写死、
 * 也没有语言切换入口，另外 4 份永远不会显示，却会整个打进客户端包
 * （`dist/_astro/translation.*.js` 现在约 20KB，去掉前是 104KB）。2026-10-20 按站长要求去掉。
 *
 * ⚠️ 以后要加回多语言：把对应语言文件放回 `languages/`，在这里重建 `map` 按
 * `siteConfig.lang` 取值，回退链写「当前语言 → zh_CN」即可（git 历史里有完整 5 份）。
 */
export type Translation = {
	[K in I18nKey]: string;
};

export function i18n(key: I18nKey): string {
	// 某个键漏填时退回键名本身，比渲染出 undefined 好定位
	return zh_CN[key] ?? key;
}
