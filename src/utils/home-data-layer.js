// 本文件只保留「文章页目录面板 ArticleTocPanel」仍在用的两个统计工具。
// 原先的 normalizeSkillItems + SKILL_ICON_MAP 是给已下线的 HomeDataLayer
// 技能卡用的，已于 2026-10-20 一并删除。

export function countReadableCharacters(body = "") {
	const text = String(body)
		.replace(/```[\s\S]*?```/g, "")
		.replace(/`[^`]*`/g, "")
		.replace(/\s+/g, " ")
		.trim();
	const cn = text.match(/[一-龥]/g) || [];
	const en = text.match(/[a-zA-Z]/g) || [];
	return cn.length + en.length;
}

export function formatCompactNumber(value) {
	if (value === null || value === undefined || Number.isNaN(Number(value))) {
		return "--";
	}
	const number = Number(value);
	if (Math.abs(number) < 1000) return String(number);
	const compact = number / 1000;
	const rounded = Number.isInteger(compact)
		? compact.toFixed(0)
		: compact.toFixed(1);
	return `${rounded}k`;
}
