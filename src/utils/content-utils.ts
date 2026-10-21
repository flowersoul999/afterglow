import { type CollectionEntry, getCollection, render } from "astro:content";
import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import {
	buildCategoryTree,
	type CategoryNode,
	getCategoryFromId,
} from "@utils/category-tree";
import {
	buildKnowledgeGraphData,
	type KGData,
} from "@utils/knowledge-graph-data";
import { stripMomentMedia } from "@utils/moment-media";
import { getCategoryUrl, getPostUrlBySlug, getTagUrl } from "@utils/url-utils";
import type { MarkdownHeading } from "astro";
import { siteConfig } from "@/config";

type SortableEntry = {
	id: string;
	order?: number | undefined;
};

// 未写 order 的文章排在同目录末尾（order 降序，故用负无穷表示最小）
function resolveOrder(order?: number): number {
	return order ?? Number.NEGATIVE_INFINITY;
}

/**
 * 同日期内两条文章的比较：先按目录（文件夹路径）分组，组内 order 降序，组间按目录名。
 *
 * order 与日期同向（都是大的在前），因此跨日期分组的系列序号能连续递减、不会跳号
 * （如 68→51 接 50→42 接 41→27）。
 * 组间不能用「组内最大 order」比较——那样不满足传递性，排序结果会依赖比较顺序。
 * 供按目录聚合的列表（左侧全站文章目录）复用相同的组内规则。
 */
import { isHiddenFromLists } from "@/config/notesConfig";

export function compareInSameDate(a: SortableEntry, b: SortableEntry): number {
	const folderA = getCategoryFromId(a.id);
	const folderB = getCategoryFromId(b.id);
	if (folderA !== folderB) return folderA.localeCompare(folderB, "zh-CN");
	return resolveOrder(b.order) - resolveOrder(a.order);
}

/**
 * 文章统一排序规则（唯一真相源）：
 * 置顶优先 → 发布日期降序 → 同日期内按目录分组，组内 order 降序（未写的排该组末尾）
 *
 * 分类页、文章列表页、左侧全站文章目录共用此函数，不要在调用处另写排序。
 */
export function comparePostsByOrderAndDate(
	a: {
		id: string;
		data: { published: Date; order?: number | undefined; pinned?: boolean };
	},
	b: {
		id: string;
		data: { published: Date; order?: number | undefined; pinned?: boolean };
	},
): number {
	if (a.data.pinned && !b.data.pinned) return -1;
	if (!a.data.pinned && b.data.pinned) return 1;

	const dateA = new Date(a.data.published).getTime();
	const dateB = new Date(b.data.published).getTime();
	if (dateA !== dateB) return dateB - dateA;

	return compareInSameDate(
		{ id: a.id, order: a.data.order },
		{ id: b.id, order: b.data.order },
	);
}

// // Retrieve posts and sort them by publication date
async function getRawSortedPosts() {
	const allBlogPosts = await getCollection("posts", ({ data }) => {
		return import.meta.env.PROD ? data.draft !== true : true;
	});

	const sorted = allBlogPosts.sort(comparePostsByOrderAndDate);
	return sorted;
}

/**
 * 过滤掉「不进列表」的自用系列笔记（配置在 src/config/notesConfig.ts）。
 * 只在文章列表页与 RSS 调用；分类详情页、首页、归档、搜索、统计都不调用。
 */
export function excludeHiddenNotes<T extends { id: string }>(posts: T[]): T[] {
	return posts.filter((post) => !isHiddenFromLists(post.id));
}

export async function getSortedPosts() {
	const sorted = await getRawSortedPosts();

	for (let i = 1; i < sorted.length; i++) {
		sorted[i].data.nextSlug = sorted[i - 1].id;
		sorted[i].data.nextTitle = sorted[i - 1].data.title;
	}
	for (let i = 0; i < sorted.length - 1; i++) {
		sorted[i].data.prevSlug = sorted[i + 1].id;
		sorted[i].data.prevTitle = sorted[i + 1].data.title;
	}

	return sorted;
}
export type PostForList = {
	id: string;
	data: CollectionEntry<"posts">["data"];
};
export async function getSortedPostsList(): Promise<PostForList[]> {
	const sortedFullPosts = await getRawSortedPosts();

	// delete post.body
	const sortedPostsList = sortedFullPosts.map((post) => ({
		id: post.id,
		data: post.data,
	}));

	return sortedPostsList;
}

export type ArchiveItem = {
	id: string;
	type: "post" | "moment" | "bangumi" | "life";
	data: {
		title: string;
		published: Date;
		tags: string[];
		category?: string | null;
		image?: string;
		link?: string;
		order?: number | undefined;
	};
};

export async function getArchiveList(): Promise<ArchiveItem[]> {
	const posts = await getCollection("posts", ({ data }) => {
		return import.meta.env.PROD ? data.draft !== true : true;
	});
	const moments = await getCollection("moments");
	const bangumi = await getCollection("bangumi");
	const lifeEntries = await getCollection("places");
	const postItems: ArchiveItem[] = posts.map((post) => ({
		id: post.id,
		type: "post",
		data: {
			title: post.data.title,
			published: post.data.published,
			tags: post.data.tags,
			category: getCategoryFromId(post.id) || null,
			order: post.data.order,
		},
	}));

	const momentItems: ArchiveItem[] = moments.map((moment) => {
		// 提取摘要作为标题（先去掉正文里的图片语法，避免 https://... 混进标题）
		let title = stripMomentMedia(moment.body).replace(/[#*`]/g, "").trim();
		if (title.length > 50) title = `${title.substring(0, 50)}...`;
		if (!title) title = i18n(I18nKey.moments) || "日常动态";

		return {
			id: moment.id,
			type: "moment",
			data: {
				title: title,
				published: moment.data.published,
				tags: moment.data.tags,
				category: null,
			},
		};
	});

	const bangumiItems: ArchiveItem[] = bangumi.map((b) => {
		let link = b.data.link || "";
		if (!link) {
			const slug = b.id
				.replace(/\\/g, "/")
				.replace(/\.(md|mdx|markdown)$/i, "");
			if (b.data.category === "book") {
				link = `/books/${slug}/`;
			} else if (b.data.category === "music") {
				link = "/music/";
			} else {
				link = "/movies-games/";
			}
		}
		return {
			id: b.id,
			type: "bangumi",
			data: {
				title: b.data.title,
				published: b.data.published || new Date(0),
				tags: [],
				category: null,
				image:
					typeof b.data.image === "string" ? b.data.image : b.data.image.src,
				link,
			},
		};
	});

	// 生活动态归档
	const lifeItems: ArchiveItem[] = [];

	// 足迹记录
	lifeEntries.forEach((p) => {
		const parts = [p.data.province, p.data.city].filter(Boolean);
		lifeItems.push({
			id: p.id,
			type: "life",
			data: {
				title: parts.length > 0 ? parts.join(" ") : "足迹记录",
				published: p.data.date || new Date(),
				tags: ["足迹"],
				link: "/life/places/",
			},
		});
	});

	return [...postItems, ...momentItems, ...bangumiItems, ...lifeItems].sort(
		(a, b) => {
			const timeA = a.data.published.getTime();
			const timeB = b.data.published.getTime();
			if (timeA !== timeB) return timeB - timeA;
			// 同一天发布的文章沿用统一排序（按目录分组、组内 order 降序）
			return compareInSameDate(
				{ id: a.id, order: a.data.order },
				{ id: b.id, order: b.data.order },
			);
		},
	);
}
export type Tag = {
	name: string;
	count: number;
};

export async function getTagList(): Promise<Tag[]> {
	const allBlogPosts = await getCollection<"posts">("posts", ({ data }) => {
		return import.meta.env.PROD ? data.draft !== true : true;
	});

	const allMoments = await getCollection("moments");

	const countMap: { [key: string]: number } = {};
	allBlogPosts.forEach((post: { data: { tags: string[] } }) => {
		post.data.tags.forEach((tag: string) => {
			if (!countMap[tag]) countMap[tag] = 0;
			countMap[tag]++;
		});
	});

	allMoments.forEach((moment: { data: { tags: string[] } }) => {
		if (Array.isArray(moment.data.tags)) {
			moment.data.tags.forEach((tag: string) => {
				if (!countMap[tag]) countMap[tag] = 0;
				countMap[tag]++;
			});
		}
	});

	// sort tags
	const keys: string[] = Object.keys(countMap).sort((a, b) => {
		return a.toLowerCase().localeCompare(b.toLowerCase());
	});

	return keys.map((key) => ({ name: key, count: countMap[key] }));
}

export type Category = {
	name: string;
	count: number;
	url: string;
};

export async function getCategoryList(): Promise<Category[]> {
	const allBlogPosts = await getCollection<"posts">("posts", ({ data }) => {
		return import.meta.env.PROD ? data.draft !== true : true;
	});
	const count: { [key: string]: number } = {};
	const uncategorized = i18n(I18nKey.uncategorized);
	for (const post of allBlogPosts as unknown as { id: string }[]) {
		const full = getCategoryFromId((post as { id: string }).id);
		if (!full) {
			count[uncategorized] = (count[uncategorized] ?? 0) + 1;
			continue;
		}
		const parts = full.split("/");
		for (let i = 1; i <= parts.length; i++) {
			const pref = parts.slice(0, i).join("/");
			count[pref] = (count[pref] ?? 0) + 1;
		}
	}

	const lst = Object.keys(count).sort((a, b) => {
		return (
			count[b] - count[a] || a.toLowerCase().localeCompare(b.toLowerCase())
		);
	});

	const ret: Category[] = [];
	for (const c of lst) {
		ret.push({
			name: c,
			count: count[c],
			url: getCategoryUrl(c),
		});
	}
	return ret;
}

export async function getCategoryTree(): Promise<CategoryNode[]> {
	const allBlogPosts = await getCollection("posts", ({ data }) => {
		return import.meta.env.PROD ? data.draft !== true : true;
	});
	const postsForTree = (
		allBlogPosts as unknown as { id: string; data: { tags: string[] } }[]
	).map((p) => ({
		id: p.id,
		tags: p.data.tags ?? [],
	}));
	return buildCategoryTree(postsForTree);
}

export type CategoryTag = {
	name: string;
	count: number;
	url: string;
};

export type CategoryTagGroup = Category & {
	tags: CategoryTag[];
};

export async function getCategoryTagGroups(): Promise<CategoryTagGroup[]> {
	const allBlogPosts = await getCollection<"posts">("posts", ({ data }) => {
		return import.meta.env.PROD ? data.draft !== true : true;
	});
	const groupMap = new Map<
		string,
		{ count: number; tagCounts: Map<string, number> }
	>();
	const uncategorized = i18n(I18nKey.uncategorized);

	for (const post of allBlogPosts as unknown as {
		id: string;
		data: { tags: string[] };
	}[]) {
		const categoryName = getCategoryFromId(post.id) || uncategorized;
		const group = groupMap.get(categoryName) ?? {
			count: 0,
			tagCounts: new Map<string, number>(),
		};

		group.count++;
		const postTags = new Set(
			(post.data.tags ?? []).map((tag: string) => tag.trim()).filter(Boolean),
		);
		for (const tag of postTags) {
			group.tagCounts.set(tag, (group.tagCounts.get(tag) ?? 0) + 1);
		}
		groupMap.set(categoryName, group);
	}

	return [...groupMap.entries()]
		.map(([name, group]) => ({
			name,
			count: group.count,
			url: getCategoryUrl(name),
			tags: [...group.tagCounts.entries()]
				.map(([tagName, count]) => ({
					name: tagName,
					count,
					url: getTagUrl(tagName),
				}))
				.sort(
					(a, b) =>
						b.count - a.count ||
						a.name.toLowerCase().localeCompare(b.name.toLowerCase()),
				),
		}))
		.sort(
			(a, b) =>
				b.count - a.count ||
				a.name.toLowerCase().localeCompare(b.name.toLowerCase()),
		);
}

/* ========== 知识图谱（/categories/ 图谱页） ========== */

let cachedHeadings: Map<string, MarkdownHeading[]> | null = null;

/**
 * 提取全部文章的标题，按 collection id 索引。
 *
 * 必须走 `render(entry)` 而不是正则扫正文：slug 由 rehype-slug 在同一条 rehype 链上
 * 生成，只有这样锚点才和文章页 DOM 里的 id 逐字一致。自己用 github-slugger 复算会在
 * 去重后缀（`-1`/`-2`）、标题内 inline code、KaTeX 上漂移，产出跳不到位置的深链。
 *
 * 串行而非 Promise.all —— render 会跑完整 markdown 链（KaTeX / mermaid /
 * expressive-code），并发会把子进程打满。
 */
export async function getAllPostHeadings(): Promise<
	Map<string, MarkdownHeading[]>
> {
	if (cachedHeadings) return cachedHeadings;

	const posts = await getRawSortedPosts();
	const startedAt = performance.now();
	const headingMap = new Map<string, MarkdownHeading[]>();

	for (const post of posts) {
		const { headings } = await render(post);
		headingMap.set(post.id, headings);
	}

	// 构建期一次性日志：render() 走全 markdown 链，耗时需要可观测
	console.info(
		`[knowledge-graph] 提取 ${posts.length} 篇文章标题耗时 ${Math.round(
			performance.now() - startedAt,
		)}ms`,
	);

	cachedHeadings = headingMap;
	return headingMap;
}

/**
 * 四层知识图谱数据：分类 → 标签 → 文章 → H2 小标题。
 *
 * 与参考站的区别：本项目的分类不是 frontmatter 字段，而是文章所在的目录路径
 * （可能多级，如「编程学习/JavaWeb学习笔记」），一律用 getCategoryFromId 推导；
 * 标签没有独立归档页，链接统一走 getTagUrl 的 /archive/?tag= 形式。
 */
export async function getKnowledgeGraphData(): Promise<KGData> {
	const posts = await getRawSortedPosts();
	const headingMap = await getAllPostHeadings();

	return buildKnowledgeGraphData(
		posts.map((post) => ({
			id: post.id,
			title: post.data.title,
			url: getPostUrlBySlug(post.id),
			published: post.data.published,
			category: getCategoryFromId(post.id) || null,
			tags: post.data.tags ?? [],
			headings: (headingMap.get(post.id) ?? []).map((heading) => ({
				depth: heading.depth,
				slug: heading.slug,
				text: heading.text,
			})),
		})),
		{
			uncategorizedName: i18n(I18nKey.uncategorized),
			categoryUrl: getCategoryUrl,
			tagUrl: getTagUrl,
			siteStartDate: siteConfig.siteStartDate,
		},
	);
}
