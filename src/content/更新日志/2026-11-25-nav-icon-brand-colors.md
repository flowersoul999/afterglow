---
version: "v6.31.5"
date: 2026-11-25
time: "18:17"
type: improvement
description: 网站导航页的卡片图标按各站点品牌色着色，不再是一整屏黑白
---

## 导航卡片图标按品牌色着色

- 新增品牌色映射表（`src/data/navIconColors.ts`），按站点域名匹配对应品牌色。
- 导航页卡片图标从统一黑白改成各自品牌色，扫一眼就能认出 B 站、GitHub 等站点（`src/pages/projects.astro`）。
