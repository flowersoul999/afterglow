---
version: "v6.31.10"
date: 2026-11-25
time: "23:55"
type: fix
description: 首页「订阅与联系」图标恢复品牌色：链接配置补上 color 字段，不再全部回退成主题强调色
---

## 首页「订阅与联系」图标恢复品牌色

首页四张导览卡里，「订阅与联系」那张展开后，GitHub / Email / B站 三个图标全都是同一个黄绿色，和参考站那种每个平台一个品牌色的观感差很远。

### 根因

不是样式没写，也不是组件没挂载，而是**配置里少了一个字段**。

`HomeGuideArt.astro` 渲染图标时会把 `link.color` 写成 CSS 变量 `--brand`，`home-data-layer.css` 再用 `color: var(--brand, var(--guide-accent))` 取值 —— 有品牌色就用品牌色，没有就退回主题强调色。而 `src/config/profileConfig.ts` 的 `links` 数组里**从来没配过 `color`**（`git log -S'color:' -- src/config/profileConfig.ts` 零结果），于是 `--brand` 永远不存在，三个图标全部糊成同一个 `#b8ff1f`。

顺带说明：`ProfileConfig.links` 的类型里本来就有 `color?: string`，但首页走的是 `HomeConfig.links`，那个类型**没有** `color` 字段 —— 配置契约本身也是断的。

### 改动

- `src/config/profileConfig.ts`：三条链接各补 `color` 字段，取色沿用参考站 `my-blog/src/config/homeConfig.ts` 的原始配色（GitHub `#1F6FEB`、邮件 `#12B7F6`、B站 `#FB7299`），并加注释说明该字段的用途与缺省后果。
- `src/types/config.ts`：`HomeConfig.links` 补上 `color?: string`，与 `ProfileConfig.links` 对齐。

### 验证

- `pnpm check`（astro check）0 errors / 28 hints。
- 亮色与暗色主题下实测：展开后三个图标的计算色分别为 `rgb(31,111,235)` / `rgb(18,183,246)` / `rgb(251,114,153)`，均为各自品牌色，不再是统一黄绿；暗色主题下背景 `oklch(0.18 0 0)`，图标对比度充足不糊。
- 浏览器实测展开态 `data-guide-expanded="contact"` 正常置位，全程无 504、无 pageerror。
