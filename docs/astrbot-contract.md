# AstrBot 写入契约（bills / schedules）

> ⚠️ **已废弃（2026-10-16）**：`bills` / `schedules` 两个集合连同 `/bills/`、`/schedules/`、`/apps/` 路由已彻底移除（`src/content/账单`、`src/content/日程`、`src/content/应用` 目录一并删除）。本文仅作历史存档，勿再按此实现。

> Phase1 为静态契约：机器人往 `src/content/bills` 与 `src/content/schedules` 按本规范追加 Markdown，`pnpm build` 后即在 `/bills` 与 `/schedules` 可见。Phase2 再补增量刷新。

## bills

- 路径：`src/content/bills/YYYY-MM-DD-{slug}.md`
- frontmatter（与 `src/content.config.ts:billsCollection` 对齐）：
  - `title?: string`
  - `amount: number`（收入正，支出负）
  - `type: "income"|"expense"|"transfer"`（默认 expense）
  - `category: string`（默认 其他）
  - `account: string`（默认 其他，如 微信/支付宝/银行卡）
  - `date: Date`（YYYY-MM-DD 或 ISO）
  - `description?: string`
  - `tags?: string[]`

## schedules

- 路径：`src/content/schedules/YYYY-MM-DD-{slug}.md`
- frontmatter（与 `src/content.config.ts:schedulesCollection` 对齐）：
  - `title: string`
  - `date: Date`（开始时间）
  - `endDate?: Date`
  - `allDay?: boolean`（默认 false）
  - `priority?: "none"|"low"|"medium"|"high"`（默认 none）
  - `status?: "todo"|"done"|"cancelled"`（默认 todo）
  - `location?: string`
  - `repeat?: string`（如 每周）

## 触发

- 机器人完成写入后执行 `git add` + `git commit + push`，EdgeOne 重新构建即同步。
