---
version: "v6.31.1"
date: 2026-11-25
time: "23:50"
type: fix
description: 首页访客与访问量恢复显示：Umami 读数接口前缀被首页大改改丢，重新改用 apiBase
---

## 首页「访客 / 访问量」恢复显示

首页站点数据卡片里的「访客」「访问量」又变成了 `--`。不是统计服务停了，而是读数接口地址在首页大改时被改回错误写法：代码拿上报脚本地址 `https://cloud.umami.is/script.js` 取 `origin`，拼出 `https://cloud.umami.is/api/share/...`，而 Umami Cloud 的读数接口实际挂在 `/analytics/us/api/...` 下，请求直接 404，前端只能显示占位符。这个问题 11-08 修过一次，`9b297bc` 移植参考站首页时又回归了。

### 改动

- `src/components/layout/HomeDataLayer.astro:216`、`src/components/layout/HomeMobile.astro:61`：桌面端与移动端统一改用 `siteConfig.analytics.umamiAnalytics.apiBase`（Cloud 场景自动带 `/analytics/us` 前缀），仅在缺配置时退回脚本地址并剥掉 `/script.js`；同时去掉尾斜杠，避免拼出双斜杠。
- `src/components/layout/HomeMobile.astro:351`：移动端不再把接口返回的 `null` 兜成 `0`，与桌面端一致显示 `--`，避免「没读到」被误认成「零访问」。
- `CLAUDE.md` §15 反模式清单新增该坑，防止第三次回归。
