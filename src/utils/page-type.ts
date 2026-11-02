/**
 * 页面类型分类器 —— 供侧栏小组件按页面控制显示（sidebarConfig 的 showOnPages / hideOnPages）。
 *
 * 关键约束：侧栏渲染在 Swup 容器之外（`#left-sidebar-wrapper` / `#right-sidebar-static`），
 * 客户端导航时不会重新渲染，所以显隐只能靠"服务端渲染全部 + 运行期按 URL 切 class"。
 * 因此这个纯函数必须同时供**构建期**（传 `Astro.url.pathname`）与**运行期**（传
 * `location.pathname`）使用，保证首屏初始态与导航后的计算结果一致，避免闪一下。
 */

export type SidebarPageType =
	| "home"
	| "posts-list"
	| "post"
	| "categories-list"
	| "category"
	| "archive"
	| "moments"
	| "projects"
	| "friends"
	| "about"
	| "guestbook"
	| "circle"
	| "places"
	| "album-list"
	| "album"
	| "books"
	| "movies-games"
	| "bangumi"
	| "search"
	| "changelog"
	| "sponsor"
	/** 七张技能图（2026-10-29 迁入）：/cs/ /skills/ /backend/ /agent/ /music/ /english/ /finance/ */
	| "skills"
	| "other";

/** 全部页面类型（供文档/校验参考，顺序与判定无关） */
export const SIDEBAR_PAGE_TYPES: readonly SidebarPageType[] = [
	"home",
	"posts-list",
	"post",
	"categories-list",
	"category",
	"archive",
	"moments",
	"projects",
	"friends",
	"about",
	"guestbook",
	"circle",
	"places",
	"album-list",
	"album",
	"books",
	"movies-games",
	"bangumi",
	"search",
	"changelog",
	"sponsor",
	"skills",
	"other",
] as const;

/**
 * 七张技能图的扁平路由（2026-10-29 自 jojo! 站迁入）。
 * 修行路：/cs/ 计算机基础、/skills/ 前端、/backend/ 后端、/agent/ Agent 开发；
 * 修行录：/music/ 音乐、/english/ 英语、/finance/ 理财。
 * 路由是固定的单层路径，直接精确匹配即可，不做 startsWith（避免误吞将来的子路由）。
 */
const SKILL_GRAPH_PATHS: ReadonlySet<string> = new Set([
	"/cs",
	"/skills",
	"/backend",
	"/agent",
	"/music",
	"/english",
	"/finance",
]);

/** 去掉 query / hash / 尾部斜杠，`""` 归一为 `"/"` */
function normalizePath(pathname: string): string {
	const withoutQuery = pathname.split("?")[0].split("#")[0];
	const trimmed = withoutQuery.replace(/\/+$/, "");
	return trimmed === "" ? "/" : trimmed;
}

/**
 * 判断一个路径属于哪个页面类型。
 *
 * 注意 `/posts/`（文章列表）与 `/posts/<slug>/`（文章详情）是**不同类型**：
 * 这个区分是刻意做的，旧的 `pathname.includes("/posts/")` 会把列表页也算成文章页。
 */
export function getSidebarPageType(pathname: string): SidebarPageType {
	const path = normalizePath(pathname);

	if (path === "/") return "home";

	// 博客
	if (path === "/posts") return "posts-list";
	if (path.startsWith("/posts/")) return "post";

	// 分类与归档
	if (path === "/categories") return "categories-list";
	if (path.startsWith("/categories/")) return "category";
	if (path === "/archive") return "archive";

	// 社交与内容
	if (path === "/moments" || path.startsWith("/moments/")) return "moments";
	if (path === "/projects" || path.startsWith("/projects/")) return "projects";
	if (path === "/friends") return "friends";
	if (path === "/about") return "about";
	if (path === "/guestbook" || path === "/life/guestbook") return "guestbook";
	if (path === "/circle") return "circle";

	// 生活
	if (path === "/life/places") return "places";
	if (path === "/album") return "album-list";
	if (path.startsWith("/album/")) return "album";

	// 收藏
	if (path === "/books" || path.startsWith("/books/")) return "books";
	if (path === "/movies-games") return "movies-games";
	if (path === "/bangumi" || path.startsWith("/bangumi/")) return "bangumi";

	// 工具页
	if (path === "/search") return "search";
	if (path === "/changelog") return "changelog";
	if (path === "/sponsor") return "sponsor";

	// 技能图（2026-10-29 自 jojo! 站迁入）—— 七张图共用一个页面类型：
	// 修行路四张（无门禁之前都算同一类）+ 修行录三张，排版完全相同（满宽、无侧栏）。
	// 逐个精确匹配而不是 startsWith：这几条都是单层扁平路由。
	if (SKILL_GRAPH_PATHS.has(path)) return "skills";

	return "other";
}
