# 账单/日程 AI 自然语言 + 提醒 设计（C 混合兜底方案）

> 状态：已批准（用户 2026-08-21 选择 C + 配置默认提前分钟）
> 关联：`src/content.config.ts:bills/schedules`、`src/pages/bills.astro`（两栏6卡）、`src/components/schedules/SchedulesView.svelte`（周视图默认）、`plug-in/AstrBot/AstrBot BlogWriter/`、`docs/astrbot-contract.md`

## 1. 目标
- 在现有 `BlogWriter` 插件上绑定已配 LLM，实现 **自然语言** 记账/建日程，口语如“午餐微信30”“发工资12000”“明天下午3点高优在会议室A开周会 每周重复 提前15分钟提醒我”都能精准落库
- 日程支持 **到点微信私聊提醒**，可自然语言指定“提前N分钟”或走设置默认 `schedule_remind_before`（默认 10），重启不丢

## 2. 命令协议（保持兼容+新增）
- 显式：`/账单 支出 32 餐饮 微信 午餐`、`/日程 明天15点 开会 @会议室A #工作 高优 每周`（传统参数仍可用）
- 自然语言入口：任意消息不命中 `COMMANDS` 时，若 LLM 判定为账单/日程意图，自动进入兜底流程（静默不打扰其它插件，仅当置信度 >0.7 时接管）
- 新增显式：`/账单`（进入记账会话，后续一句口语即可）、`/日程`（同理）、`/提醒 列表|取消`（查看/取消待提醒）
- 会话复用：账单/日程均复用 `Session(kind="bill"|"schedule")`，30分钟超时，`allow_users` 白名单

## 3. AI 抽取（主）+ 正则兜底（备）
### Prompt（System）
```
你是博客记账/日程抽取器，只回 JSON。
bills 白名单：category[餐饮,交通,住房,工资,居家生活,交流通讯,食品酒水,职业收入,人情收礼,其他] account[微信,支付宝,银行卡,现金,其他]
schedules：priority[none,low,medium,high] category[schedule,birthday,anniversary,holiday]
时间基准：{now:%Y-%m-%d %H:%M}
示例：
输入：今天午餐微信花了32  → {"type":"bill","data":{"type":"expense","amount":32,"category":"餐饮","account":"微信","date":"2026-08-21","description":"午餐"}}
输入：发工资12000银行卡  → {"type":"bill","data":{"type":"income","amount":12000,"category":"工资","account":"银行卡","date":"2026-08-21","description":"工资"}}
输入：明天下午3点高优在会议室A开周会 每周重复 提前15分钟  → {"type":"schedule","data":{"title":"周会","date":"2026-08-22 15:00:00","priority":"high","location":"会议室A","repeat":"每周","remind_before":15}}
只回一个 JSON，不要解释。
```
- 调用：`context.get_using_llm()` 取用户已绑模型，`await llm.chat(prompt+user_text)`，超时 8s，重试 1 次
- 失败回退：解析异常/超时 → 走 `parse_bill_fallback` / `parse_schedule_fallback`（关键词+正则，覆盖金额/时间/地点）

### 解析细节
- **账单**：金额必抓（数字+“块/元/￥”），“花了/支出/付款”→expense，“发工资/收入/到账”→income；分类按白名单最短编辑距离匹配，未命中则用 LLM 原词新建；账户同理；日期“今天/明天/昨天/后天/周几/2026-08-21”用 `dateparser` 基准 now；无日期默认今天
- **日程**：标题=去掉时间/地点/优先级/重复后剩余主干；`allDay` 若含“全天/09:00-10:00”则 `endDate` 补；`priority` 关键词“高优/紧急→high, 中→medium, 低→low”；`repeat` 命中“每天/每周/每月/每年”；`remind_before` 抽“提前N分钟/小时”，无则取配置默认

## 4. 提醒持久化
- 文件：`plug-in/AstrBot/AstrBot BlogWriter/data/schedules_reminder.json`（`{id, user_id, title, remind_at, schedule_path}` 列表）
- 调度：`apscheduler.schedulers.background.BackgroundScheduler`，`_schedule_reminders()` 在 `_publish` 成功后写入并 `add_job(_send_remind, trigger="date", run_date=remind_at - timedelta(minutes=remind_before))`
- 发送：`await context.send_message(platform/weixin_oc, user_id, "🔔 日程提醒：{title} {location} {date}")`，失败写日志不影响主流程
- 恢复：插件 `__init__` 时读取 json 重新注册未过期的 job；`/提醒 列表` 读文件展示，`/提醒 取消 id` 删 job+文件

## 5. 文件生成（对齐 zod）
- 账单：`build_bill_md(title, amount, type, category, account, date, description, tags)` → `src/content/bills/YYYY-MM-DD-{slug}.md`（`slug=clean_filename_part(category or "bill")`，冲突 `-1..-10`）
  ```yaml
  title: 午餐
  amount: -32
  type: expense
  category: 餐饮
  account: 微信
  date: 2026-08-21
  description: 午餐
  tags: ["餐饮"]
  ```
- 日程：`build_schedule_md(title, date, endDate, allDay, priority, status, location, repeat, category, person, tags)` → `src/content/schedules/YYYY-MM-DD-{slug}.md`，`slug=clean_filename_part(title)`
- 校验：金额有限数，日期必转 `YYYY-MM-DD [HH:MM:SS]`，纯数字标签加引号，URL 裸写

## 6. 流程（与现有一致）
1. 用户发自然语言（或 `/账单`/`/日程` + 口语）
2. LLM 抽取 → 校验 → 若日程含时间且 `status!=done` → 计算 `remind_at`
3. GitHub 查重 → 生成 md → `PUT /contents`（带重试）
4. 若日程：写 reminder.json + 注册 job → 回复“发布成功 + 文件路径 + 博客链接 + 提醒时间”

## 7. 配置（_conf_schema.json 新增）
- `bill_default_account: string default "微信"`
- `bill_default_category: string default "其他"`
- `schedule_default_priority: enum none/low/medium/high default none`
- `schedule_remind_before: int default 10`（分钟，0 表示准点）
- `enable_ai_bill_schedule: bool default true`（总开关，关则仅走正则）

## 8. 错误与边界
- LLM 超时/非 JSON/缺必填 → 回退正则，仍缺则回复“没听懂，请说如：午餐微信30 或 明天15点开会”
- 金额缺失/时间解析失败 → 回复明确中文提示
- 提醒时间已过期 → 不注册，直接提示“时间已过，已仅发布日程”
- GitHub/图床失败 → 中止，不写半成品，中文报错

## 9. 测试
- `tests/test_core.py` 新增：parse_bill_fallback 6 例、parse_schedule_fallback 6 例、build_bill/schedule 各 2 例、extract_tags 含提醒关键词
- `tests/test_smoke.py` 新增：stub llm 返回 JSON 时的 _publish 分支、reminder.json 读写、apscheduler 注册
- 本地：`python -m unittest discover -s tests` 全绿

## 10. 发布
- 按 AGENTS.md 发版：测试全绿 → 打包 zip（5 文件）→ git push origin main → ls-remote 校验
