---
version: "v6.31.0"
date: 2026-11-25
time: "23:00"
type: feature
description: 灵动岛整套换成参考站源码，恢复本站原有的背景与配色选择，并把目录方块卡片改成轻列表卡片
---

## 顶部导航不再自己手搓，直接搬参考站的 DynamicIsland

按「有源码就别自己开发」的要求，把参考站灵动岛整套搬进本站：

- `DynamicIsland.astro` / `ProfileCardSiteAvatar.astro`
- `dynamic-island-controller.ts`（展开、拖拽、液态路径、面板、音乐面同步）
- `island-physics.ts` / `island-pet.ts`
- `dynamic-island.css`（保持参考站原版）

它挂在 `Layout.astro` 的 Swup 容器外，跨页面常驻；桌面端由 CSS 隐藏旧 `#navbar` 三段，
移动端仍走原有抽屉。之前那套手写的 `navbar-di` 音乐面、切换按钮与
`navbar-dynamic-island.ts/css` 已全部删除。

构建期只做接口适配：本站公告是单条 `content`、分类由 `getCategoryFromId()` 推导、
封面图用 `widths/sizes`、头像取 `profileConfig.avatar`，并补上 `/api/allPostMeta.json`
供热力图读取。

## 原来的主题选项回来了

灵动岛设置面板在「主题（亮 / 暗 / 跟随系统）」下面补回本站原有的两行：

- **背景**：暖纸 / 毛玻璃 / 黑白，复用 `setBackdropStyle()`
- **配色**：默认 / 春暖 / 秋实 / 晴空 / 夜深 + 随机，复用 `applyPalette()`

两处都与移动端菜单、旧工具面板共用 localStorage 与自定义事件，切换后选中态会同步；
面板高度由灵动岛控制器按内容自动撑开。

## 方块卡片换成轻列表卡片

目录子菜单原来是大灰方块 + 右下角水印图标，现在改成圆角横条：左侧小图标徽章、
中间名称、右侧箭头，悬停轻微上浮并高亮边框。参考站 CSS 不动，本站样式统一放在
`src/styles/layout/dynamic-island-local.css`，方便以后继续换皮。

## 验证

- `pnpm check`：0 errors；`pnpm build`：149 pages built
- 浏览器实测：收起态、展开态、目录下拉、设置面板、音乐面均正常
- 点击「毛玻璃」与「春暖」后 `<html data-backdrop="glass" data-palette="spring">`、选中态同步
