import { type CollectionEntry, getCollection } from "astro:content";

/**
 * 面经板块（/interview/）的分类树。
 *
 * 目录约定：src/content/面经/<大类>/<子分类>/<题号-标题>.md
 * 例如 src/content/面经/八股文/智能体/01-什么是-Agent.md
 *      → entry.id = "八股文/智能体/01-什么是-Agent"
 *
 * 目录即分类（与 posts 的 category-tree 同一思路）：加新大类只需新建文件夹，
 * 首页会自动多出一个区块，不需要改路由或配置。
 */

export type InterviewEntry = CollectionEntry<"interview">;

export interface InterviewItem {
	entry: InterviewEntry;
	/** 大类，如「八股文」 */
	major: string;
	/** 子分类，如「智能体」；两级目录时为 "" */
	sub: string;
	/** 文章 slug（目录路径最后一段，不含扩展名） */
	slug: string;
	/** 文章页相对链接，已编码 */
	url: string;
}

export interface InterviewSubGroup {
	name: string;
	url: string;
	count: number;
	items: InterviewItem[];
}

export interface InterviewMajorGroup {
	name: string;
	count: number;
	subs: InterviewSubGroup[];
}

/** 板块根路径 */
export const INTERVIEW_BASE = "/interview";

function encode(...segments: string[]): string {
	// 与 posts 一致：中文路径直出（不 encodeURIComponent），
	// Astro 生成的 dist 目录就是中文名，浏览器访问时自动编码。
	const path = segments.filter((s) => s.length > 0).join("/");
	return `${INTERVIEW_BASE}/${path}/`;
}

/** 子分类列表页链接 */
export function getInterviewSubUrl(major: string, sub: string): string {
	return encode(major, sub);
}

/** 文章详情页链接 */
export function getInterviewItemUrl(
	major: string,
	sub: string,
	slug: string,
): string {
	return encode(major, sub, slug);
}

/**
 * 拆解 entry.id 为「大类 / 子分类 / slug」。
 * 兼容两种目录深度：
 *   3 段 八股文/智能体/01-xxx  → major=八股文 sub=智能体 slug=01-xxx
 *   2 段 八股文/01-xxx        → major=八股文 sub=""    slug=01-xxx
 */
export function splitInterviewId(id: string): {
	major: string;
	sub: string;
	slug: string;
} {
	const parts = id.split("/").filter(Boolean);
	const slug = parts.at(-1) ?? "";
	if (parts.length >= 3) {
		return {
			major: parts.slice(0, -2).join("/"),
			sub: parts.at(-2) ?? "",
			slug,
		};
	}
	return { major: parts[0] ?? "", sub: "", slug };
}

export function toInterviewItem(entry: InterviewEntry): InterviewItem {
	const { major, sub, slug } = splitInterviewId(entry.id);
	return {
		entry,
		major,
		sub,
		slug,
		url: getInterviewItemUrl(major, sub, slug),
	};
}

/** 题号自然序：01 < 02 < 10（避免字符串比较把 10 排到 2 前面） */
function compareBySlug(a: InterviewItem, b: InterviewItem): number {
	return a.slug.localeCompare(b.slug, "zh-CN", { numeric: true });
}

/**
 * 取全部面经条目（生产环境过滤 draft，与 posts 的处理一致）。
 * 排序按题号自然序，保证 01 在最前。
 */
export async function getInterviewItems(): Promise<InterviewItem[]> {
	const entries = await getCollection("interview", ({ data }) =>
		import.meta.env.PROD ? data.draft !== true : true,
	);
	return entries.map(toInterviewItem).sort(compareBySlug);
}

/** 构建「大类 → 子分类 → 条目」两级树，供首页与侧栏使用 */
export async function getInterviewTree(): Promise<InterviewMajorGroup[]> {
	const items = await getInterviewItems();

	const majorMap = new Map<string, Map<string, InterviewItem[]>>();
	for (const item of items) {
		let subs = majorMap.get(item.major);
		if (!subs) {
			subs = new Map();
			majorMap.set(item.major, subs);
		}
		const list = subs.get(item.sub);
		if (list) {
			list.push(item);
		} else {
			subs.set(item.sub, [item]);
		}
	}

	const tree: InterviewMajorGroup[] = [];
	for (const [majorName, subs] of [...majorMap.entries()].sort((a, b) =>
		a[0].localeCompare(b[0], "zh-CN"),
	)) {
		const subGroups: InterviewSubGroup[] = [...subs.entries()]
			.sort((a, b) => a[0].localeCompare(b[0], "zh-CN"))
			.map(([subName, list]) => ({
				name: subName,
				url: getInterviewSubUrl(majorName, subName),
				count: list.length,
				items: [...list].sort(compareBySlug),
			}));

		tree.push({
			name: majorName,
			count: subGroups.reduce((sum, s) => sum + s.count, 0),
			subs: subGroups,
		});
	}

	return tree;
}
