---
version: "v1.65.1"
date: 2026-10-26
time: "17:05"
type: improvement
description: 分类详情页去掉左右侧栏，排版与文章列表页一致
---

## 分类详情页和文章列表页长得一样了

以前点进某个分类（`/categories/技术分享/` 这种），左右两边还挂着侧栏小组件，正文被挤在中间那一列，跟文章列表页 `/posts/` 是两种版式。

现在分类详情页**整栏隐藏左右侧栏**，内容区宽度也统一成 932px（和 `/posts/` 完全一致），分类名、标签筛选、文章卡片都居中排开。

涉及的都是已有机制，没有新增组件：

- `MainGridLayout.astro` 的 `NO_SIDEBAR_PAGE_TYPES` 加入 `"category"`
- `no-sidebar-pages.css` 里给 `data-no-sidebar="category"` 补了一条 932px 的宽度规则

侧栏的显隐仍然靠纯 CSS `:has()`（标记写在 Swup 容器内的 `#content-wrapper` 上），所以**从文章列表点进分类、或者用导航栏的分类下拉跳转，都不会闪一帧侧栏**。

移动端（<768px）本来就没有左右侧栏，两页行为一致，未受影响。
