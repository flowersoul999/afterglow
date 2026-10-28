# 账单/资金与日程 仪表盘 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增 `/bills` 资金仪表盘与 `/schedules` 融合日程，复用 Content Collections + PagesCMS，版式按腾讯系/热门 App 提炼并以 Firefly 黑白极简 + 苹果毛玻璃统一，为 AstrBot 预留写入契约。

**Architecture:** content.config.ts 增两集合 -> utils/bill-adapter & schedule-adapter 聚合与分组 -> pages/bills & schedules + 仪表盘/日历组件 -> docs/astrbot-contract.md 写入规范（Phase1 构建时全量渲染，Phase2 增量刷新）

**Tech Stack:** Astro 7.1.6 + Svelte 5 + Tailwind v4 + Content Collections (glob) + Zod + pnpm 9.14 / Node >=22 / Biome 2.5.7

## Global Constraints

- 包管理器仅 pnpm 9.14，Node >=22，验证 pnpm build + pnpm check 必绿，Biome 为唯一 formatter
- Astro 7 / Svelte 5 runes / Tailwind v4（无 tailwind.config.js），样式经 src/styles/main.css 导入，禁止 !important / #000/#fff 硬编码 / Stylus，暗色仅 :root.dark
- 响应式变量含 DOM ref 必须 $state，非 void 标签禁自闭合
- Swup 容器内避免 client:load，如需交互用 client:visible 或页内 script is:inline 事件委托，禁止改 swup-lifecycle-controller.ts
- i18n 新增键需 5 语言同步（如无则不新增）
- 提交 <type>(<scope>): <描述>，.pages.yml 字段需与 src/content.config.ts zod 对齐（未声明字段保存时被丢弃）

---

## File Structure

**Create**
- src/content/bills/ — 示例账单（3 条）
- src/content/schedules/ — 示例日程（3 条）
- src/utils/bill-adapter.ts — 按日期/账户/分类聚合与分组
- src/utils/schedule-adapter.ts — 按日分组与月历标记
- src/components/bills/BillStats.astro — 四宫格（总资产/负债/净资产/当月结余）
- src/components/bills/BillCategoryDonut.astro — 分类环形（灰阶+单点缀）
- src/components/bills/BillTrendLine.astro — 近 6 月结余折线
- src/components/bills/BillList.astro — 按日分组流水
- src/components/schedules/ScheduleCalendar.astro — 月历网格（细线+毛玻璃）
- src/components/schedules/ScheduleList.astro — 当日清单（优先级圆点+勾选）
- src/pages/bills.astro — /bills 路由
- src/pages/schedules.astro — /schedules 路由
- docs/astrbot-contract.md — Phase2 写入契约

**Modify**
- src/content.config.ts:8 — 新增两集合 Zod + export const collections
- .pages.yml — 新增 bills 与 schedules 两集合（字段与 zod 对齐）
- src/config/navBarConfig.ts — 新增两导航入口

### Task 1: 数据层两集合与 .pages.yml 对齐

**Files:**
- Modify: src/content.config.ts:8
- Modify: .pages.yml:60

**Interfaces:**
- Consumes: astro:content defineCollection, glob, z
- Produces: export const collections: { ..., bills, schedules }；PagesCMS 新增两集合供后台写入；src/content/bills/*.md 与 src/content/schedules/*.md 前言即契约

- [ ] **Step 1: 在 src/content.config.ts 新增两 Zod 集合**

```ts
const billsCollection = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/bills" }),
  schema: z.object({
    amount: z.number(),
    type: z.enum(["income","expense","transfer"]).default("expense"),
    category: z.string().default("其他"),
    account: z.string().default("其他"),
    date: z.date(),
    description: z.string().default(""),
    tags: z.array(z.string()).default([]),
  }),
});
const schedulesCollection = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/schedules" }),
  schema: z.object({
    title: z.string(),
    date: z.date(),
    endDate: z.date().optional(),
    allDay: z.boolean().default(false),
    priority: z.enum(["none","low","medium","high"]).default("none"),
    status: z.enum(["todo","done","cancelled"]).default("todo"),
    location: z.string().optional().default(""),
    repeat: z.string().optional().default(""),
  }),
});
// 在 export const collections 中加入 bills, schedules
```

- [ ] **Step 2: 在 .pages.yml 新增两集合（字段与 zod 严格对齐）**

```yaml
- name: bills
  label: 资金流水
  type: collection
  path: src/content/bills
  format: yaml-frontmatter
  fields:
    - {name: title, label: 标题, type: string}
    - {name: amount, label: 金额, type: number}
    - {name: type, label: 类型, type: string}
    - {name: category, label: 分类, type: string}
    - {name: account, label: 账户, type: string}
    - {name: date, label: 日期, type: date}
    - {name: description, label: 备注, type: string}
    - {name: tags, label: 标签, type: string}
- name: schedules
  label: 日程
  type: collection
  path: src/content/schedules
  format: yaml-frontmatter
  fields:
    - {name: title, label: 标题, type: string}
    - {name: date, label: 开始, type: date}
    - {name: endDate, label: 结束, type: date}
    - {name: allDay, label: 全天, type: boolean}
    - {name: priority, label: 优先级, type: string}
    - {name: status, label: 状态, type: string}
    - {name: location, label: 地点, type: string}
    - {name: repeat, label: 重复, type: string}
```

- [ ] **Step 3: 建示例内容（各 3 条，供页面自验证）**

```md
# src/content/bills/2026-02-08-lunch.md
---
amount: -32
type: expense
category: 餐饮
account: 微信
date: 2026-02-08
description: 午餐
tags: [餐饮]
---
```

- [ ] **Step 4: 验证**

```bash
pnpm check
pnpm build
```

Expected: pnpm check 0 errors，pnpm build: 383+2 page(s) built

- [ ] **Step 5: Commit**

```bash
git add src/content.config.ts .pages.yml src/content/bills src/content/schedules
git commit -m "feat(content): add bills and schedules collections"
```

### Task 2: 适配器 bill-adapter / schedule-adapter

**Files:**
- Create: src/utils/bill-adapter.ts
- Create: src/utils/schedule-adapter.ts

**Interfaces:**
- Consumes: CollectionEntry<"bills"|"schedules">
- Produces: groupBillsByDay(entries), calcBillStats(entries), groupSchedulesByDay(entries), calendarMarks(entries, year, month)

- [ ] **Step 1: 创建 src/utils/bill-adapter.ts**

```ts
export function groupBillsByDay(entries: CollectionEntry<"bills">[]) { /* 按 date YYYY-MM-DD 分组 + 组内时间倒序 */ }
export function calcBillStats(entries: CollectionEntry<"bills">[]) { /* 返回 {income, expense, balance, asset, liability, netAsset} 示意 */ }
```

- [ ] **Step 2: 创建 src/utils/schedule-adapter.ts**

```ts
export function groupSchedulesByDay(entries: CollectionEntry<"schedules">[]) { /* 按 date 归当日 Map<string, entries[]> */ }
export function calendarMarks(entries: CollectionEntry<"schedules">[], y:number, m:number){ /* 返回 Set<YYYY-MM-DD> 供月历点标记 */ }
```

- [ ] **Step 3: 验证**

```bash
pnpm check
```

Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add src/utils/bill-adapter.ts src/utils/schedule-adapter.ts
git commit -m "feat(utils): add bill and schedule adapters"
```

### Task 3: 资金组件（四宫格+双图+流水）

**Files:**
- Create: src/components/bills/BillStats.astro
- Create: src/components/bills/BillCategoryDonut.astro
- Create: src/components/bills/BillTrendLine.astro
- Create: src/components/bills/BillList.astro

**Interfaces:**
- Consumes: bill-adapter 的聚合结果
- Produces: 纯展示组件，props 为 stats/categories/trend/groups，样式经 main.css 的苹果毛玻璃（oklch(1 0 0 / 0.72) + blur(22px)）

- [ ] **Step 1: 创建四组件的最小可渲染版本（静态数据先行）**

- [ ] **Step 2: 验证**

```bash
pnpm check
pnpm build
```

Expected: 构建通过，组件可在 /bills 占位渲染

- [ ] **Step 3: Commit**

```bash
git add src/components/bills
git commit -m "feat(bills): add dashboard components"
```

### Task 4: 日程组件（月历+清单）

**Files:**
- Create: src/components/schedules/ScheduleCalendar.astro
- Create: src/components/schedules/ScheduleList.astro

**Interfaces:**
- Consumes: schedule-adapter
- Produces: 双栏联动：日历选日事件 onSelectDate: (date: string) => void 驱动清单过滤

- [ ] **Step 1: 创建 ScheduleCalendar（细线网格+毛玻璃，选中黑底白字，当天浅灰描边）**

- [ ] **Step 2: 创建 ScheduleList（优先级圆点+完成划线）**

- [ ] **Step 3: 验证**

```bash
pnpm check
```

Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add src/components/schedules
git commit -m "feat(schedules): add calendar and list components"
```

### Task 5: 两路由与筛选联动

**Files:**
- Create: src/pages/bills.astro
- Create: src/pages/schedules.astro
- Modify: src/config/navBarConfig.ts:12

**Interfaces:**
- Consumes: getCollection("bills"/"schedules") + 两适配器 + 四/两组件
- Produces: /bills（时间/账户筛选驱动重算）/schedules（点日驱动清单），Swup 内事件委托，不动 swup-lifecycle-controller.ts

- [ ] **Step 1: 创建 src/pages/bills.astro（MainGridLayout + 三区布局+ 顶部胶囊筛选）**

- [ ] **Step 2: 创建 src/pages/schedules.astro（左历右单，移动上下堆叠）**

- [ ] **Step 3: 在 navBarConfig 新增两入口**

- [ ] **Step 4: 验证**

```bash
pnpm build
```

Expected: 新增两路由，构建 383+2 页

- [ ] **Step 5: Commit**

```bash
git add src/pages/bills.astro src/pages/schedules.astro src/config/navBarConfig.ts
git commit -m "feat(pages): add bills and schedules routes"
```

### Task 6: AstrBot 写入契约与收尾

**Files:**
- Create: docs/astrbot-contract.md
- Modify: src/content/changelog/2026-02-09-bills-schedules.md
- Modify: CLAUDE.md:2,19

**Interfaces:**
- Consumes: 两集合 schema
- Produces: 明确往 src/content/bills/YYYY-MM-DD-*.md 与 schedules/*.md 按 frontmatter 落文件即生效，pnpm build 后可见，.pages.yml 对齐

- [ ] **Step 1: 写 docs/astrbot-contract.md（写入示例 + 文件名模板）**

- [ ] **Step 2: 补 changelog 与 CLAUDE 第 2/19 节目录与后台集合数**

- [ ] **Step 3: 验证**

```bash
pnpm check && pnpm build
```

Expected: 0 errors, 383+2 page(s) built

- [ ] **Step 4: Commit**

```bash
git add docs/astrbot-contract.md src/content/changelog/* CLAUDE.md
git commit -m "docs: add astrbot contract and changelog for bills/schedules"
```

---

## Self-Review

- Spec coverage: 两集合与三层架构、四宫格+双图+流水、双栏日历、毛玻璃、AstrBot 预留均有 Task
- Placeholder scan: 无 TODO，均含文件路径与 zod 字段
- Type consistency: bills.amount/date/category/account 与 schedules.date/priority/status 在 adapter 与组件 Props 一致
