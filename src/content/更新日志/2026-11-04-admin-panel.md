---
version: "v6.12.0"
date: 2026-11-04
time: "16:20"
type: feature
description: 站内后台：一个三栏界面管文章、说说和更新日志，不用再回本地开编辑器
---

## 为什么做

上一版只能改说说。想动一篇文章还是得：打开 VS Code、翻到 `src/content/文章/<分类>/`、手改 frontmatter、commit、push。说说是随手记，一篇真正的文章要斟酌半小时，往返这一趟很破坏状态。

所以补一个真正能干活的后台：`/admin`。左边选集合，中间选条目，右边改内容，提交就完事。

## 怎么用

1. 直接开 <https://jojocode.cn/admin>（站点上没放入口，也不进 sitemap）
2. 未登录时是一张登录卡，点「使用 GitHub 登录」，回来就是后台
3. 左栏切集合：文章 / 说说 / 更新日志
4. 中栏选条目，右栏编辑，顶部「提交」就是一次 commit

登录后资料卡里会多一个九宫格圆钮，点它也能进后台。

⚠️ **这次 Worker 加了新接口 `GET /api/github/tree`**，不重新部署的话后台列表会拉不到东西（只有登录能用）。把 `cloudflare-worker/index.js` 全文重新粘一遍再 Deploy 即可。

表单和正文是分开的：上面是结构化字段（标题、日期、标签、开关），下面是 Markdown 正文。点「预览」能看渲染后的样子。

## 三个刻意的取舍

**列表只读文件名，不读内容。** 面经有 108 篇，逐篇拉 frontmatter 就是 108 次请求。文件名本身是给人看的（面经带序号、说说带日期），真实标题等打开再显示。

**frontmatter 保序保留。** 不是「解析成对象再序列化」——那样字段会重排、注释会消失、不认识的字段会被吃掉，每次保存都制造一整片 diff。这里把 frontmatter 拆成有序 entry，没改过的原样写回。实测 26 个文件（文章 + 面经 + 说说）解析再序列化**逐字节一致**，改个标题只动那一行。

**分类由文件夹决定，新建时才能改。** 已有的文章不能改分类 —— 那等于移动文件，得连带处理路由和链接，属于另一个量级的事。

## 顺带修的坑

说说的抽屉一直有条 bug：登录后点「+」，抽屉只显示一条标题栏，表单整个塌掉。

根因不是样式写错，是**导航栏把 fixed 层困住了**：`#navbar-wrapper` 滚动时会被加上 `.navbar-visible`（`transform: translateY(0)`），而带 transform 的元素会成为内部 `position: fixed` 后代的 containing block —— 抽屉的 `inset: 0` 就不再是视口，而是那条 54px 高的导航条。

修法两条一起上：`EditorRoot` 从 `Navbar.astro` 挪到 `MainGridLayout.astro`、挂在 wrapper 外面；抽屉层尺寸改用 `100vw / 100dvh`（不依赖 containing block）兜底。

## 文件

- `src/pages/admin.astro` — 后台路由，静态 shell，不含任何内容
- `src/components/admin/AdminApp.svelte` — 三栏骨架与状态
- `src/components/admin/AdminList.svelte` — 条目列表
- `src/components/admin/AdminEditor.svelte` — 表单 + Markdown 编辑 + 预览
- `src/config/admin-collections.ts` — 集合配置表（加集合只改这里）
- `src/utils/editor/content-serializer.ts` — 通用 frontmatter 读写
- `src/utils/editor/content-repo.ts` — 列目录、路径生成、冲突重试
- `src/styles/pages/admin.css` — 全部样式
- `cloudflare-worker/index.js` — 新增 `GET /api/github/tree`

## 还欠着的

- 图片上传（还是只能贴 URL，图床得手动传）
- 面经的批量能力（108 篇，需要排序、批量改标签这类工具）
- 草稿分支（现在 `draft: true` 只影响展示，照样触发构建）
