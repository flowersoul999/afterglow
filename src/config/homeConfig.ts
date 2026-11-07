import type { HomeConfig } from "../types/config";
import { profileConfig } from "./profileConfig";
import { siteConfig } from "./siteConfig";
import { skillsConfig } from "./skillsConfig";

// 构建时自动扫描背景图文件夹
const _deskGlob = import.meta.glob(
	"../assets/images/backgrounds/desktop/*.{webp,png,jpg,jpeg,avif}",
	{ eager: true, query: "?url", import: "default" },
) as Record<string, string>;
const _mobGlob = import.meta.glob(
	"../assets/images/backgrounds/mobile/*.{webp,png,jpg,jpeg,avif}",
	{ eager: true, query: "?url", import: "default" },
) as Record<string, string>;
const _deskImgs = Object.values(_deskGlob);
const _mobImgs = Object.values(_mobGlob);

const replicaRoot = "/assets/images/home";
const bioLines = Array.isArray(profileConfig.bio)
	? profileConfig.bio
	: profileConfig.bio
		? [profileConfig.bio]
		: [];
const primaryBio = bioLines[0] || siteConfig.description || "";
const displayName = profileConfig.displayName || profileConfig.name;

export const homeConfig = {
	avatar: "assets/images/avatar.webp",
	avatarOnWork: "assets/images/avatar.webp",
	avatarOffWork: "assets/images/avatar2.webp",
	name: profileConfig.name,
	displayName,
	nameBadge: siteConfig.title,
	occupation: profileConfig.occupation,
	bio: profileConfig.bio,

	hero: {
		backgroundImage:
			_deskImgs.length > 0 ? _deskImgs[0] : `${replicaRoot}/main/home.webp`,
		backgroundImageMobile:
			_mobImgs.length > 0
				? _mobImgs[0]
				: `${replicaRoot}/main/home-mobile.webp`,
		backgroundImagePool: _deskImgs.length > 0 ? _deskImgs : [],
		backgroundImageMobilePool: _mobImgs.length > 0 ? _mobImgs : [],
		speechAccentImage: `${replicaRoot}/main/home2-1.webp`,
		dialogue: {
			enabled: true,
			speakers: {
				host: "jojo",
				visitor: "访客",
			},
			menuTitle: "想看哪一块呀？",
			typingSpeed: 45,
			autoDelay: 1600,
			intro: [
				{ speaker: "host", text: "哇，有客人来啦！欢迎欢迎～" },
				{
					speaker: "host",
					text: `这里是 ${profileConfig.name} 的小站，技术、生活和喜欢的东西都收在里面～`,
				},
				{ speaker: "host", text: primaryBio },
				{
					speaker: "host",
					text: "想先看哪儿呀？点下面的小按钮，我带你逛！",
				},
			],
			topics: [
				{
					title: "认识一下",
					lines: [
						{ speaker: "visitor", text: "站长是谁呀？" },
						{
							speaker: "host",
							text:
								displayName === profileConfig.name
									? `是我呀，${profileConfig.name}！`
									: `是我呀，${profileConfig.name}！也可以叫我 ${displayName}～`,
						},
						{
							speaker: "host",
							text: profileConfig.occupation
								? `现在是 ${profileConfig.occupation} 哦！`
								: "现在嘛，算是半个技术博主～",
						},
						{
							speaker: "host",
							text: "写代码、写文章、看番，这三件事能让我待一整天～",
						},
					],
				},
				{
					title: "这里有什么",
					lines: [
						{ speaker: "visitor", text: "这里都放些什么呀？" },
						{
							speaker: "host",
							text: "技术笔记、好用的工具、ACG 相关的东西，还有生活里的小碎片！",
						},
						{
							speaker: "host",
							text: "首页有站点数据、文章导航和作品展示，往下滚还有超好看的演出哦～",
						},
						{
							speaker: "host",
							text: "别急着走嘛，下面还有好多好玩的，慢慢逛！",
						},
					],
				},
			],
		},
		rightPanel: {
			pill: "BLOG",
			title: "博客",
			diamond: "✦",
			microText: "システム起動完了",
		},
		rain: {
			enabled: true,
			intensity: 0.6,
			color: "255, 255, 255",
		},
	},

	dataLayer: {
		visitImage: `${replicaRoot}/main/home-data-1.webp`,
		archiveImage: `${replicaRoot}/main/home-data-2.webp`,
		contactImage: `${replicaRoot}/main/home-data-3.webp`,
		skillsImage: `${replicaRoot}/main/home-data-4.webp`,
	},

	displayLayer: {
		enabled: true,
		kicker: "作品展示",
		title: "CRYSTALLIZE GALLERY",
		description:
			"Where fleeting visions crystallize into permanence — each frame a frozen breath of time, each work a memory hardened into light.",
		scrollDistance: 4000,
		pillarFinalWidth: "18vw",
		emitterImage: `${replicaRoot}/portrait/td.webp`,
	},

	portfolioShutter: {
		enabled: true,
		kicker: "The End",
		title: "愿你每一天 都闪闪发光",
		description: "岁岁常欢愉，万事皆胜意",
		scrollDistance: 3000,
		finalImage: {
			midgroundImage: `${replicaRoot}/portrait/utl-back1.webp`,
			backgroundVideo: `${replicaRoot}/portrait/utl-back2.webm`,
			foregroundImage: `${replicaRoot}/portrait/utl-1.webp`,
			alt: "愿你每一天都闪闪发光",
		},
		interlude: {
			foreground: `${replicaRoot}/portrait/b-1.webp`,
			stripLeft: `${replicaRoot}/portrait/b-2.webp`,
			stripRight: `${replicaRoot}/portrait/b-3.webp`,
			copyLeft: "jojo",
			copyRight: "jojostar",
		},
		panels: [
			{
				title: "项目实践",
				english: "PROJECTS",
				description: "博客 · 工具 · 创意实验",
				image: `${replicaRoot}/portrait/1.webp`,
				alt: "项目实践",
			},
			{
				title: "技术学习",
				english: "LEARNING",
				description: "编程开发 · 技术随笔 · 踩坑记录",
				image: `${replicaRoot}/portrait/2.webp`,
				alt: "技术学习",
			},
			{
				title: "博客特色",
				english: "BLOG FEATURES",
				description: "文章索引 · 归档统计 · 生活记录",
				image: `${replicaRoot}/portrait/3.webp`,
				alt: "博客特色",
			},
			{
				title: "站点技术",
				english: "STACK",
				description: "Astro · Svelte · Tailwind CSS",
				image: `${replicaRoot}/portrait/4.webp`,
				alt: "站点技术",
			},
			{
				title: "相册收录",
				english: "PHOTO ALBUM",
				description: "日常照片 · 视觉收藏 · 灵感片段",
				image: `${replicaRoot}/portrait/5.webp`,
				alt: "相册收录",
			},
		],
	},

	skills: skillsConfig.items,
	links: profileConfig.links,
} satisfies HomeConfig;
