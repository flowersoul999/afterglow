import type { FriendsPageConfig } from "../types/config";

// 可以在src/content/spec/friends.md中编写友链页面下方的自定义内容

// 友链页面配置
export const friendsPageConfig: FriendsPageConfig = {
	// 显示列数：2列或3列
	columns: 2,
};

// 提示：友链数据已迁移到 src/content/friends/ 目录下
// 每个 .md 文件代表一个友链，通过 frontmatter 配置：
// - title: 友链标题
// - imgurl: 头像图片URL
// - desc: 友链描述
// - siteurl: 友链地址
// - tags: 标签数组（可选）
// - weight: 权重，数字越大排序越靠前（可选，默认0）
// - enabled: 是否启用（可选，默认true）
