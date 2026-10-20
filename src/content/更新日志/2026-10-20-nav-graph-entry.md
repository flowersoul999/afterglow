---
version: "v1.64.3"
date: 2026-10-20
time: "23:28"
type: improvement
description: 导航栏「分类」入口改名「图谱」并接入页面开关
---

## 导航入口跟进图谱页

上一版把 `/categories/` 换成了知识图谱页，但导航栏入口还叫「分类」，容易误会还指向旧的三视图页。

- **桌面导航**（`config/navBarConfig.ts`）：「文章」下拉里的「分类」改名「图谱」，图标换
  `material-symbols:hub-outline`（与参考站一致），并受 `siteConfig.pages.categories` 开关控制——
  关闭时导航项整个不渲染
- **手机抽屉**（`components/layout/MobileMenuSheet.astro`）：同步改名与开关控制
  （抽屉的 children 是硬编码的独立数据，不读 navBarConfig，必须两边都改）
- `constants/icons.ts` 重跑生成脚本，补入 `hub-outline` 的内联 SVG
- 分类详情路由 `/categories/<路径>/` 与首页顶部的分类胶囊栏不受影响；
  悬浮坞的「分类」按钮打开的是分类列表抽屉，也不是旧页面入口，保持原名
