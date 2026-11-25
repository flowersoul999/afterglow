---
version: "v6.27.0"
date: 2026-11-25
time: "15:45"
type: feature
description: 背景风格变成可切换的两套：暖纸和原来的黑白并存，桌面悬浮坞和手机菜单里点一下就能换
---

## 背景有了两档，可以来回切

昨天的暖纸（v6.24.0）是直接改造亮色主题 —— 底色换掉就换掉了，回不去。站长看了之后补了一句：
「保留之前的黑白主题，这次新增的主题可以来回切换」。

所以这次落地的不是「再改一次颜色」，而是把亮色拆成**两套并存的令牌**，用 `<html data-backdrop>` 切：

| 风格 | 亮色 | 暗色 |
|------|------|------|
| `warm` 暖纸（默认） | 奶油米白底 + 三团淡柔光 + 深褐黑字 | 纯黑 |
| `classic` 黑白 | 纯白 + 零色度灰阶（本站最初的样子） | 纯黑 |

⚠️ **暗色两套共用同一份令牌**，所以切到暖纸在暗色下看不出变化 —— 这是站长明确要求的，
不是没生效。

### 在哪切

- **桌面**：右下角悬浮坞点「⋯」展开，新增的「背景」按钮（调色板图标）就在「主题」上面。
  当前是黑白时图标换成对比度那个，一眼能看出现在在哪一档。
- **手机**：底栏只有 5 个位，加第 6 个在 375px 屏上会溢出
  （5 普通 48 + 中心 80 + 间距 ≈ 382px > 94vw），所以放在**菜单抽屉底部**一行「背景风格」，
  右侧实时显示当前是「暖纸」还是「黑白」。

两处共用 `localStorage.backdropStyle` 和 `<html data-backdrop>`，在哪边切另一边都会同步
（换页重绑时重新读属性，Swup 不会丢状态）。

## 暖纸那一档改了什么

和 v6.24.0 一致，不是简单把底色调黄 —— 纯中性灰压在米色底上会因同时对比读作「冷灰」，
文字和卡片会显脏。所以整条灰阶一起挪：

- 底色 `oklch(1 0 0)` → `oklch(0.979 0.011 82)`
- 正文 `--deep-text` 从近纯黑 `0.10` 提到 `0.145`，并带上色相 65 的深褐
- 分隔线、边框、代码块底、悬停底、导航胶囊、目录按钮，色度统一控在 `0.010~0.016`，
  色相锁在 `65~82`

色度刻意不超过 0.02：再往上就从「温度」变成「脏黄」了。

柔光仍由 `styles/base/ambient-backdrop.css` 铺三层 `radial-gradient`（暖杏左上 / 薄荷右上 /
藕紫右下），圆心全在视口外，只让边缘渗进来。

## 实现要点

- **一个属性切整个站**：所有颜色都是 CSS 变量，`data-backdrop` 一变，令牌组整组替换，
  不需要重新渲染任何 DOM，也不会闪。
- `:root[data-backdrop="warm"]:not(.dark)` —— `:not(.dark)` 是必须的：`:root.dark` 与本块
  特异性都是 `0,2,0`，靠它把两套彻底隔开，否则暗色会被暖纸覆盖。
- **首帧不闪**：`<html>` 上的默认值由 Astro 服务端直接渲染（`siteConfig.themeColor.backdrop`），
  `Layout.astro` 的 `<head>` 内联脚本再按 localStorage 覆盖一次，两步都在首次绘制前完成。
- localStorage 只认 `warm` / `classic` 两个值，脏数据自动落回默认。
- 环境光的生成条件从三条独立规则收敛成一条选择器：
  `html[data-backdrop="warm"]:not(.dark) body:not([class~="lg:is-home"])::before`，
  三个条件（暖纸 / 非暗色 / 非首页）写死在一处，不会再出现「改了 token 忘了删规则」。

## 顺手收掉的三处「冷白」

页面一变暖，原本没色相的白块就显出来了：

1. `WidgetLayout.astro` 的侧栏卡片硬编码 `background: #fff` → `var(--float-panel-bg)`
   （classic 下就是纯白，与原来完全一致），描边也从 `rgba(0,0,0,.08)` 换成深墨的低透明度。
2. `post-hero.css` 的文章开头信息面板（AI 摘要 / 封面图那张卡），局部变量 `--intro-surface-bg`
   提到 `tokens/colors.css` 统一给，两套背景各自一份 —— 之前它写死在组件里，切换不会跟着变。
3. `mobile-menu-sheet.css` 的手机菜单抽屉底色 `#ffffff` → `var(--float-panel-bg)`
   （暗色走自己的 `:root.dark`，没动）。

## 调参入口

- 光晕强弱 / 颜色：`tokens/colors.css` 里 `[data-backdrop="warm"]` 那块的
  `--ambient-warm / --ambient-mint / --ambient-violet`，透明度 `0.3~0.7` 之间调。
- 默认风格：`src/config/siteConfig.ts` 的 `themeColor.backdrop`（`"warm"` 或 `"classic"`）。
- 底色想更黄就调 `--page-bg` 的 chroma（现在 `0.011`），别超过 `0.02`，过线就变脏黄。

## 验证记录

用 CDP 真实点击跑过一轮：初始 `data-backdrop="warm"`、背景 `oklch(0.979 0.011 82)`、
`body::before` 有渐变 → 点击后变 `classic`、背景 `oklch(1 0 0)`、`::before` 为 `none`、
localStorage 写入 `classic` → 再点变回 `warm`。另用 1440 / 375 两个宽度截图确认桌面坞与
移动底栏布局正常，抽屉里的「背景风格」一行也同步显示当前档位。
