import type { ProfileConfig } from "../types/config";

export const profileConfig: ProfileConfig = {
	// 头像
	// 图片路径支持三种格式：
	// 1. public 目录（以 "/" 开头，不优化）："/assets/images/avatar.webp"
	// 2. src 目录（不以 "/"开头，自动优化但会增加构建时间，推荐）："assets/images/avatar.webp"
	// 3. 远程 URL："https://example.com/avatar.jpg"
	avatar: "/assets/ziyuan/tx.webp",

	// 下班时间头像（为空则始终使用上方 avatar）
	avatarOffWork: "",

	// 名字
	name: "jojo",

	// 首页展示名字（留空则使用 name）
	displayName: "jojo",

	// 职业/身份标签
	occupation: "[技术博主 / 生活记录者]",

	// 个人签名（支持多条，会循环打字+删除效果）
	bio: ["愿你我在这里，都能抵达想去的地方"],

	// 链接配置
	// 已经预装的图标集：fa7-brands，fa7-regular，fa7-solid，material-symbols，simple-icons
	// 访问https://icones.js.org/ 获取图标代码，
	// 如果想使用尚未包含相应的图标集，则需要安装它
	// `pnpm add @iconify-json/<icon-set-name>`
	// showName: true 时显示图标和名称，false 时只显示图标
	// color: 品牌色，首页「订阅与联系」卡展开后用它给图标上色（--brand）。
	// 缺省时 CSS 会退回主题强调色 --guide-accent，所有图标糊成同一个颜色。
	// 取色参考参考站 my-blog/src/config/homeConfig.ts，避开近黑色 —— 那样在暗色主题下会糊进背景
	links: [
		{
			name: "GitHub",
			icon: "simple-icons:github",
			url: "https://github.com/flowersoul999",
			showName: false,
			color: "#1F6FEB",
		},
		{
			name: "Email",
			icon: "material-symbols:mail-outline",
			url: "mailto:3109581507@qq.com",
			showName: false,
			color: "#12B7F6",
		},
		{
			name: "Bilibili",
			icon: "simple-icons:bilibili",
			url: "https://space.bilibili.com/1395949329?spm_id_from=333.1387.0.0",
			showName: false,
			color: "#FB7299",
		},
	],
};
