# 友链截图脚本优化设计

- 日期：2026-08-23
- 状态：已获用户批准
- 涉及文件：`scripts/友链截图/index.mjs`、`.github/workflows/friend-screenshots.yml`

## 背景与问题

友链卡片的背景图来自 `scripts/友链截图/index.mjs`（Playwright 无头浏览器访问友链站点截图，输出 `public/assets/friends-shots/{id小写}.webp`）。现存两个问题：

1. **截图质量不稳定**：部分截图是空白页/加载中状态（截得太快，`load` 事件后字体、懒加载图片尚未就绪）；部分截图是验证码/拦截页（无头浏览器默认 UA 含 `HeadlessChrome`，被站点反爬识别）。
2. **新增友链后背景图缺位**：截图目前只靠每周日 3:23 的定时 Action 全量补漏，新友链上线后最多一周没有背景图（卡片退化为纯头像卡）。

## 目标

1. 空白/加载中、验证码/拦截页两类失败截图显著减少
2. 新增友链 push 后几分钟内背景图自动生成并上线，全程无人工操作
3. 支持方便地重截单个友链（不用手动删文件）

## 方案（已选定：渐进增强现有脚本 + Action 加 push 触发器）

曾评估的替代方案：第三方截图服务（需 API key、配额/付费、外部依赖，否决）；单纯加重试次数（不解决"截太快"与"被识别"两个根因，否决）。

### 脚本改造（scripts/友链截图/index.mjs）

1. **伪装真实浏览器**：`browser.newContext()` 创建上下文替代 `browser.newPage()` 直开——真实 Chrome UA（不含 Headless 标记）、`locale: "zh-CN"`、`timezoneId: "Asia/Shanghai"`、`viewport: 1280×800`、`deviceScaleFactor: 2`（2 倍像素截图后压到 640 宽，文字更清晰）。
2. **等待策略升级**：`goto`（`waitUntil: "load"`）成功后，依次 `await page.evaluate(() => document.fonts.ready)`（字体就绪）+ `waitForTimeout(1500)` 固定缓冲（懒加载图片、骨架屏转完）。保持不用 `networkidle`（现代博客轮询/长连接永远等不到 idle，脚本既有注释已说明）。
3. **重试升级**：失败后最多重试 2 次（单次尝试共 3 次机会），单次超时 20s → 30s（首次访问慢的站点多给机会）。
4. **命令行参数**：
   - 传友链 id（如 `node scripts/友链截图/index.mjs 36-secret-blog`）：只处理该友链，且**忽略"已存在跳过"强制重截**（即传 id 天然等价于对该 id 的 force）
   - 传 `--force`：忽略"已存在跳过"，全部重截
5. 输出规格不变：640 宽 webp quality 75，文件名 = md 文件名转小写（与 Astro entry id 一致，2026-08-23 已修复的规则）。

### Action 改造（.github/workflows/friend-screenshots.yml）

保留现有 `schedule`（每周日 3:23 全量补漏）与 `workflow_dispatch`（手动触发），新增：

```yaml
push:
  branches: [main]
  paths: ["src/content/friends/**"]
```

Action 跑完由 bot 提交 webp 回 main → 触发 EdgeOne 自动部署 → 背景图上线。截图产物在 `public/assets/friends-shots/`，不在 paths 过滤器内，**无循环触发风险**。

### 数据流（新增友链全流程）

PagesCMS 后台或本地新建 `src/content/friends/xx.md` → push main → EdgeOne 部署（卡片暂无背景图，退化纯头像卡）→ Action 检测到 friends 路径变化自动跑脚本 → bot 提交 `xx.webp` 回 main → EdgeOne 再次部署 → 背景图上线。全程约几分钟。

## 边界情况

- 站点确实被强反爬拦截/挂掉：脚本输出失败列表，卡片退化纯头像卡，下周日定时任务自动重试，页面不报错。
- 同一 push 同时改多篇友链：脚本全量跳过已有、只截新增，行为不变。

## 明确不做（YAGNI）

- 不做验证码破解、代理池等深度反爬对抗
- 不做截图后的图像质量自动评估（判断空白页/拦截页）
- 不改 friends 集合 schema、friends.astro 前端逻辑
