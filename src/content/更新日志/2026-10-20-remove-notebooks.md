---
version: "v1.62.0"
date: 2026-10-20
time: "21:20"
type: removal
description: 下线笔记本页面（/life/notebooks/），私人笔记整体移出仓库
---

## 笔记本页面下线

站长要求私人笔记不再公开，`/life/notebooks/` 列表页与全部笔记本详情页整体移除，现在访问返回 404。

- **路由**：删除 `src/pages/life/notebooks/index.astro` 与 `[...slug].astro` 两个文件
- **集合**：`src/content.config.ts` 摘掉 `notebooks` 集合定义与注册项；`.pages.yml` 删掉「📔 笔记本索引」「📝 笔记本条目」两条 CMS 集合配置
- **入口**：顶部导航「笔记本」、移动端抽屉同名项、右下角悬浮球的「笔记」按钮、归档页的笔记条目、`page-type` 的 `notebooks-list` / `notebook` 两个页面类型全部清理
- **小组件**：`LifeStats`（笔记本数）、`RecentItems`（最近笔记）、`SiteStats`（笔记字数与最近活动日期）不再读取该集合
- **删除文件**：`NotebookCommentModal.svelte`、`NotebookComment.svelte`（早已无 import 的死组件）、`utils/notebook-chat.ts`、`types/notebook-chat.ts`、`styles/pages/notebooks.css`

## 笔记内容移出仓库

- `src/content/笔记本/` 的 **85 个文件（78 篇笔记 + 7 个 `_index.json`）**整体移到 `src/content/笔记本归档/`
- 该目录写进 `.gitignore`，**只留在本地 Obsidian 库继续写**，不再进 git（仓库是 PUBLIC，原来 md 原文在 GitHub 上所有人可读）
- 注意：git 历史里仍保留这些笔记，彻底清除需要重写历史，属单独决策

## 连带清理

- AstrBot BlogWriter 插件（独立仓库）同步摘除 `/笔记` 命令、笔记本向导、`_list_notebook_names` / `_ensure_notebook_index`、`build_note_md` / `build_notebook_index_json` / `parse_note` / `note_filename` 与 `default_note_dir` 配置 —— 否则它会把私人笔记继续 commit 进公开仓库
- 插件测试随之删减 14 例（139 → 125，全绿）
