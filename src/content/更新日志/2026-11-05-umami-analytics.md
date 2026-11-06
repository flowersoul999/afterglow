---
version: "v6.14.0"
date: 2026-11-05
type: feature
description: 接入 Umami 站点访问统计
---

## 接入 Umami 站点统计

- 网站布局已加载 Umami 统计脚本；默认使用 Umami Cloud，无需逐页粘贴代码。
- GitHub Actions 从仓库变量 `PUBLIC_UMAMI_WEBSITE_ID` 读取 Umami 网站 ID。
- 自托管 Umami 时，可通过 Secret `PUBLIC_UMAMI_BASE` 指定服务地址。
