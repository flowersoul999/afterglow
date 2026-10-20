---
version: "v1.64.6"
date: 2026-10-20
time: "23:47"
type: fix
description: 文章列表卡片 meta 合一行、竖杠与分类色加深、「共 N 篇文章」对齐修复
---

## 文章列表页三处样式修正（照参考站排版）

### 1. 卡片 meta 合成一行

原来分类+浏览量一行、日期+字数+标签一行，参考站是全一行。已把置顶卡、网格卡、列表行卡三处的两个
`meta-row` 合并成单行，顺序照参考站：**分类 → 浏览量 → 日期 → 字数 → 标签**（超长 flex-wrap 兜底）。
浏览量不再推到行尾，紧跟分类；`ArticleVirtualList.svelte` 模板 + `article-list.css` 的
`__meta` / `__card meta` 从 column 改 row。

### 2. 竖杠与分类色加深（浅色模式）

根因：`tokens/colors.css` 把参考站**暗色模式**的值用在了浅色——

| token | 本站浅色（错） | 参考站浅色（对） |
|---|---|---|
| `--article-title-marker` | oklch(0.78 0.15 190) | oklch(0.62 0.16 190) |
| `--article-category-lightness` | 0.75 | 0.42 |

本站浅色=参考站暗色、暗色又只覆盖了 pinned-accent。已照 `variables.styl:47-52` 改正：
浅色 0.62/0.42（竖杠深青、分类文字深色），暗色 0.78/0.75。

### 3. 「文章 共 N 篇文章」底部对齐

`.article-list-regular__title` 原是 `inline-flex`（竖杠+文字），flex 容器的基线取第一个
flex item（竖杠，无文字）的合成基线 = 竖杠底边，导致旁边 count 的基线被对到竖杠底、
视觉偏上。改成 `inline-block`（::before 用 `vertical-align: -0.08em` 微调），
h2 基线 = 文字基线，toolbar 的 `align-items: baseline` 现在是真正的文字基线对齐
（实测 title/count 底边差 1px）。
