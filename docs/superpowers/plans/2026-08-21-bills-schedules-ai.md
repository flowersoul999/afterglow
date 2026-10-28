# 账单/日程 AI 自然语言 + 提醒 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 BlogWriter 插件新增 `/账单` 与 `/日程` 的 AI 自然语言抽取（主）+ 正则兜底（备），日程支持提前 N 分钟微信私聊提醒（持久化）

**Architecture:** `blog_writer_core.py` 新增 bill/schedule 的解析与 md 构建（纯逻辑可单测）；`main.py` 新增 LLM 抽取分支（`context.get_using_llm()`）+ 会话 `bill/schedule` + APScheduler 提醒；`_conf_schema.json` 新增配置；`data/schedules_reminder.json` 持久化

**Tech Stack:** Python 3.11, httpx, apscheduler 3.10, AstrBot >=4.22 (weixin_oc), lunar-javascript 不涉及, lunar 已在博客侧

## Global Constraints
- 插件目录 `E:\GithubProgect\MyRunProject\dumplingandcakeblog\plug-in\AstrBot\AstrBot BlogWriter\` 为独立 git 仓库，博客 `.gitignore` 已忽略 `/plug-in/`
- 纯逻辑 `blog_writer_core.py` 禁止 import astrbot，必须可 `python -m unittest discover -s tests` 单测
- `main.py` 粘合层双路径兼容 `from .blog_writer_core import ...` 回退 `from blog_writer_core import ...`
- 配置经 `__init__(self, context, config)` 注入，`_cfg()` 读取，`_conf_schema.json` 与 `main.py` 同步
- 网络用 httpx，超时 15s 连接 + 30s 读取，重试 2 次
- 回复 `yield event.plain_result(...)`，日志 `astrbot.api.logger`
- 会话 30 分钟超时、单用户单会话、`allow_users` 白名单静默放行
- 打包只含 5 文件 `main.py,blog_writer_core.py,metadata.yaml,README.md,_conf_schema.json` 到 `打包/`，zip 命名 `AstrBot-BlogWriter-vX.Y.Z.zip`，最多保留 10 个
- `metadata.yaml` 与 `main.py` 的 `@register` 保持 `v1.0.0`，仅 zip 名递增
- pnpm 仅用于博客侧，插件侧无 lint

---

## File Structure
**Create:**
- `plug-in/AstrBot/AstrBot BlogWriter/data/schedules_reminder.json` — 提醒持久化（首次自动创建）

**Modify:**
- `plug-in/AstrBot/AstrBot BlogWriter/blog_writer_core.py` — 新增 COMMANDS, parse_bill, parse_schedule, build_bill_md, build_schedule_md, 常量
- `plug-in/AstrBot/AstrBot BlogWriter/main.py` — 新增 bill/schedule 会话、LLM 抽取、提醒调度、/提醒 命令
- `plug-in/AstrBot/AstrBot BlogWriter/_conf_schema.json` — 新增 5 配置项
- `plug-in/AstrBot/AstrBot BlogWriter/metadata.yaml` — 更新 desc 支持账单/日程
- `plug-in/AstrBot/AstrBot BlogWriter/tests/test_core.py` — 新增 bill/schedule 单测
- `plug-in/AstrBot/AstrBot BlogWriter/tests/test_smoke.py` — 新增 stub LLM 与提醒单测

### Task 1: 纯逻辑层 - 账单/日程解析与 Markdown 生成

**Files:**
- Modify: `plug-in/AstrBot/AstrBot BlogWriter/blog_writer_core.py`
- Test: `plug-in/AstrBot/AstrBot BlogWriter/tests/test_core.py`

**Interfaces:**
- Consumes: 现有 `parse_message, extract_tags, _dump_yaml, _yaml_str, clean_filename_part, with_suffix`
- Produces: `COMMANDS += ("账单","日程","提醒")`, `parse_bill(text:str) -> Tuple[Optional[Dict], str]`, `parse_schedule(text:str) -> Tuple[Optional[Dict], str]`, `build_bill_md(data:Dict, now:datetime) -> str`, `build_schedule_md(data:Dict, now:datetime) -> str`, `BILL_CATEGORIES, BILL_ACCOUNTS, SCHEDULE_PRIORITIES`

- [ ] **Step 1: 写单测 `tests/test_core.py` 新增用例（先失败）**
```python
def test_parse_bill_natural():
    data, err = parse_bill("今天午餐微信花了32")
    assert err == ""
    assert data["amount"] == -32
    assert data["category"] == "餐饮"
    assert data["account"] == "微信"
def test_parse_bill_income():
    data, _ = parse_bill("发工资12000 银行卡")
    assert data["type"] == "income"
    assert data["amount"] == 12000
def test_build_bill_md():
    md = build_bill_md({"title":"午餐","amount":-32,"type":"expense","category":"餐饮","account":"微信","date":datetime(2026,8,21),"description":"午餐"}, datetime(2026,8,21))
    assert "amount: -32" in md
    assert "category: 餐饮" in md
def test_parse_schedule_natural():
    data, _ = parse_schedule("明天下午3点高优在会议室A开周会 每周重复 提前15分钟")
    assert data["title"] == "周会"
    assert data["priority"] == "high"
    assert data["location"] == "会议室A"
    assert data["repeat"] == "每周"
    assert data["remind_before"] == 15
def test_build_schedule_md():
    md = build_schedule_md({"title":"周会","date":datetime(2026,8,22,15,0),"priority":"high","location":"会议室A"}, datetime(2026,8,22))
    assert "title: 周会" in md
```

- [ ] **Step 2: 运行单测验证失败**
```bash
python -m unittest tests.test_core -v
```
Expected: 5 FAIL `NameError: name 'parse_bill' is not defined`

- [ ] **Step 3: 实现 `blog_writer_core.py` 新增逻辑**
```python
COMMANDS = ("动态","笔记","足迹","友链","相册","账单","日程","提醒","发布","取消","状态","帮助")
BILL_CATEGORIES = ["餐饮","交通","住房","工资","居家生活","交流通讯","食品酒水","职业收入","人情收礼","其他"]
BILL_ACCOUNTS = ["微信","支付宝","银行卡","现金","其他"]
def parse_bill(text: str, now=None) -> Tuple[Optional[Dict], str]: ...
def parse_schedule(text: str, now=None) -> Tuple[Optional[Dict], str]: ...
def build_bill_md(data: Dict, now=None) -> str: ...
def build_schedule_md(data: Dict, now=None) -> str: ...
```
实现要点：正则兜底提取金额 `(-?\d+(\.\d+)?)\s*(块|元|￥)?`，关键词“花了/支出”→expense，“工资/收入/到账”→income，分类用白名单编辑距离匹配，未命中则用原词；日期用 `re.search(r"(今天|明天|昨天|后天|\d{4}-\d{2}-\d{2}|\d{1,2}月\d{1,2}日)")` 基准 now；日程时间 `(\d{1,2}[:点]\d{0,2})` + “下午/晚上”换算；优先级/地点/重复/提前分钟同理

- [ ] **Step 4: 再跑单测验证通过**
```bash
python -m unittest tests.test_core -v
```
Expected: 5 PASS

- [ ] **Step 5: Commit**
```bash
git add blog_writer_core.py tests/test_core.py
git commit -m "feat(core): add bill/schedule natural parsing and markdown"
```

### Task 2: 配置与元数据

**Files:**
- Modify: `plug-in/AstrBot/AstrBot BlogWriter/_conf_schema.json`
- Modify: `plug-in/AstrBot/AstrBot BlogWriter/metadata.yaml`

**Interfaces:**
- Consumes: Task 1 的常量
- Produces: 新增配置键供 `main.py:_cfg()` 读取

- [ ] **Step 1: 编辑 `_conf_schema.json` 新增 5 项**
```json
"bill_default_account": {"description":"账单默认账户","type":"string","default":"微信"},
"bill_default_category": {"description":"账单默认分类","type":"string","default":"其他"},
"schedule_default_priority": {"description":"日程默认优先级","type":"string","default":"none"},
"schedule_remind_before": {"description":"日程默认提前提醒分钟（0=准点）","type":"int","default":10},
"enable_ai_bill_schedule": {"description":"启用 AI 自然语言记账/日程（关闭则仅正则）","type":"bool","default":true}
```

- [ ] **Step 2: 编辑 `metadata.yaml` 更新 desc**
```yaml
desc: 通过微信对话更新博客的动态、笔记、足迹、相册、友链、账单、日程，图片自动上传图床并提交 GitHub 触发部署，支持 AI 自然语言与日程提醒
```

- [ ] **Step 3: 验证**
```bash
python -c "import json; json.load(open('_conf_schema.json'))"
```

- [ ] **Step 4: Commit**
```bash
git add _conf_schema.json metadata.yaml
git commit -m "feat(config): add bill/schedule ai and reminder configs"
```

### Task 3: 粘合层 - LLM 抽取 + 会话 + GitHub 提交

**Files:**
- Modify: `plug-in/AstrBot/AstrBot BlogWriter/main.py`

**Interfaces:**
- Consumes: Task 1 产生的 `parse_bill, parse_schedule, build_bill_md, build_schedule_md`, Task 2 配置
- Produces: `on_message` 新增 `账单/日程/提醒` 分支，`_try_ai_extract(text,kind)`，`_start_bill/_start_schedule`

- [ ] **Step 1: 写冒烟测试 `tests/test_smoke.py` 新增**
```python
def test_smoke_bill_ai():
    # stub context.get_using_llm 返回固定 JSON，调用 _try_ai_extract
    ...
def test_smoke_schedule_reminder():
    ...
```

- [ ] **Step 2: 运行冒烟确保失败**
```bash
python -m unittest tests.test_smoke -v
```

- [ ] **Step 3: 实现 `main.py`**
```python
# 在 COMMANDS 分支新增
if cmd == "账单": yield self._start_bill(event, user_id, args, raw)
if cmd == "日程": yield self._start_schedule(event, user_id, args, raw)
if cmd == "提醒": yield self._handle_remind(event, user_id, args)

async def _try_ai_extract(self, text, kind):
    if not self._cfg("enable_ai_bill_schedule", True): return None
    llm = self.context.get_using_llm() # 能力探测 hasattr
    prompt = BILL_PROMPT if kind=="bill" else SCHEDULE_PROMPT
    try:
        resp = await llm.chat([{ "role":"system","content":prompt},{"role":"user","content":text}])
        data = json.loads(resp)
        return data
    except: return None

def _start_bill(...): # 若 args 为空则创建空会话等待下一句口语，否则先尝试 AI 抽取
def _start_schedule(...): # 同理，抽取后创建 Session("bill"/"schedule", meta)
# 在 _publish 中新增 bill/schedule 分支：调用 build_bill_md/build_schedule_md，路径 src/content/bills/YYYY-MM-DD-slug.md / schedules/...
# 成功后若为 schedule 且含时间，调用 _schedule_remind
```

- [ ] **Step 4: 跑冒烟通过**
```bash
python -m unittest tests.test_smoke -v
```

- [ ] **Step 5: Commit**
```bash
git add main.py tests/test_smoke.py
git commit -m "feat(main): add ai bill/schedule with llm and session"
```

### Task 4: 提醒持久化与调度

**Files:**
- Modify: `plug-in/AstrBot/AstrBot BlogWriter/main.py` (新增 ReminderManager)
- Create: `plug-in/AstrBot/AstrBot BlogWriter/data/schedules_reminder.json` (gitignore)

**Interfaces:**
- Consumes: Task 3 的 `_schedule_remind`
- Produces: `def _load_reminders()`, `_save_reminders()`, `_schedule_job()`, `_send_remind()`

- [ ] **Step 1: 实现 Reminder 持久化**
```python
from apscheduler.schedulers.background import BackgroundScheduler
REMINDER_FILE = Path(__file__).parent / "data" / "schedules_reminder.json"
scheduler = BackgroundScheduler()
def _schedule_remind(user_id, title, remind_at):
    job = scheduler.add_job(_send_remind, "date", run_date=remind_at, args=[user_id, title])
    _save_reminders()
```

- [ ] **Step 2: 在 __init__ 恢复**
```python
def __init__(...):
    ...
    scheduler.start()
    self._restore_reminders()
```

- [ ] **Step 3: 实现 _send_remind**
```python
async def _send_remind(user_id, title):
    await self.context.send_message(..., user_id, f"🔔 日程提醒：{title} 时间到了")
```

- [ ] **Step 4: 测试**
```bash
python -m unittest tests.test_smoke::TestReminder -v
```

- [ ] **Step 5: Commit**
```bash
git add main.py
git commit -m "feat(remind): persistent apscheduler for schedule"
```

### Task 5: 文档与打包

**Files:**
- Modify: `plug-in/AstrBot/AstrBot BlogWriter/README.md`
- Modify: `plug-in/AstrBot/AstrBot BlogWriter/AGENTS.md:1`

- [ ] **Step 1: 更新 README 使用示例**
```
| /账单 午餐微信30 | 自然语言记账 |
| /日程 明天15点开会 @会议室A 高优 每周 提前15分钟 | 自然语言日程+提醒 |
```

- [ ] **Step 2: 更新 AGENTS.md 业务规则**

- [ ] **Step 3: 打包验证**
```bash
python -m unittest discover -s tests
# 打包
python - <<'EOF'
import zipfile, os
src=os.getcwd()
out=os.path.join(src,"打包", "AstrBot-BlogWriter-v1.0.20.zip")
...
EOF
```

- [ ] **Step 4: Commit & Push**
```bash
git add README.md AGENTS.md
git commit -m "docs: add bill/schedule ai usage"
git push origin main
git ls-remote origin HEAD
```

## Self-Review
- 覆盖：账单/日程自然语言 + 提醒 + 持久化均有任务
- 无占位符
- 类型一致：parse_bill 返回 Dict 含 amount/type/category/account/date/description；build_bill_md 签名与 core 一致

