---
version: "v6.28.0"
date: 2026-11-25
time: "22:30"
type: feature
description: 站尾换成手绘 Doodle Crew 大字舞台，整屏宽、带会动的小人和飘落涂鸦
---

## 站尾终于有「收尾」的样子了

以前底部只有一行居中版权。现在换成整屏宽的手绘站尾：四列导航 → 巨型 `JOJOSTAR` 舞台
（六个小家伙站在 / 坐在字母上，眼睛会跟着光标转、会眨眼、点一下会跳）→ 飘落涂鸦 →
文案逐字出现 → 两枚胶囊按钮。

- **组件**：`src/components/layout/DoodleCrewFooter.svelte` + `src/components/layout/doodle-crew-footer/`
  （engine 负责排版 / 物理 / 时间线，两个 Svelte 子件画角色与涂鸦）；样式在
  `src/styles/components/doodle-crew-footer.css`。基于 dumplingandcakeblog 的开源实现移植。
- **内容全在配置里**：`src/config/footerConfig.ts` 改 `wordmark` / `brand` / `blurb` / `tagline` /
  `columns` / `actions` / `crew` / `doodles` 即可，不用碰组件。角色的 `letter` 是巨型字里的
  字母下标（从 0 开始），当前 8 个字母对应 6 个角色。
- **整屏宽**：`MainGridLayout.astro` 把 Footer 移出 `#main-grid` 和 `max-w` 容器，内容由 `.dcf`
  自己按 `--page-width` 居中；`data-site-footer` 保留给右侧目录做钳制参考。
- **兼容旧配置**：`socialLinks`（灵动岛铭牌页用）与 `enable` / `customHtml` 字段仍在；
  `FooterConfig.html` 不再被读取，文件留作历史记录。
- **动效**：进视口才开始分镜，尊重 `prefers-reduced-motion`；RSS 链接带 `data-no-swup`，
  避免被 Swup 当页面接管。
