# Bills 全链路对账与今日数据补齐设计（A 方案）

日期：2026-08-23
状态：已批准（§1-§3 用户 ok，选 A 代码+数据双对账）
关联：`src/pages/bills.astro` `src/utils/bill-adapter.ts` `src/components/bills/*` `src/content/bills/*` `src/content.config.ts`

## 1. 背景与目标

上一版新增 18 笔测试账单后，`/bills` 出现 4 处 mismatch：今天钉在 08.15、左下 `总收入 3800≠18800`、右下 `收入 134.50` 脏分类、月支出 `3021.50` 含误判余额账单。本设计以不新增组件为前提，完成 11 项绑定对账并补 `08-23` 三笔覆盖收入/支出/负债还款，验证 `净资产=(收入-支出)-负债` 闭环。

## 2. 范围与非范围

在范围：6 卡+3 期+双图的数值对账；`isLiabilityLike` 与 `liability type 正借负还` 的排除与合并；`工资→职业收入` 合并；每日趋势锚定当天；`08-23` 三笔。
不在范围：不改视觉/动效/响应式；不改 `BlogWriter` 插件解析；不引入新集合或 Worker。

## 3. 数据模型

`bills` 已扩展 `type: income|expense|transfer|liability`，`LIABILITY_KEYS=[花呗,借呗,信用卡,负债,白条,分期,借贷]`。
- `income` 正数累计收入
- `expense` 负数绝对值累计支出，命中 `isLiabilityLike` 的转计 `liability`
- `liability` 正借负还直接加和，展示 `max(0, liability)`
- `balance=income-expense` `asset=income` `netAsset=balance-liabilityDisplay`

## 4. 架构与数据流

`getCollection(bills) → sorted → calcBillStats / getTodayMonthYearStats / dailyIncomeExpense / categoryExpenseRank / categoryIncomeList → bills.astro 6 卡 props`。
今日三笔与既有 8 月 10 笔同走同一 adapter，`period` 与 `daily` 以 `2026-08-01/23/31` 为边界重算，无额外持久化。

## 5. 组件与改动点

- `bill-adapter.ts:232` 已修 `工资→职业收入` 合并后取 Top3，`memberMonthlyStats` 与 `monthlyTrend/calcPeriod` 均跳过 `liability/transfer`。
- `DailyTrendCard.astro:26` 已修 `midIdx=today-1` 当月锚定。
- `bills/2026-08-23-*.md` 新增 3 笔，删除 `2026-08-23-微信余额.md` 脏数据。
- 其余 `NetAssetCard/MonthlySummary/PeriodSummary/ExpenseRank/IncomeCategory` 零改动，仅复验。

## 6. 关键交互与容错

`08-23` 当天 `Period 今天` 与 `DailyTrend 08.23 tooltip` 必须同为 `收入2000 支出88`；`收入分类合计` 必须等于 `本月收入`；`支出排行 Top3 合计 ≤ 本月支出`；`负债还款 -500` 后 `netAsset` 回升约 500，若 `liability<0` 则按 0 展示。任一不符当场修 adapter，不抛异常到页面。

## 7. 测试与验收

`pnpm check 0错` `pnpm build 216页` `biome ci` 过；`node 对账脚本` 逐项打印 11 项对比，差值 0 即过；`pnpm dev` 打开 `/bills` 肉眼确认 `今天 08.23` 与 `08.23 支出排行` 无 `收入` 脏分类。

## 8. 风险

测试账单与真实账单同集合，需在文档注明“测试数据，首条真实记账后可删 6/7 月示例”。负债还款为负 `liability` 是产品约定，需在 `CLAUDE.md §19` 补充。
