# Bills 全链路对账与今日补齐 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 补齐 08-23 三笔（收入/支出/负债还款）并跑通 11 项对账，使 `/bills` 6 卡与 3 期、趋势、排行数值与 `bill-adapter` 真实计算完全一致。

**Architecture:** 复用现有 `Content Collections + bill-adapter` 单一数据源，`getCollection(bills)` 全量进 `calcBillStats/getTodayMonthYearStats/dailyIncomeExpense/categoryExpenseRank/categoryIncomeList` 5 函数，`bills.astro` 透传到 6 卡，仅新增 3 个 md 与对账脚本，不改动卡片视觉。

**Tech Stack:** Astro 7.1.6 + Svelte 5 + Tailwind v4 + Content Collections (glob) + Zod + pnpm 9.14 / Node >=22 / Biome 2.5.7

## Global Constraints

- 包管理器仅 pnpm 9.14，Node >=22，验证 pnpm build + pnpm check 必绿，Biome 为唯一 formatter
- Astro 7 / Svelte 5 runes / Tailwind v4（无 tailwind.config.js），样式经 src/styles/main.css 导入，禁止 !important / #000/#fff 硬编码 / Stylus，暗色仅 :root.dark
- 响应式变量含 DOM ref 必须 $state，非 void 标签禁自闭合
- Swup 容器内避免 client:load，如需交互用页内 script is:inline 事件委托，禁止改 swup-lifecycle-controller.ts
- i18n 新增键需 5 语言同步（如无则不新增）
- 提交 <type>(<scope>): <描述>，.pages.yml 字段需与 src/content.config.ts zod 对齐
- bills type 含 liability，正借负还，isLiabilityLike 排除花呗等不入支出统计

---

### Task 1: 补齐 08-23 三笔今日数据

**Files:**
- Create: `src/content/bills/2026-08-23-补发工资.md`
- Create: `src/content/bills/2026-08-23-晚餐-测试.md`
- Create: `src/content/bills/2026-08-23-花呗还款-测试.md`
- Test: `pnpm check` 验证 zod

**Interfaces:**
- Consumes: `src/content.config.ts:282 billsCollection` (type liability 已有)
- Produces: 3 个 md 供 Task 2 的 `getCollection` 读到

- [ ] **Step 1: 创建 2026-08-23-补发工资.md**

```md
---
title: "补发工资"
amount: 2000
type: "income"
category: "职业收入"
account: "银行卡"
date: 2026-08-23
description: "补发工资"
tags: ["职业收入"]
---

补发工资
```

- [ ] **Step 2: 创建 2026-08-23-晚餐-测试.md**

```md
---
title: "晚餐"
amount: -88
type: "expense"
category: "餐饮"
account: "微信"
date: 2026-08-23
description: "晚餐测试"
tags: ["餐饮"]
---

晚餐测试
```

- [ ] **Step 3: 创建 2026-08-23-花呗还款-测试.md**

```md
---
title: "花呗还款"
amount: -500
type: "liability"
category: "负债"
account: "花呗"
date: 2026-08-23
description: "花呗还款500"
tags: ["负债"]
---

花呗还款500
```

- [ ] **Step 4: 验证**

```bash
pnpm check
```

Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add src/content/bills/2026-08-23-*.md
git commit -m "test(bills): add 08-23 3 bills for audit"
```

### Task 2: 11 项对账脚本与修复

**Files:**
- Create: `C:\Users\dumplingandcake\AppData\Local\Temp\opencode\bills-audit.mjs` (临时对账脚本)
- Modify: `src/utils/bill-adapter.ts` 若发现偏差
- Modify: `src/components/bills/DailyTrendCard.astro` 若锚点仍错（已在 2026-08-23 前修为 today-1，此 Task 仅复验）

**Interfaces:**
- Consumes: Task 1 的 3 笔 + 既有 18 笔；`src/utils/bill-adapter.ts:calcBillStats/getTodayMonthYearStats/dailyIncomeExpense/categoryExpenseRank/categoryIncomeList`
- Produces: 控制台 11 行对比，差值 0

- [ ] **Step 1: 编写对账脚本 bills-audit.mjs**

```js
import { getCollection } from "astro:content"; // 实际用时以 node 直接读文件 + 复刻 adapter 逻辑，避免 Astro 运行时；脚本内手写 isLiabilityLike 与 5 函数同实现，读取 src/content/bills/*.md 解析 amount/type/category/account/date
// 对比：calcBillStats vs NetAssetCard, calcPeriod(08-01~08-31) vs MonthlySummary/Period本月, calcPeriod(08-23) vs Period今天, daily[22] vs DailyTrend, rank vs ExpenseRank, incomeList合计 vs 本月income
```

- [ ] **Step 2: 运行脚本**

```bash
node "C:\Users\dumplingandcake\AppData\Local\Temp\opencode\bills-audit.mjs"
```

Expected: 11 行 `OK` 差值 0

- [ ] **Step 3: 若有 FAIL，修 bill-adapter.ts 对应分支并重跑**

- [ ] **Step 4: 复跑 pnpm check && pnpm build**

```bash
pnpm check; pnpm build
```

Expected: 0 errors, 216 pages

- [ ] **Step 5: Commit**

```bash
git add src/utils/bill-adapter.ts src/components/bills/DailyTrendCard.astro
git commit -m "fix(bills): audit 11 items align"
```

### Task 3: 收尾与推送

**Files:**
- Modify: `docs/superpowers/specs/2026-08-23-bills-audit-design.md` 若补备注
- Test: `npx biome ci ./src`

**Interfaces:**
- Consumes: Task 1+2
- Produces: 远端 main 最新

- [ ] **Step 1: biome**

```bash
npx biome check --write ./src
npx biome ci ./src
```

- [ ] **Step 2: 推送**

```bash
git push
```

Expected: `main -> main`

- [ ] **Step 3: 告知用户 pnpm dev 打开 /bills 硬刷验证**
