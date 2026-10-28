# 账单/资金与日程 仪表盘设计（Spec B · 融合适配）

> 状态：brainstorming 已确认（B 仪表盘组件化 · A 密集版式 + 苹果质感），待 writing-plans
> 关联：`src/content.config.ts` / `src/content/bills/` / `src/content/schedules/` / AstrBot 微信插件 Phase2

## 1. 背景与目标

- 为博客新增「资金」与「日程」两个新版块，数据走 `Content Collections + PagesCMS`（用户选 C），`src/content/bills/*.md` 与 `src/content/schedules/*.md` 静态渲染
- 第一版先完成项目侧内容与页面（用户选 C 分阶段），第二版再优化 AstrBot 插件按同一 Markdown 写入规范追加文件并触发构建
- UI 优先参考腾讯系（微信支付账单、腾讯记账/日历）与其他高活热门 App（支付宝资产、随手记/鲨鱼记账、苹果日历/滴答清单/ Notion 日历），以 Firefly 黑白极简中性色与苹果毛玻璃统一

## 2. 范围与非范围

- 在范围：两集合 Zod 模型、两页面路由与仪表盘组件、筛选/分组/图表、日历双栏布局、AstrBot 写入规范预留与文档
- 不在范围：Phase1 不做实时推送/增量刷新、不另起 Worker/D1 服务、不引入外部计费/提醒推送通道

## 3. 数据模型（Phase1 定版）

### bills（资金仪表盘 · 融合微信/支付宝/随手记）

```ts
bills: {
  amount: number;                 // 金额，正收入负支出
  type: "income"|"expense"|"transfer";
  category: string;               // 餐饮/交通/住房/工资… 映射线性图标与去饱和色
  account: string;                // 微信/支付宝/银行卡/现金… 对应资产维度
  date: Date;                     // 发生时间
  description: string;            // 备注
  tags: string[];                 // 筛选标签
}
```

### schedules（融合日历 · 苹果/腾讯 + 滴答/Notion）

```ts
schedules: {
  title: string;
  date: Date;                     // 开始时间
  endDate?: Date;                 // 结束时间，空为待办
  allDay: boolean;
  priority: "none"|"low"|"medium"|"high";
  status: "todo"|"done"|"cancelled";
  location?: string;
  repeat?: string;                // 供 AstrBot “每周提醒” 解析
}
```

- 校验：`amount` 有限数，`date` 必填，`category/account` 允许空回退到“其他”
- 机器人契约：AstrBot 往 `src/content/bills/YYYY-MM-DD-*.md` 与 `src/content/schedules/*.md` 以相同 frontmatter 追加即生效，`pnpm build` 后可见

## 4. 架构（三层）

1. 数据层：两集合 + `src/utils/bill-adapter.ts` / `schedule-adapter.ts` 聚合与分组
2. 视图层：资金四宫格 + 双图 + 按日流水；日程左历右单双栏
3. 同步预留层：Phase1 构建时全量渲染，AstrBot 侧 `git push` 触发 EdgeOne 重建，Phase2 再补增量刷新

## 5. 页面设计

### 5.1 资金页 `/bills`（财富仪表盘）

- 顶部筛选：本月/全年 + 账户（全部/微信/支付宝/银行卡）黑白胶囊
- 第一区 四宫格：总资产/负债/净资产/当月结余，2×2（移动）/4 列（桌面），卡片 `oklch(1 0 0 / 0.72) + blur(16px) + 1px 白边`
- 第二区 双图：左分类环形图（灰阶+单点缀色）、右近 6 月结余细线折线，低饱和
- 第三区 流水：按 `YYYY-MM-DD` 分组吸顶，行左线性图标 + 中描述/账户 + 右金额（收入/支出用 muted 绿/红，克制）
- 空态：无账单时的引导卡片

### 5.2 日程页 `/schedules`（双栏融合）

- 桌面：`左 320px 月历 + 右 1fr 当日清单`，`1px` 分割线；月历细线网格+毛玻璃，选中黑底白字，当天浅灰描边
- 移动：上下堆叠，清单标题 `YYYY-MM-DD · 周X` 吸顶
- 清单行：左 `0.45rem` 优先级圆点，中标题/时间，右完成勾选；周视图为横向灰阶时间块，hover 浅灰
- 与机器人衔接：`date/endDate/allDay/priority/status/repeat` 已为自然语言调度预留

## 6. 视觉与动效

- 统一苹果毛玻璃：卡片 `oklch(1 0 0 / 0.72) + blur(22px) saturate(1.4) + 白边 + 内发光`，暗色 `oklch(0.16 0 0 / 0.72)`，与动态评论弹窗一致
- 交互：筛选/日历切换无高饱和闪烁，流水与清单 hover 仅浅灰，毛玻璃与细边框承载层次

## 7. 关键交互

- 资金：切换时间/账户即重算四宫格与双图；点击分类可筛选流水
- 日程：点月历某天右侧只看当日；勾选待办即切 `status: done`（Phase1 仅前端态，持久化由内容文件驱动）
- 引用与编辑沿用动态页的引用合一策略，输入区引用互斥

## 8. AstrBot 预留（Phase2）

- 写入规范：`bills` 与 `schedules` 的 Markdown frontmatter 同上，机器人按自然语言解析后落文件
- 触发：机器人写入后 `git push`，EdgeOne 重建，无需前端轮询；Phase2 可加 `If-Modified-Since` 增量刷新

## 9. 风险与取舍

- 选 B 而非 A：满足 C 资金仪表盘与 C 融合日历的完整信息密度，避免后期重构 schema
- 选 B 而非 C：不引入 Worker/D1，尊重“集成到内容管理”的选择，运维最轻

## 10. 验收

- `/bills` 四宫格/双图/按日流水可渲染，空态友好，移动端 2×2 正常
- `/schedules` 双栏在桌面与移动均可用，选中与当天态正确，清单优先级与完成态可见
- `pnpm check 0 errors`，`pnpm build` 通过，新增两集合与两路由不影响既有 `moments/guestbook` 等
