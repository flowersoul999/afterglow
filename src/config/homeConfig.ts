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
		// 参考站首屏视觉：飘浮照片拼图 + 波浪网格 + 熔化艺术字
		// 布局参数沿用参考站的动画节奏，文案与图片按本站内容适配
		mosaic: {
			rows: 4,
			columns: 6,
			idleVisible: 6,
			seed: 20260814,
			initialLayout: [
				{ x: 0.14, y: 0.305, width: 0.104, height: 0.205 },
				{ x: 0.435, y: 0.18, width: 0.068, height: 0.13, blur: 5.5 },
				{ x: 0.642, y: 0.368, width: 0.047, height: 0.092, blur: 5 },
				{ x: 0.863, y: 0.402, width: 0.097, height: 0.19 },
				{ x: 0.337, y: 0.653, width: 0.159, height: 0.313 },
				{ x: 0.639, y: 0.751, width: 0.116, height: 0.228 },
			],
			scrub: 0.45,
			desktopScrollDistance: 3250,
			mobileScrollDistance: 2300,
			desktopDialogueTailDistance: 240,
			mobileDialogueTailDistance: 180,
			desktopMinViewports: 4.05,
			mobileMinViewports: 3.05,
			interactionHold: 0.06,
		},
		contact: {
			// 首屏右下角的熔融字水印：上一行小字、下一行大字，都是自由文本
			// （2026-11-26 由「B站：jojo」改为站内 slogan，需要挂链接时再补 href）
			platform: "keep",
			handle: "reading",
		},
		sticker: {
			image: "/assets/images/home/doll.avif",
			alt: "黑猫角色贴纸",
			sounds: {
				press: "/assets/doll-press.mp3",
				loosen: "/assets/doll-loosen.mp3",
			},
		},
		photo: {
			main: {
				image: "/assets/images/home/home.avif",
				author: "by 冰冰坚老师",
			},
			overlay: {
				image: "/assets/images/home/home2.avif",
				author: "by 冰冰坚老师",
			},
			intro: {
				direction: "这里记录技术、代码与生活里值得留下的东西",
				hobby: "爱做些没人用的小组件，也收藏好看的 AI 绘画",
				bio: primaryBio,
			},
		},
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
			// 参考站版式：点击左下角角色逐句弹出的气泡台词
			lines: [
				"欸——来客人了喵～随便坐，别客气。",
				`我是喵墩，${profileConfig.name} 在摸鱼，这儿归我管了喵～`,
				"整站基本是 AI 搓出来的，他喵爪都没动几下，还搁那儿邀功喵。",
				"角落里藏着不少彩蛋，站点还热乎着，刚出锅的，小心烫爪喵。",
				"感兴趣可以加 QQ 群喵，放心，傻爸爸不咬人的。",
			],
			enabled: true as boolean,
			speakers: {
				host: "jojo",
				visitor: "访客",
			},
			menuTitle: "想看哪一块呀？",
			typingSpeed: 45,
			autoDelay: 1600,
			intro: [
				{ speaker: "host", text: "外面在下雨呢，进来躲一会儿吧。" },
				{
					speaker: "host",
					text: `这里是 ${profileConfig.name} 的小站，技术、生活，还有一堆舍不得删的东西。`,
				},
				{ speaker: "host", text: primaryBio },
				{
					speaker: "host",
					text: "想先去哪儿？下面挂着两块小牌子，点一下就行。",
				},
			],
			topics: [
				{
					title: "认识一下",
					lines: [
						{ speaker: "visitor", text: "这儿的站长是谁？" },
						{
							speaker: "host",
							text:
								displayName === profileConfig.name
									? `是我呀，${profileConfig.name}。`
									: `是我呀，${profileConfig.name}，也可以叫我 ${displayName}。`,
						},
						{
							speaker: "host",
							text: profileConfig.occupation
								? `现在是 ${profileConfig.occupation}。`
								: "现在嘛，算是半个技术博主。",
						},
						{
							speaker: "host",
							text: "写代码、写文章、看番，这三件事能占满一整天。",
						},
					],
				},
				{
					title: "这里有什么",
					lines: [
						{ speaker: "visitor", text: "这儿都放了些什么？" },
						{
							speaker: "host",
							text: "技术笔记、顺手做的小工具、ACG，还有生活里掉下来的碎片。",
						},
						{
							speaker: "host",
							text: "首页有站点数据、文章导航和作品墙，往下滚还有一整段演出。",
						},
						{
							speaker: "host",
							text: "雨还没停，慢慢逛，别急着走。",
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

	// 参考站桌面端影像叙事层
	homeBlinds: {
		enabled: true,
		reveal: {
			backgroundImage: "/assets/images/home-blinds/act1/1.webp",
			headline: {
				title: "祝愿各位",
				messages: ["夜路有星光", "岁岁皆欢愉", "所念皆星河", "版本无回滚"],
				enterDuration: 0.6,
				messageHold: 2.6,
				messageFlipDuration: 0.75,
			},
		},
		scenes: {
			scrollDistance: 3400,
			marquee: {
				tapes: [
					{
						text: "江城如画里，山晚望晴空，两水夹明镜，双桥落彩虹。人烟寒橘柚，秋色老梧桐。谁念北楼上，临风怀谢公。",
						angle: -66,
						top: 50,
						centerX: 37.5,
						thickness: 92,
						speed: 120,
					},
					{
						text: "雾景澄秋，一晚风吹尽朝来雨。夕阳烟树，万里山光暮",
						angle: 37,
						top: 50,
						centerX: 62.5,
						thickness: 74,
						speed: 88,
					},
					{
						text: "年年岁岁花相似，岁岁年年人不同",
						angle: -8,
						top: 87.5,
						centerX: 50,
						thickness: 88,
						speed: 104,
					},
				],
			},
			bubbleMessages: [
				{ text: "Token来", weight: 5 },
				{ text: "年更型站长", weight: 4 },
				{ text: "我来看看怎么个事", weight: 4 },
				{ text: "主打一个随缘更新", weight: 3 },
				{ text: "活人感拉满", weight: 3 },
				{ text: "站长，博客开源吗", weight: 3 },
				{ text: "爱你，站长", weight: 3 },
				{ text: "别熬夜了", weight: 3 },
				{ text: "刚出锅，趁热看", weight: 2 },
				{ text: "已收藏，下次一定看", weight: 2 },
			],
			commentBubble: {
				enabled: true,
				weight: 4,
			},
			composite: {
				title: "筑一间小屋",
				description: "以代码为梁、热爱为瓦，荒原上筑起一间自己的小屋。",
				alt: "第一幕插画",
				date: "2026 / 05 / 07",
			},
			items: [
				{
					title: "小屋落户",
					description: "一纸备案落定，小屋自此有门有牌，堂堂正正晒着太阳。",
					image: "/assets/images/home-blinds/act2/1.webp",
					alt: "第二幕插画",
					date: "2026 / 06 / 10",
				},
				{
					title: "尘满窗台",
					description: "人往学海拾新，倦意悄悄落了窗，小屋静候，蒙上薄尘。",
					image: "/assets/images/home-blinds/act2/2.webp",
					alt: "第三幕插画",
					date: "2026 / 06 / 21",
				},
				{
					title: "重燃灯火",
					description: "拂去薄尘，重燃灯火，一砖一瓦再把小屋细细打磨。",
					image: "/assets/images/home-blinds/act2/3.webp",
					alt: "第四幕插画",
					date: "2026 / 08 / 18",
				},
				{
					title: "抵达之前",
					description: "笔墨暂歇，来日方长；下一程山水，且歌且行。",
					image: "/assets/images/home-blinds/act2/4.webp",
					alt: "第五幕插画",
					date: "2026 / 09 / 01",
				},
			],
			standImages: [
				"/assets/images/home-blinds/act2-doll/1.gif",
				"/assets/images/home-blinds/act2-doll/2.gif",
			],
		},
	},

	skills: skillsConfig.items,
	links: profileConfig.links,
} satisfies HomeConfig;
