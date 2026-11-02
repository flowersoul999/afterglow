import type { SponsorConfig } from "../types/config";

export const sponsorConfig: SponsorConfig = {
	// 页面标题，如果留空则使用 i18n 中的翻译
	title: "",

	// 页面描述文本，如果留空则使用 i18n 中的翻译
	description: "",

	// 赞助用途说明
	usage: "",

	// 是否显示赞助者列表
	showSponsorsList: false,

	// 是否在文章详情页底部显示赞助按钮
	// 关掉：还没有自己的收款码，避免文章底部出现空白的赞助入口
	showButtonInPost: false,

	// 赞助方式列表
	// 拿到自己的收款码后放进 public/assets/ziyuan/，再按下面格式加回来：
	// { name: "支付宝", icon: "fa7-brands:alipay", qrCode: "/assets/ziyuan/alipay.webp",
	//   link: "", description: "使用 支付宝 扫码赞助", enabled: true }
	methods: [],

	// 赞助者列表（可选）
	sponsors: [],
};
