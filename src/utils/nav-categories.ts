import { getCollection } from "astro:content";
import { navCategoryConfig } from "@/config/navBarConfig";
import { LinkPresets } from "@/constants/link-presets";
import type { LinkPreset, NavBarLink } from "@/types/config";
import {
	buildCategoryTree,
	type CategoryNode,
	normalizeCategory,
} from "./category-tree";
import { getCategoryUrl } from "./url-utils";

/**
 * 导航栏「分类」下拉的数据源。
 *
 * 本站分类 = 文章目录（src/content/文章/<分类路径>/），所以这里**不读任何手写配置**：
 * 构建时扫一遍 posts 集合，按目录前缀建树，新建分类文件夹后导航栏自动多一项。
 * 想隐藏某些分类，改 src/config/navBarConfig.ts 的 navCategoryConfig.exclude。
 */

type NavCategoryOptions = {
	/** 不展示的分类（分类文件夹路径，多级用 /，按路径段前缀匹配，如 "编程学习/已弃用"） */
	exclude?: readonly string[];
	/** 是否在条目右侧带文章数徽标 */
	showCount?: boolean;
	/** 分类图标（astro-icon 名）；空串 = 不显示图标 */
	icon?: string;
};

/** 与 isSubCategory 同一套路径段匹配规则：exclude "已弃用" 不会误伤 "已弃用2" */
function isExcluded(fullPath: string, exclude: readonly string[]): boolean {
	const target = normalizeCategory(fullPath);
	return exclude.some((item) => {
		const rule = normalizeCategory(item);
		if (!rule) return false;
		return target === rule || target.startsWith(`${rule}/`);
	});
}

/**
 * 树 → 扁平菜单项：父分类在前，子分类紧随其后并带 depth（下拉里靠缩进区分层级）。
 * 不加深度上限 —— 站点分类最多两三层，漏掉分类比下拉长更糟（下拉本身有滚动）。
 */
function flatten(
	nodes: CategoryNode[],
	options: Required<Pick<NavCategoryOptions, "showCount" | "icon">> & {
		exclude: readonly string[];
	},
	depth = 1,
	out: NavBarLink[] = [],
): NavBarLink[] {
	for (const node of nodes) {
		if (isExcluded(node.fullPath, options.exclude)) continue;
		out.push({
			name: node.name,
			url: getCategoryUrl(node.fullPath),
			// 子分类不重复画图标，靠缩进表达层级，避免下拉里一排同样的文件夹
			icon: depth === 1 ? options.icon || undefined : undefined,
			count: options.showCount ? node.count : undefined,
			depth,
		});
		if (node.children.length > 0) {
			flatten(node.children, options, depth + 1, out);
		}
	}
	return out;
}

/**
 * 生成「分类」下拉的全部子项。开发模式下包含草稿（与 /categories/ 页面一致的口径），
 * 生产构建时过滤 draft，草稿文章不会把某个分类顶出来。
 */
export async function getNavCategoryLinks(
	options: NavCategoryOptions = {},
): Promise<NavBarLink[]> {
	const {
		exclude = [],
		showCount = true,
		icon = "material-symbols:folder-outline",
	} = options;

	const posts = await getCollection("posts", ({ data }) => {
		return import.meta.env.PROD ? data.draft !== true : true;
	});

	// buildCategoryTree 只需要 id + tags；count 统计的是「该分类及其子分类」的文章数
	const tree = buildCategoryTree(
		posts.map((post) => ({ id: post.id, tags: post.data.tags ?? [] })),
	);

	return flatten(tree, { exclude, showCount, icon });
}

/**
 * 把 navBarConfig.links 解析成「最终可渲染」的导航列表：
 * LinkPreset 展开成真实链接 + 给 dynamicSource 项注入实时子项。
 * 桌面 Navbar 与移动抽屉 NavMenuPanel 共用这一份，避免两边内容走样。
 */
export async function resolveNavLinks(
	links: (NavBarLink | LinkPreset)[],
): Promise<NavBarLink[]> {
	const mapped = links.map((item) =>
		typeof item === "number" ? LinkPresets[item] : item,
	);

	// 没有动态项就早退，省一次 getCollection
	if (!mapped.some((item) => item.dynamicSource === "post-categories")) {
		return mapped;
	}

	const categories = await getNavCategoryLinks(navCategoryConfig);
	return mapped.map((item) =>
		item.dynamicSource === "post-categories"
			? { ...item, children: categories }
			: item,
	);
}
