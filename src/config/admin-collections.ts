/**
 * 后台的集合配置表
 *
 * 一个集合 = 一个内容目录 + 一组 frontmatter 字段 + 一条「新建时文件放哪」的规则。
 * 组件只认这张表，不认具体集合 —— 加一个新集合只需要在这里追加一项，
 * 不用改 AdminApp / AdminEditor。
 *
 * 字段顺序有意义：它决定新建文件的 frontmatter 行序，也决定表单从上到下的排列。
 * 已有文件的字段顺序不会被这张表打乱（见 content-serializer 的「保序保留」）。
 */

export type AdminFieldType =
	| "text"
	| "textarea"
	| "date"
	| "datetime"
	| "tags"
	| "switch"
	| "number"
	| "select";

export interface AdminFieldOption {
	value: string;
	label: string;
}

export interface AdminField {
	key: string;
	label: string;
	type: AdminFieldType;
	hint?: string;
	placeholder?: string;
	options?: AdminFieldOption[];
	/** 新建文件时写入的初值 */
	initial?: string | boolean | number;
	required?: boolean;
	/** 占满表单整行 */
	wide?: boolean;
}

export interface AdminCollection {
	/** 与 content.config.ts 的集合键对应，便于对照 */
	id: string;
	label: string;
	/** 左栏图标：一个汉字比图标更省地方也更清楚 */
	icon: string;
	/** 相对仓库根的目录，不带结尾斜杠 */
	dir: string;
	/** 列表排序与显示用的日期字段 */
	dateField: string;
	/** true = 只到天（`2026-11-04`），false = 到分钟（`2026-11-04 21:40`） */
	dateOnly: boolean;
	fields: AdminField[];
	/** 新建时的默认分类（目录名）；空字符串表示不分类 */
	defaultCategory?: string;
	/** 新建时分类能不能改（文章可以，说说按年月自动分层不行） */
	categoryEditable?: boolean;
	/** 路径模板：`{category}` / `{yyyy}` / `{mm}` / `{dd}` / `{slug}` */
	pathTemplate: string;
}

/** 文章：分类就是文件夹，路径 `文章/<分类>/<slug>.md` */
const posts: AdminCollection = {
	id: "posts",
	label: "文章",
	icon: "文",
	dir: "src/content/文章",
	dateField: "published",
	dateOnly: true,
	defaultCategory: "随笔",
	categoryEditable: true,
	pathTemplate: "{category}/{slug}",
	fields: [
		{ key: "title", label: "标题", type: "text", required: true },
		{
			key: "published",
			label: "发布日期",
			type: "date",
			required: true,
			hint: "只到天，和站点排序一致",
		},
		{
			key: "description",
			label: "摘要",
			type: "textarea",
			wide: true,
			hint: "列表页和 SEO 用，留空则由正文开头截取",
			placeholder: "一句话说清这篇在讲什么",
		},
		{ key: "tags", label: "标签", type: "tags", wide: true, hint: "回车添加" },
		{
			key: "draft",
			label: "草稿",
			type: "switch",
			hint: "草稿不进列表，但照样会触发构建",
		},
		{ key: "pinned", label: "置顶", type: "switch" },
		{ key: "comment", label: "允许评论", type: "switch", initial: true },
		{
			key: "image",
			label: "封面图",
			type: "text",
			hint: "站点内路径或完整 URL",
			placeholder: "/assets/... 或 https://...",
		},
		{
			key: "order",
			label: "排序号",
			type: "number",
			hint: "同日期时排在前面，越大越靠前",
		},
	],
};

/** 说说：按年月分层，同一天多条靠 -2、-3 让路 */
const moments: AdminCollection = {
	id: "moments",
	label: "说说",
	icon: "说",
	dir: "src/content/动态",
	dateField: "published",
	dateOnly: false,
	pathTemplate: "{yyyy}/{mm}/{yyyy}-{mm}-{dd}",
	fields: [
		{
			key: "published",
			label: "发布时间",
			type: "datetime",
			required: true,
		},
		{ key: "title", label: "标题", type: "text", hint: "可空，留空只显示正文" },
		{ key: "location", label: "地点", type: "text", placeholder: "比如 杭州" },
		{
			key: "tags",
			label: "标签",
			type: "tags",
			wide: true,
			hint: "第一个是心情，其余算话题",
		},
		{ key: "pinned", label: "置顶", type: "switch" },
	],
};

/** 更新日志：文件名带日期，version 手动写 */
const changelog: AdminCollection = {
	id: "changelog",
	label: "更新日志",
	icon: "更",
	dir: "src/content/更新日志",
	dateField: "date",
	dateOnly: true,
	pathTemplate: "{yyyy}-{mm}-{dd}-{slug}",
	fields: [
		{
			key: "version",
			label: "版本号",
			type: "text",
			required: true,
			placeholder: "v6.11.0",
			hint: "feature 升 minor，fix 升 patch",
		},
		{ key: "date", label: "日期", type: "date", required: true },
		{ key: "time", label: "时间", type: "text", placeholder: "21:40" },
		{
			key: "type",
			label: "类型",
			type: "select",
			required: true,
			options: [
				{ value: "feature", label: "新功能" },
				{ value: "improvement", label: "改进" },
				{ value: "fix", label: "修复" },
				{ value: "removal", label: "移除" },
			],
		},
		{
			key: "description",
			label: "一句话说明",
			type: "text",
			wide: true,
			required: true,
			hint: "会显示在更新日志列表里",
		},
	],
};

export const adminCollections: AdminCollection[] = [posts, moments, changelog];

export function findCollection(id: string): AdminCollection {
	return adminCollections.find((item) => item.id === id) ?? posts;
}
