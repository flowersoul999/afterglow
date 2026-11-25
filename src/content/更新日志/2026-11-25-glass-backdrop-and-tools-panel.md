---
version: "v6.31.6"
date: 2026-11-25
time: "20:05"
type: feature
description: 旧博客的毛玻璃背景与成套预设色板搬回来了，主题和背景的切换入口统一收进导航栏工具面板
---

## 毛玻璃背景回归，主题和背景切换收进一处

- 新增毛玻璃背景层（`src/components/features/GlassBackdrop.astro`、`src/styles/base/glass-backdrop.css`）：窗口后景是半透模糊的柔光，不再是死板纯色。
- 成套预设色板落地（`src/styles/tokens/colors.css`、`src/utils/palette-controller.ts`）：配色方案一键切换，不用去翻主题设置。
- 导航栏工具面板统管主题与背景切换（`src/components/layout/Navbar.astro`、`src/utils/navbar-tools-panel.ts`）：桌面端从顶栏点开、手机端走悬浮坞，两边入口一致（`src/components/layout/UnifiedDock.astro`、`src/components/layout/MobileDock.astro`）。
