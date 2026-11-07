---
version: "v6.21.2"
date: 2026-11-08
time: "00:25"
type: fix
description: 首页访问轨迹一直显示 0 的问题：Umami Cloud 的读数据接口在 /analytics/us 前缀下，且 null 不再伪装成 0
---

## 修复首页「访问轨迹」永远是 0

上线 Umami 后统计脚本一直正常上报，但首页数据卡片的 UV/PV 始终是 0。根因有三层，全部修掉：

- **接口前缀错位（主因）**：Umami Cloud 的上报脚本在 `https://cloud.umami.is/script.js`，读数据接口却在 `https://cloud.umami.is/analytics/us/api/…`。原代码拿脚本地址去拼 `/api/share/{id}`，Cloud 根路径下没有这个路由，直接 404，于是整条分享取数链路静默失败。
- **分享码缺失**：`PUBLIC_UMAMI_SHARE_ID` 从未注入，前端跳过了分享接口，退到构建时预渲染的 `/api/home-stats.json`（纯静态托管下它是一份永不更新的快照）。
- **null 被兜成 0**：`data.visitors ?? 0` 把接口返回的 `null` 变成了 `0`，把「没读到」伪装成「零访问」，所以断链三天都没被发现。

### 改动

- `src/config/siteConfig.ts` 新增 `apiBase`：Cloud 场景自动推导为 `{脚本地址}/analytics/us`，自托管时与脚本同根；也可用新增的 `PUBLIC_UMAMI_API_BASE` 显式覆盖。分享码补上默认值（公开信息，不是密钥），仍可用 `PUBLIC_UMAMI_SHARE_ID` 覆盖。
- `src/components/layout/HomeDataLayer.astro`：`data-umami-base` 改为传读数接口根路径；接口返回 `null`/缺字段时显示 `--` 与「统计未就绪」，不再显示 0。
- `src/types/config.ts`、`.env.example` 同步字段与注释。
