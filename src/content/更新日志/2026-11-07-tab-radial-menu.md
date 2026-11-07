---
version: "v6.21.0"
date: 2026-11-07
time: "23:59"
type: feature
description: 敲 Tab 键在鼠标处呼出径向导航轮盘，松开即跳转，从旧博客整体移植
---

## Tab 呼出导航轮盘

旧博客那个「按住 Tab 弹出轮盘、松开跳页」的交互搬过来了，桌面端全域可用。

- 按住 <kbd>Tab</kbd>：以鼠标位置为圆心弹出 12 个导航入口（主页 / 文章 / 动态 / 相册 / 导航 / 面经 / 图谱 / 书架 / 技能 / 音乐 / 留言板 / 关于），按钮顺时针依次弹出。
- 移动鼠标：自动吸附到最近的一项并反色高亮，当前所在页面另有一道深描边。
- 松开 <kbd>Tab</kbd>：跳到高亮项；什么都没吸附上就单纯收起。<kbd>Esc</kbd> 随时取消。
- 圆心 30px 内不选中，留给中心那颗玻璃圆；靠近屏幕边缘时会自动把轮盘推回视口内，窗口小则半径收缩、过窄直接居中。

### 与旧站不同、这次改掉的三处

- **输入框里放行 Tab**：搜索框、评论框、留言板等可编辑元素内保留浏览器原生的「切到下一个字段」行为，否则这些地方按 Tab 只能呼出轮盘、表格没法填。想恢复成旧站「一律拦截」，把 `tabRadialMenuConfig.ignoreEditable` 改成 `false`。
- **Shift+Tab 与 Ctrl/Alt/Cmd+Tab 放行**：旧版不分青红皂白一律 preventDefault，反向前进也会被当成呼出。
- **触屏设备不启用**：手机上既没有 Tab 键也没有 mousemove，用 `(hover: hover) and (pointer: fine)` 判定，命中不上的设备连键盘监听都不绑。

### 相关文件

- 组件：`src/components/features/TabRadialMenu.svelte`（Svelte 5 + 纯 CSS 过渡，没为它多引动画库）
- 配置：`src/config/tabRadialMenuConfig.ts`（菜单项、顺序、开关都在这，图标走 `lucide-svelte`）
- 类型：`src/types/config.ts` 的 `TabRadialMenuConfig` / `TabRadialMenuItem`
- 挂载：`src/layouts/Layout.astro`（`#swup-container` 之外，跨导航不重建）

在 `Layout.astro` 挂 `client:idle`，首屏不抢水合；换页后靠 `astro:page-load` 重新读 `pathname` 更新当前页高亮。
