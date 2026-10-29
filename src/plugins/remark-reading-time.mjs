// biome-ignore lint/suspicious/noShadowRestrictedNames: <toString from mdast-util-to-string>
import { toString } from "mdast-util-to-string";
import getReadingTime from "reading-time";

/**
 * CJK 统一表意文字区间。
 * reading-time 按「空格分词」统计英文单词，中文正文没有空格，
 * 整段中文会被算成 1 个词，导致列表卡片长期显示「0 字」。
 * 所以中文单独按「字」计数。
 */
const CJK_RE = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g;

/** 中文阅读速度（字/分钟），取常见区间中值偏保守 */
const CJK_WORDS_PER_MINUTE = 300;
/** 英文阅读速度（词/分钟） */
const EN_WORDS_PER_MINUTE = 200;

export function remarkReadingTime() {
	return (tree, { data }) => {
		const textOnPage = toString(tree);
		const readingTime = getReadingTime(textOnPage);

		const cjkCount = (textOnPage.match(CJK_RE) || []).length;
		const enWords = readingTime.words;
		const totalWords = enWords + cjkCount;

		const minutes = enWords / EN_WORDS_PER_MINUTE + cjkCount / CJK_WORDS_PER_MINUTE;

		data.astro.frontmatter.words = totalWords;
		data.astro.frontmatter.minutes = Math.max(1, Math.round(minutes));
	};
}
