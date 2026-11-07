---
version: "v6.19.0"
date: 2026-11-07
time: "21:14"
type: feature
description: 手机导航菜单新增低调的站长入口，登录后可直接管理内容和新建说说
---

## 手机端内容编辑入口

- 手机端资料卡不再显示登录按钮，普通浏览时页面保持原样。
- 手机底部 Dock 打开的菜单弹窗最底部新增低对比度“站长登录”，只有主动打开菜单才会看到。
- 登录后入口切换为“内容管理 / 新建说说 / 退出登录”，方便直接在手机上修改作品和说说。
- 打开登录弹窗或说说编辑器前会先关闭手机菜单，避免两个遮罩层叠在一起。
- 相关实现：`src/components/editor/EditorMobileMenuEntry.svelte`、`src/components/layout/MobileMenuSheet.astro`、`src/components/layout/MobileDock.astro`、`src/styles/components/editor.css`。
