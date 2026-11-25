import type { FooterConfig } from "../types/config";

/**
 * 手绘 Doodle Crew 页脚的全部内容。
 * 巨型字用 4–9 个大写字母最好看；角色 letter 是巨型字里的字母下标（从 0 开始）。
 * socialLinks 是灵动岛铭牌页复用的旧字段，别删。
 */
export const footerConfig: FooterConfig = {
	enable: true,
	socialLinks: [
		{
			label: "GitHub",
			href: "https://github.com/flowersoul999",
			icon: "simple-icons:github",
		},
		{
			label: "Bilibili",
			href: "https://space.bilibili.com/1395949329",
			icon: "simple-icons:bilibili",
		},
		{
			label: "邮箱",
			href: "mailto:3109581507@qq.com",
			icon: "material-symbols:mail",
		},
	],

	wordmark: "JOJOSTAR",
	brand: "jojostar",
	blurb: "记录技术、代码与生活里值得留下的东西。",
	tagline: "记录技术，也记录生活里那些值得留下的瞬间。",

	columns: [
		{
			title: "内容",
			links: [
				{ label: "文章", href: "/posts/" },
				{ label: "归档", href: "/archive/" },
				{ label: "图谱", href: "/categories/" },
				{ label: "动态", href: "/moments/" },
			],
		},
		{
			title: "记录",
			links: [
				{ label: "书架", href: "/books/" },
				{ label: "影视与游戏", href: "/movies-games/" },
				{ label: "相册", href: "/album/" },
				{ label: "足迹", href: "/life/places/" },
			],
		},
		{
			title: "关于",
			links: [
				{ label: "关于", href: "/about/" },
				{ label: "友链", href: "/friends/" },
				{ label: "赞助", href: "/sponsor/" },
				{ label: "更新日志", href: "/changelog/" },
			],
		},
		{
			title: "更多",
			links: [
				{ label: "导航", href: "/projects/" },
				{ label: "留言板", href: "/life/guestbook/" },
				{ label: "搜索", href: "/search/" },
				{ label: "RSS", href: "/rss.xml", noSwup: true },
			],
		},
	],

	actions: [
		{
			label: "开始阅读",
			href: "/posts/",
			icon: "bolt",
			variant: "solid",
		},
		{
			label: "RSS 订阅",
			href: "/rss.xml",
			icon: "star",
			variant: "outline",
			noSwup: true,
		},
	],

	copyright: "Copyright © 2026 jojo 保留版权所有 · Powered by Astro & Firefly",

	// 没有备案号，留空数组即可。
	legal: [],

	socials: [
		{
			label: "GitHub",
			href: "https://github.com/flowersoul999",
			external: true,
		},
		{
			label: "Bilibili",
			href: "https://space.bilibili.com/1395949329",
			external: true,
		},
		{ label: "邮箱", href: "mailto:3109581507@qq.com" },
	],

	crew: [
		{
			kind: "yeti",
			letter: 0,
			seat: "front",
			offset: -0.32,
			name: "jojo",
			says: "写博客吗？一起。",
		},
		{
			kind: "bird",
			letter: 1,
			seat: "top",
			offset: 0.02,
			name: "小啾",
			says: "常来玩啊！",
		},
		{
			kind: "mushroom",
			letter: 2,
			seat: "front",
			offset: 0.12,
			scale: 0.95,
			name: "小菇",
			says: "我很好相处（菌）的。",
		},
		{
			kind: "kid",
			letter: 4,
			seat: "top",
			offset: -0.05,
			name: "小满",
			says: "上面风景最好！",
		},
		{
			kind: "ghost",
			letter: 6,
			seat: "behind",
			offset: 0,
			name: "阿飘",
			says: "哇！……不好意思，你好。",
		},
		{
			kind: "cat",
			letter: 7,
			seat: "front",
			offset: 0.42,
			flip: true,
			name: "阿喵",
			says: "喵。光标不错。",
		},
	],

	doodles: [
		"flame",
		"sandwich",
		"star",
		"flame",
		"heart",
		"sandwich",
		"bolt",
		"sparkle",
	],
	doodleCount: 12,
	serifFamily:
		'"LXGW WenKai", "Songti SC", "Noto Serif SC", "SimSun", Georgia, serif',
};
