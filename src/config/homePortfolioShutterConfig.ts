export type HomePortfolioShutterPanel = {
	title: string;
	description: string;
	image: string;
	alt?: string;
};

export type HomePortfolioShutterConfig = {
	enabled: boolean;
	kicker: string;
	title: string;
	description: string;
	scrollDistance: number;
	finalImage: {
		src: string;
		alt: string;
	};
	panels: HomePortfolioShutterPanel[];
};

export const homePortfolioShutterConfig = {
	enabled: true,
	kicker: "The End",
	title: "2026年 加油！",
	description: "从想法到实现，每一行代码都是成长的痕迹。",
	scrollDistance: 4000,
	finalImage: {
		src: "/assets/images/home/portrait/utl.webp",
		alt: "2026年 加油！",
	},
	panels: [
		{
			title: "项目实践",
			description: "简历编辑器 · 视频管理后台 · 博客",
			image: "/assets/images/home/portrait/1.webp",
			alt: "项目实践",
		},
		{
			title: "AI学习",
			description: "Agent 编排 · 聊天机器人 · AI 生图学习",
			image: "/assets/images/home/portrait/2.webp",
			alt: "AI 学习",
		},
		{
			title: "博客特色",
			description: "RAG 知识检索 · 归档热力图 · 结构化知识库",
			image: "/assets/images/home/portrait/3.webp",
			alt: "AI 工具与机器人",
		},
		{
			title: "站点技术",
			description: "Astro · SSG静态生成 · 纯AI零手工",
			image: "/assets/images/home/portrait/4.webp",
			alt: "站点技术",
		},
		{
			title: "学习笔记",
			description: "源码精读 · 技术随笔 · 踩坑记录",
			image: "/assets/images/home/portrait/5.webp",
			alt: "学习笔记",
		},
	],
} satisfies HomePortfolioShutterConfig;
