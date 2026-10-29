---
version: "v6.7.0"
date: 2026-10-29
time: "17:55"
type: feature
description: 新增「面经」独立板块，108 篇八股文与博客文章彻底分离
---

## 面经板块独立成站（/interview/）

博客新增第二个内容板块「面经」，与「文章」完全分离：不再出现在文章列表、分类页、归档页与 RSS 中，有独立入口与独立分类树。

- **入口**：导航栏「面经」→ `/interview/`，按「大类 → 子分类」两张卡片层级展示，点进子分类看题目列表，再点进单题阅读。
- **内容**：`src/content/面经/八股文/{智能体, 检索增强, 大模型, 工具调用, 项目实战}/`，共 108 篇。集合键 `interview`（见 `src/content.config.ts`）。
- **以后加新大类不用改代码**：在 `src/content/面经/` 下新建文件夹（如 `算法/动态规划/`）放入 Markdown 即可，首页会自动多出一个大类区块。分类树逻辑在 `src/utils/interview-tree.ts`。
- **路由**：`/interview/` 首页、`/interview/八股文/智能体/` 列表、`/interview/八股文/智能体/01-xxx/` 详情，三种页面由 `src/pages/interview/[...path].astro` 统一分发，视图在 `src/components/pages/interview/`。
- **阅读体验**：单题页带「第 01 题」编号、日期、字数、上一篇/下一篇（同子分类内按题号排序）与右侧目录面板；mermaid 脑图与折叠块照常渲染。

## 顺带修复：中文文章字数一直显示「0 字」

`src/plugins/remark-reading-time.mjs` 原先用 `reading-time` 库统计字数，而该库按**空格分词**数英文单词——中文正文没有空格，整段被算成 1 个词，于是列表卡片长期显示「0 字」。

现在中文按「字」单独计数，阅读时长按中文 300 字/分钟、英文 200 词/分钟分别折算后相加。实测一篇面经显示 4,290 字（原先为 0）。

## 目录变更

- 新增 `src/content/面经/`（需在 `.gitignore` 里放行：`!src/content/面经/`，该文件默认忽略 `src/content/*/` 下所有目录）
- 新增 `src/pages/interview/`、`src/components/pages/interview/`、`src/utils/interview-tree.ts`、`src/styles/features/interview.css`
- `src/config/navBarConfig.ts` 新增「面经」导航项
