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
	// 基础导航栏链接
	const links: (NavBarLink | LinkPreset)[] = [
		// 主页
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
				// 走 giscus 版留言板（/life/guestbook/）
				// 原 /guestbook/ 是聊天式页面，硬依赖 Waline 后端，未部署故已关闭
				url: "/life/guestbook/",
				icon: "material-symbols:edit-outline",
			},
			// 朋友圈
			LinkPreset.Circle,
		],
	});

	// 记录入口 - 书架、影视与游戏、音乐、规划、足迹
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

	if (recordChildren.length > 0) {
		const defaultUrl = siteConfig.pages.books
			? "/books/"
			: siteConfig.pages.moviesGames
				? "/movies-games/"
				: "/music/";

		links.push({
			name: "记录",
			url: defaultUrl,
			icon: "material-symbols:camera-outdoor",
			children: recordChildren,
		});
	}

	// 技能图（2026-10-29 自 jojo! 站迁入）—— 独立顶层入口，不塞进「记录」里：
	// 七张图本身是学习体系，跟书架/影视/足迹这些生活记录不是一类。
	// 分两组（顺序即截图里的顺序）：
	//   修行路（有境界门禁、算修为）：计算机基础 → 前端 → 后端 → Agent 开发
	//   修行录（无门禁、不算修为）：音乐 / 英语 / 理财
	// 每张图内部还有顶部切换条可以互跳（SkillGraphSwitch），这里只是给导航一个直达入口。
	// 父项带 children 时 Navbar 会渲染成按钮（不是链接），所以这里的 url 只是兜底。
	links.push({
		name: "技能",
		url: "/skills/",
		icon: "material-symbols:account-tree-rounded",
		children: [
			// 计算机基础技能图（数学 / 组原 / 操作系统 / 网络 / 数据库 …）
			{
				name: "计算机基础",
				url: "/cs/",
				icon: "material-symbols:school",
			},
			// 前端技能图
			{
				name: "前端技能图",
				url: "/skills/",
				icon: "material-symbols:account-tree-rounded",
			},
			// 后端技能图（在前端基础上往全栈转）
			{
				name: "后端技能图",
				url: "/backend/",
				icon: "material-symbols:storage",
			},
			// Agent 开发技能图（大模型应用：提示 / RAG / 工具编排 / 评测 / 上线）
			{
				name: "Agent 开发",
				url: "/agent/",
				icon: "material-symbols:smart-toy",
			},
			// 修行录三张：与修行路无先后关系，不计修为
			{
				name: "音乐（修行录）",
				url: "/music/",
				icon: "material-symbols:music-note",
			},
			{
				name: "英语（修行录）",
				url: "/english/",
				icon: "material-symbols:translate",
			},
			{
				name: "理财（修行录）",
				url: "/finance/",
				icon: "material-symbols:savings",
			},
		],
	});

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
