---
version: "v6.28.0"
date: 2026-11-25
time: "18:10"
type: feature
description: 站长后台换上深空星尘主题：星尘粒子、看板娘小曜、流光顶栏与撒花提示
---

## 后台换上深空星尘皮肤

- `/admin` 从纯白极简面板改成深空紫金控制台，三栏数据逻辑一行没动。配色集中在 `src/styles/pages/admin.css:2229` 的 `.admin` 作用域令牌里，编辑器、状态板、待提交队列自动跟着变。
- 背景加了 canvas 星尘（按视口面积算 24~72 颗，`src/components/admin/AdminStarfield.svelte`）；顶栏有循环流光带，左侧集合选中时光刃扫过，条目卡片 hover 上浮并依次入场。
- 右侧空白区住进原创看板娘「小曜」（`src/components/admin/AdminMascot.svelte`），会浮动、眨眼、随鼠标轻微视差；`prefers-reduced-motion` 下自动静止。
- 中栏新增「当前条目 / 本月新增」统计小卡，只看文件名日期，不额外读任何 frontmatter（见 CLAUDE.md 第 24 节约定）。
- 保存、删除、批量提交成功时弹星星撒花，纯 CSS 动画不引第三方库（`src/components/admin/AdminApp.svelte` 的 `notify()`）。
