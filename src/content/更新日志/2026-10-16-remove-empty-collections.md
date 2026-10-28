---
version: "v1.61.0"
date: 2026-10-16
time: "18:30"
type: removal
description: 移除长期空置的 账单/日程/应用 三个集合及其孤儿组件，dev 构建告警清零
---

## 摘除三个空集合

`/bills/`、`/schedules/`、`/apps/` 的路由与导航入口此前已删除，但集合定义、内容目录和组件一直留着，
导致每次 dev/build 都刷三条 `glob-loader: No files found matching ...` 告警。本次补齐那次删除：

- `src/content.config.ts`：移除 `bills`、`schedules`、`apps` 三个集合（15 → 12 个集合）
- 删除空内容目录 `src/content/账单`、`src/content/日程`、`src/content/应用`（原本只剩 `.gitkeep`）
- 删除无引用的孤儿代码：`src/components/bills/`（8 个卡片组件）、`src/components/schedules/`（3 个）、
  `src/utils/bill-adapter.ts`、`src/utils/schedule-adapter.ts`
- 同步：`SiteStats.astro` 去掉账单取数（最近活动日期不再计入账单）、`page-type.ts` 去掉三个页面类型、
  `.pages.yml` 删除对应后台入口（友链分组标签改为「🔗 友链」）
- 文档：CLAUDE.md / AGENTS.md 的集合数与目录清单同步；`docs/astrbot-contract.md` 标注废弃

> 说明：这三个集合本就没有任何展示页面，删除不影响站点任何功能与统计口径（账单统计此前恒为 0）。
> 若日后要重建账单/日程，可从 git 历史 `src/content/schedules/**` 取回内容与集合定义。
