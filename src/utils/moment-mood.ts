/**
 * 动态（moments）的「心情」识别与配色。
 *
 * 约定：frontmatter 的 `tags` **第一项** 写心情，其余继续当话题标签。
 * 老写法（平平淡淡 / 伤心难过 / 不开心 …）由别名表归到新词，文章一个字都不用改。
 * 只有命中词表的标签才算心情——「额的圣剑！」这类非情绪标签仍留在卡片底部当话题。
 *
 * 显示形态统一为「emoji + 两个字」，颜色由 tone 决定（见 styles/tokens/colors.css 的 --mood-*）。
 */

export type MoodTone =
	| "amber"
	| "slate"
	| "blue"
	| "red"
	| "violet"
	| "pink"
	| "teal"
	| "sand";

export interface Mood {
	/** 颜色令牌名，对应 --mood-{tone}-bg / -fg / -bd */
	tone: MoodTone;
	/** 统一两个字的展示名 */
	label: string;
	emoji: string;
	/** 归一到这个词的其它写法（比较前会做同样的归一化） */
	aliases: readonly string[];
}

export const MOODS: readonly Mood[] = [
	{
		tone: "amber",
		label: "开心",
		emoji: "😄",
		aliases: ["开心", "快乐", "高兴", "爽", "嗨", "笑", "开森", "happy", "joy"],
	},
	{
		tone: "slate",
		label: "平淡",
		emoji: "😌",
		aliases: ["平淡", "平平淡淡", "日常", "平静", "佛系", "普通", "无聊"],
	},
	{
		tone: "blue",
		label: "难过",
		emoji: "😢",
		aliases: [
			"难过",
			"伤心",
			"伤心难过",
			"不开心",
			"郁闷",
			"低落",
			"失落",
			"emo",
			"哭",
		],
	},
	{
		tone: "red",
		label: "生气",
		emoji: "😤",
		aliases: ["生气", "愤怒", "火大", "不爽", "破防", "气死"],
	},
	{
		tone: "violet",
		label: "疲惫",
		emoji: "😩",
		aliases: ["疲惫", "累", "好累", "心累", "困", "熬夜", "摆烂"],
	},
	{
		tone: "pink",
		label: "兴奋",
		emoji: "🤩",
		aliases: ["兴奋", "激动", "期待", "惊喜", "上头", "冲"],
	},
	{
		tone: "teal",
		label: "好奇",
		emoji: "🤔",
		aliases: ["好奇", "涨知识", "学到了", "疑问", "思考", "新发现"],
	},
	{
		tone: "sand",
		label: "无语",
		emoji: "😶",
		aliases: ["无语", "绷不住", "尴尬", "吐槽", "迷惑", "离谱"],
	},
];

/** 去掉 # 前缀、空白与大小写差异，让「# 平平淡淡」也能命中 */
function normalize(raw: string): string {
	return raw.trim().replace(/^#/u, "").replace(/\s+/gu, "").toLowerCase();
}

/** 归一化词 → 心情，构建一次复用 */
const MOOD_INDEX: ReadonlyMap<string, Mood> = new Map(
	MOODS.flatMap((mood) =>
		[mood.label, ...mood.aliases].map(
			(word) => [normalize(word), mood] as const,
		),
	),
);

/** 取第一个标签当心情；没有标签、或第一个标签不在词表里，返回 null */
export function resolveMood(tags: readonly string[] | undefined): Mood | null {
	const first = tags?.[0];
	if (!first) return null;
	return MOOD_INDEX.get(normalize(first)) ?? null;
}

export interface SplitTagsResult {
	mood: Mood | null;
	/** 去掉心情后剩下的标签，继续当话题标签渲染 */
	topics: string[];
}

/** 一次拆出「心情」与「其余话题标签」，卡片渲染直接用这个 */
export function splitTags(
	tags: readonly string[] | undefined,
): SplitTagsResult {
	const list = (tags ?? []).map((tag) => tag.trim()).filter(Boolean);
	const mood = resolveMood(list);
	return {
		mood,
		topics: mood ? list.slice(1) : list,
	};
}
