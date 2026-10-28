---
version: "v1.64.0"
date: 2026-10-20
time: "22:55"
type: feature
description: /categories/ 换成四层知识图谱页（分类→标签→文章→小标题），删掉原来的分类标签三视图
---

## 旧的分类标签页下线

`/categories/` 原先是「文件夹 / 数据图」双视图的分类标签页（文件夹树 + 分类占比图 + 标签关系图），站长不需要了，整页换成知识图谱。

- **删除**：`src/pages/categories.astro` 的旧实现，连带只被它引用的三个组件
  `CategoryFolders.astro`、`CategoryRose.astro`、`TagGraph.astro` 与两个工具
  `utils/tag-graph-data.ts`、`utils/tag-graph-controller.ts`（共约 1700 行）
- **`src/styles/pages/categories.css`** 内容整体换掉（旧页的文件夹/占比图样式 → 图谱页的全屏外壳）
- 分类详情路由 `/categories/<路径>/` 不受影响，图谱里的分类节点正是跳到那里

## 复刻参考站的四层知识图谱

照 `https://tblog.mmzhiku.xyz/categories/` 复刻：**分类 → 标签 → 文章 → 文章内 H2 小标题** 四层力导向图，支持脑图布局切换、按层筛选、按分类筛选、关键词搜索、最少文章数滑块、标签共现连线、流动粒子、时间回放，点节点出详情面板。

### 新增文件

- `utils/knowledge-graph-data.ts`：纯函数构建器（无 Astro 依赖）
- `utils/graph/`：`index.ts`（挂载/缩放/命中测试）、`scene.ts`、`renderer.ts`、`simulation.ts`、`mindmap.ts`、`playback.ts`、`geometry.ts`、`types.ts`
- `utils/graph-dock-popover-controller.ts`：右侧 dock 筛选弹窗的定位与开合
- `components/widget/KnowledgeGraph.astro`、`GraphDock.astro`
- `styles/widgets/knowledge-graph.css`、`graph-dock.css`、`graph-detail-panel.css`
- `pages/api/knowledge-graph.json.ts`：图数据走独立端点（长缓存），页面只内联几百字节的 meta

### 三处必须本地化的差异

1. **分类不是 frontmatter 字段**：本站分类 = 文章所在目录（可能多级），一律用 `getCategoryFromId(entry.id)` 推导，不能照抄参考站的 `entry.data.category`
2. **没有标签归档页**：参考站的标签节点指向 `/tags/<slug>/`，本站标签链接统一走 `getTagUrl()` 的 `/archive/?tag=`
3. **没有 `definePageIsland`**：参考站的孤岛注册器本站没有，改成「挂 window 的单例 + `astro:page-load` 挂载 + swup `visit:start` 卸载」，每次挂载前先 `teardown()`，SPA 来回切不会叠加画布与监听器
4. **全屏页隐藏侧栏的选择器不同**：参考站的侧栏渲染在 `#left-sidebar-dynamic` / `#right-sidebar-dynamic`，本站实际在 `#left-sidebar-wrapper` / `#right-sidebar-static`（后者才是右侧卡片容器）。照抄 categories.css 的隐藏规则会漏掉右侧栏，卡片会浮在画布上；已补齐这两个 id

### 适配改动

- `siteConfig.pages` 与 `src/types/config.ts` 加 `categories` 开关；关闭时页面跳 404、数据端点返回 404
- 小标题锚点必须用 `render(entry)` 的 `headings`（rehype-slug 生成的 slug），不能自己用 github-slugger 复算
- 颜色 token 补 `--graph-chip-checked`、`--mobile-dock-surface`（图谱 dock 与移动端 dock 同底色）
- i18n 补 23 个键（`kg*` 系列 + `tagGraphPageTitle/Description`）到 `i18nKey.ts` 与 `languages/zh_CN.ts`
  （另 4 份语言文件站长同日已移除，站点是单语言 zh_CN）
