---
version: "v1.64.6"
date: 2026-10-21
time: "00:12"
type: fix
description: 修复首页「订阅与联系」卡收起时点空白直接跳转（触屏 hover 模拟误触）
---

## 「订阅与联系」收起时点空白不再直接跳转

**现象**：卡片收起（图一，只有 QQ / GitHub 两个图标）时，点一下空白位置，没等展开（图二）就直接跳到了对应链接。

**原因**：展开层的显示条件是 `:hover / :focus-within / .is-open` 三选一，收起时只靠 `opacity: 0 + pointer-events: none` 隐藏。触屏 tap 会**先模拟 hover/focus 再派发 click**——藏在原位的隐形图标在同一发 click 里被点亮并接住点击，于是直接跳转，永远看不到展开态。

**修复**（`HomeDataLayer.astro` + `home-data-layer.css`）：

1. **JS 拦截**：卡片记录 `pointerdown` 的 `pointerType`；未展开时任何触摸产生的点击，即使落点上有一颗隐形图标，也 `preventDefault()` 改成展开。未展开时触摸点卡片空白 = 展开，展开后点图标 = 正常跳转。
2. **CSS 收紧**：展开层的 `:hover` / `:focus-within` 显示规则包进 `@media (hover: hover)`（只有真·鼠标设备才悬停预览，纯触屏一律走点击展开）；收起态追加 `visibility: hidden`（随 opacity 过渡），彻底不可交互、也移出 Tab 焦点序。
3. 点「+」按钮的切换由按钮自己的监听负责，卡片 handler 放行，避免双重切换。

**Playwright 触摸模拟验证**（dev server + `hasTouch`）：tap 收起态的隐形图标位置 → 不跳转、正常展开（opacity 1 / visible / pointer-events auto）；展开后再 tap 图标 → 正常跳转。`astro check` 0 错 0 警。
