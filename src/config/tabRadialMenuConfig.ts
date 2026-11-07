import type { TabRadialMenuConfig } from "../types/config";

/**
 * Tab 呼出轮盘（2026-11-07 从旧博客 old-Jojo-blog 移植）
 *
 * 交互：按住 Tab → 鼠标位置弹出径向菜单 → 移动鼠标吸附最近项 → 松开 Tab 跳转 / Esc 取消。
 *
 * ⚠️ 这个功能会**全局拦截 Tab 键**（浏览器默认的焦点切换会被吃掉），
 * 所以 `ignoreEditable: true` 让输入框 / 文本域 / 可编辑区域仍保留原生 Tab 行为，
 * 否则搜索框、评论框里没法用 Tab 跳到下一个字段。改成 false 即「一律拦截」（旧站原样）。
 *
 * icon 取值见 `src/components/features/TabRadialMenu.svelte` 的 ICONS 映射表，
 * 必须是那里已登记的键（lucide-svelte 在 Svelte 里用，不能用 astro-icon 的图标名）。
 */
export const tabRadialMenuConfig: TabRadialMenuConfig = {
	enable: true,

	// 焦点在可编辑元素内时放行 Tab
	ignoreEditable: true,

	// 顺序 = 从正上方开始、顺时针排列
	items: [
		{ label: "主页", href: "/", icon: "home" },
		{ label: "文章", href: "/posts/", icon: "posts" },
		{ label: "动态", href: "/moments/", icon: "moments" },
		{ label: "相册", href: "/album/", icon: "album" },
		{ label: "导航", href: "/projects/", icon: "projects" },
		{ label: "面经", href: "/interview/", icon: "interview" },
		{ label: "图谱", href: "/categories/", icon: "categories" },
		{ label: "书架", href: "/books/", icon: "books" },
		{ label: "技能", href: "/skills/", icon: "skills" },
		{ label: "音乐", href: "/music/", icon: "music" },
		{ label: "留言板", href: "/life/guestbook/", icon: "guestbook" },
		{ label: "关于", href: "/about/", icon: "about" },
	],
};
