import {
	LinkPreset,
	type NavBarConfig,
	type NavBarLink,
	type NavBarSearchConfig,
	NavBarSearchMethod,
} from "../types/config";
import { siteConfig } from "./siteConfig";

// 根据页面开关动态生成导航栏配置
const getDynamicNavBarConfig = (): NavBarConfig => {
	// 基础导航栏链接（2026-11-03 起：主页 / 导航 / 文章 / 动态 / 开心 / 关于）
	// 「主页」项 2026-11-03 重新加回：此前（2026-10-29）去掉的理由是「左侧 Logo 已能回首页」，
	// 但 Logo 在视觉上只是一块头像 + 站名，不像可点的入口，站长自己也找不到回首页的路。
	// 故显式保留第一项「主页」→ /（LinkPreset.Home，图标 material-symbols:home）。
	// 注意：navbar-active-motion.ts 的 pathMatches 对 href="/" 有特判（只匹配根路径），
	// 不会因为前缀匹配把其它页面的高亮抢到「主页」上。
	const links: (NavBarLink | LinkPreset)[] = [
		// 主页（/）
		LinkPreset.Home,

		// 网站导航（页面在 /projects/）
		{
			name: "导航",
			url: "/projects/",
			icon: "material-symbols:public",
		},

		// 文章（带下拉子菜单：文章列表 → 图谱 → 面经 → 归档）
		{
			name: "文章",
			url: "/posts/",
			icon: "material-symbols:article",
			children: [
				// 文章列表
				LinkPreset.Posts,

				// 图谱（/categories/ 的四层知识图谱）
				// 2026-10-29：恢复「图谱」原名 —— 当天早些时候曾改名为「分类」，
				// 但「分类」与文章本身的分类文件夹（/categories/<分类>/）同名易混，改回「图谱」。
				...(siteConfig.pages.categories
					? [
							{
								name: "图谱",
								url: "/categories/",
								icon: "material-symbols:hub",
							},
						]
					: []),

				// 面经（2026-10-29 归入「文章」这一类）—— 独立内容板块 /interview/，
				// 内容存 src/content/面经/，不参与文章列表/归档/RSS。原先挂在 /categories/
				// 顶部的浮层卡片上，现在导航里有了直达项，浮层已撤（避免两处重复入口）。
				{
					name: "面经",
					url: "/interview/",
					icon: "material-symbols:quiz-outline",
				},

				// 归档
				LinkPreset.Archive,
			],
		},
	];

	// 动态（带下拉子菜单）
	links.push({
		name: "动态",
		url: "/moments/",
		icon: "material-symbols:local-cafe",
		children: [
			{
				name: "说说",
				url: "/moments/",
				icon: "material-symbols:chat-bubble-outline",
			},
			{
				name: "相册",
				url: "/album/",
				icon: "material-symbols:photo-album-outline",
			},
			{
				name: "留言板",
				// Waline 对话式留言板的唯一公开入口
				url: "/life/guestbook/",
				icon: "material-symbols:edit-outline",
			},
			// 朋友圈
			LinkPreset.Circle,
		],
	});

	// 记录入口（2026-10-29 站长要求改名 AETHER —— 不要真词，要「字母抽一起」的招牌感：
	// 与站名 Aemeath 同以 Ae- 起手，像一枚徽章，和旁边的中文项形成节奏对比）——
	// 书架、影视与游戏、音乐、规划、足迹
	const recordChildren: (NavBarLink | LinkPreset)[] = [];
	if (siteConfig.pages.books) {
		recordChildren.push(LinkPreset.Books);
	}
	if (siteConfig.pages.moviesGames) {
		recordChildren.push(LinkPreset.MoviesGames);
	}
	// 音乐已移入「我的」分组，此处不再重复
	if (siteConfig.pages.changelog) {
		recordChildren.push(LinkPreset.Changelog);
	}
	// 足迹
	recordChildren.push({
		name: "足迹",
		url: "/life/places/",
		icon: "material-symbols:location-on",
	});

	// 技能（2026-11-02 站长收敛）：原先 7 张技能图各占一个下拉项
	// （计算机基础 / 前端 / 后端 / Agent 开发 / 音乐 / 英语 / 理财），菜单过长，
	// 现合并成唯一一个「技能」入口，直达 /skills/ 前端技能图。
	// 该页顶部就有 SkillGraphSwitch 切换条，7 张图之间可以互相跳转，
	// 所以这里删掉的只是导航里的重复入口 —— 7 条独立路由（/cs/ /backend/ /agent/
	// /music/ /english/ /finance/）与对应页面全部保留，别顺手删了。
	recordChildren.push({
		name: "技能",
		url: "/skills/",
		icon: "material-symbols:account-tree-rounded",
	});

	if (recordChildren.length > 0) {
		const defaultUrl = siteConfig.pages.books
			? "/books/"
			: siteConfig.pages.moviesGames
				? "/movies-games/"
				: // 兜底刻意不用 /music/（音乐技能图所在路由）：跳过去会让「开心」这一栏
					// 莫名其妙。更新日志是所有站点都开着的。
					"/changelog/";

		links.push({
			// 2026-10-29 站长定的名字：开心（AI 搭档的名字，也是这一栏的气质）
			name: "开心",
			url: defaultUrl,
			icon: "material-symbols:auto-awesome",
			children: recordChildren,
		});
	}

	// 关于及其子菜单
	links.push({
		name: "关于",
		url: "/about/",
		icon: "material-symbols:info",
		children: [
			// 关于页面
			LinkPreset.About,

			// 友链
			LinkPreset.Friends,

			// 赞助
			...(siteConfig.pages.sponsor ? [LinkPreset.Sponsor] : []),
		],
	});

	// 仅返回链接，其它导航搜索相关配置在模块顶层常量中独立导出。
	// （个人资料面板的「其他站点」列表不在这里维护：构建时直接读 daohang 集合里
	//  「我的网站」分类的条目，改 /projects/ 那边的站点即可，见 NavbarProfileCard.astro）
	return { links } as NavBarConfig;
};

// 导航搜索配置
export const navBarSearchConfig: NavBarSearchConfig = {
	method: NavBarSearchMethod.PageFind,
};

/**
 * 导航栏「分类」下拉的生成规则。
 * 分类列表本身来自文章目录（src/content/文章/<分类>/），这里只控制「怎么显示」。
 * 外观沿用站内其它下拉（白底描边卡片），只有排列是多列网格。
 */
export const navCategoryConfig: {
	showCount: boolean;
	exclude: readonly string[];
} = {
	/** 下拉项右侧显示文章数（网格卡片上默认不显示） */
	showCount: false,
	/**
	 * 不展示的分类（写分类文件夹路径，多级用 /，按路径段前缀匹配）：
	 * "已弃用" → 连同其子文件夹一起隐藏，但 /categories/已弃用/ 页面本身仍可访问。
	 */
	exclude: ["已弃用"],
};

export const navBarConfig: NavBarConfig = getDynamicNavBarConfig();
