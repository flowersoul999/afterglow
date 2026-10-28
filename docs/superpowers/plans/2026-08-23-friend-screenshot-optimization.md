# 友链截图优化实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 友链截图脚本提升成功率与清晰度（浏览器伪装 + 等待策略 + 重试 + 指定 id 重截），并在新增友链 push 后由 GitHub Action 自动截图，背景图几分钟内自动上线。

**Architecture:** 改造 `scripts/友链截图/index.mjs`（Playwright context 级伪装真实浏览器、load 后等字体就绪加固定缓冲、3 次尝试、命令行参数），给 `.github/workflows/friend-screenshots.yml` 增加 `push.paths` 触发器（截图产物在 public 路径，不在过滤器内，无循环触发）。设计文档：`docs/superpowers/specs/2026-08-23-friend-screenshot-optimization-design.md`。

**Tech Stack:** Node 22 ESM、Playwright（chromium，devDep ^1.62.1）、sharp（devDep ^0.34.5）、GitHub Actions。

## Global Constraints

- 包管理器仅限 pnpm 9.14；Node >= 22；无测试框架——验证 = `node --check` 语法 + 实跑脚本 + 收尾 `pnpm build` / `pnpm check` / `pnpm type-check`
- 提交信息格式 `<type>(<scope>): <描述>`（本计划用 `feat(friends)` / `docs(friends)` / `chore(friends)`）
- 截图文件名必须全小写（= md 文件名去掉 .md 后转小写，与 Astro entry id 一致），已有逻辑不得回退
- 截图产物规格不变：640 宽 webp quality 75
- 禁改 friends 集合 schema、`friends.astro` 前端逻辑（spec 的 YAGNI 边界）
- 不用 `networkidle`（现代博客轮询/长连接等不到 idle）
- 任务 1、2 只改构建外文件（scripts/、.github/），提交前不跑 build；任务 3 收尾统一跑全量验证
- CLAUDE.md 是唯一权威规范，改动落地后必须同步（任务 3）

---

### Task 1: 截图脚本优化

**Files:**
- Modify: `scripts/友链截图/index.mjs`（整体重写，保留 `readEntries()` 的小写 id 规则）

**Interfaces:**
- Consumes: `src/content/friends/*.md` 的 frontmatter `siteurl` 字段
- Produces: `public/assets/friends-shots/{id小写}.webp`（覆盖或新增）；命令行接口 `node scripts/友链截图/index.mjs [友链id] [--force]`

- [ ] **Step 1: 用下面完整内容重写 `scripts/友链截图/index.mjs`**

```js
/* 友链站点截图：Playwright 无头浏览器逐个访问友链站点，压缩为 640 宽 webp
   用法：node scripts/友链截图/index.mjs [友链id] [--force]
     - 传友链 id（如 36-secret-blog）：只截该友链，并强制覆盖已有截图
     - --force：忽略已存在的截图，全部重截
   产物提交回仓库由 Action 完成；依赖：pnpm add -D playwright（chromium） */

import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import sharp from "sharp";

const FRIENDS_DIR = path.join(import.meta.dirname, "../../src/content/friends");
const OUT_DIR = path.join(import.meta.dirname, "../../public/assets/friends-shots");

// 默认无头 UA 带 "HeadlessChrome" 会被部分站点反爬识别，换成真实 Chrome UA
const UA =
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

function readEntries() {
	const entries = [];
	for (const f of fs.readdirSync(FRIENDS_DIR).filter((x) => x.endsWith(".md"))) {
		const raw = fs.readFileSync(path.join(FRIENDS_DIR, f), "utf8");
		const m = raw.match(/^siteurl:\s*(.+)$/m);
		// id 必须转小写：Astro glob loader 的 entry id 是全小写 slug，
		// 截图文件名若保留大写，线上（Linux 大小写敏感）卡片会退化、Windows dev 则 404
		if (m) entries.push({ id: f.replace(/\.md$/, "").toLowerCase(), url: m[1].trim().replace(/^["']|["']$/g, "") });
	}
	return entries;
}

// 命令行参数：非 -- 开头的视为友链 id（只截这一个并强制覆盖）
const argId = process.argv.slice(2).find((a) => !a.startsWith("--"));
const force = process.argv.includes("--force");

const allEntries = readEntries();
const entries = argId ? allEntries.filter((e) => e.id === argId) : allEntries;
if (argId && !entries.length) {
	console.error(`❌ 未找到友链 "${argId}"，可用 id：\n  ${allEntries.map((e) => e.id).join("\n  ")}`);
	process.exit(1);
}

fs.mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
// context 级伪装真实浏览器（UA/语言/时区）；2 倍像素截图再压 640 宽，文字更清晰
const context = await browser.newContext({
	userAgent: UA,
	locale: "zh-CN",
	timezoneId: "Asia/Shanghai",
	viewport: { width: 1280, height: 800 },
	deviceScaleFactor: 2,
});

// 单次截图：load 后等字体就绪 + 固定缓冲（懒加载图/骨架屏转完），解决空白/加载中截图
async function takeShot(entry) {
	const page = await context.newPage();
	try {
		await page.goto(entry.url, { waitUntil: "load", timeout: 30000 });
		await page.evaluate(() => document.fonts.ready.then(() => true));
		await page.waitForTimeout(1500);
		const buf = await page.screenshot({ type: "png" });
		return await sharp(buf).resize({ width: 640 }).webp({ quality: 75 }).toBuffer();
	} finally {
		await page.close();
	}
}

const ok = [];
const failed = [];
for (const entry of entries) {
	const outPath = path.join(OUT_DIR, `${entry.id}.webp`);
	if (fs.existsSync(outPath) && !force && !argId) {
		console.log(`⏭  已有 ${entry.id}.webp`);
		continue;
	}
	try {
		// 共 3 次机会（首次 + 2 次重试）：慢站点/偶发拦截多给机会，全败才算失败
		let buf;
		for (let attempt = 1; attempt <= 3; attempt++) {
			try {
				buf = await takeShot(entry);
				break;
			} catch (e) {
				if (attempt === 3) throw e;
				console.log(`  ↻ ${entry.id} 第 ${attempt} 次失败，重试…`);
			}
		}
		fs.writeFileSync(outPath, buf);
		ok.push(entry.id);
		console.log(`✅ ${entry.id}  ${entry.url}`);
	} catch (e) {
		failed.push(`${entry.id}（${String(e.message).slice(0, 60)}）`);
		console.log(`❌ ${entry.id}  ${entry.url}`);
	}
}
await context.close();
await browser.close();

console.log(`\n完成：成功 ${ok.length}，失败 ${failed.length}`);
if (failed.length) console.log("失败列表：\n  " + failed.join("\n  "));
```

- [ ] **Step 2: 语法检查**

Run: `node --check scripts/友链截图/index.mjs`
Expected: 无输出（通过）

- [ ] **Step 3: 实跑验证——指定 id 强制重截**

Run: `node scripts/友链截图/index.mjs 36-secret-blog`
Expected: 控制台输出 `✅ 36-secret-blog  <url>`，`public/assets/friends-shots/36-secret-blog.webp` 的修改时间更新为当前时间。打开该 webp 肉眼确认非空白、非验证码页。

- [ ] **Step 4: 实跑验证——不存在的 id 报错退出**

Run: `node scripts/友链截图/index.mjs 99-not-exist`
Expected: 输出 `❌ 未找到友链 "99-not-exist"，可用 id：…`（列出全部可用 id），进程退出码非 0（Git Bash 可用 `echo $?` 验证为 1）

- [ ] **Step 5: 实跑验证——默认全量模式只跳过**

Run: `node scripts/友链截图/index.mjs`
Expected: 全部输出 `⏭ 已有 xxx.webp`（所有截图都已存在），末尾 `完成：成功 0，失败 0`，耗时几秒内结束（不发起新截图）

- [ ] **Step 6: 提交**

```bash
git add scripts/友链截图/index.mjs
git commit -m "feat(friends): 友链截图脚本优化（浏览器伪装/等待策略/3次重试/指定id重截）"
```

### Task 2: Action 增加 push 自动触发

**Files:**
- Modify: `.github/workflows/friend-screenshots.yml:2-5`（仅 `on:` 区块，其余步骤不动）

**Interfaces:**
- Consumes: Task 1 的脚本（Action 第 25 行已有 `node scripts/友链截图/index.mjs` 调用，自动继承新逻辑）
- Produces: push main 且 `src/content/friends/**` 变化时自动截图并提交回仓库

- [ ] **Step 1: 修改 `on:` 区块为以下内容（其余部分保持原样）**

```yaml
on:
  schedule:
    - cron: "23 3 * * 0"   # 每周日凌晨 3:23
  workflow_dispatch:
  push:
    branches: [main]
    paths: ["src/content/friends/**"]
```

- [ ] **Step 2: YAML 语法校验**

Run: `node -e "const y=require('js-yaml'),f=require('fs');y.load(f.readFileSync('.github/workflows/friend-screenshots.yml','utf8'));console.log('YAML OK')"`
Expected: 输出 `YAML OK`

- [ ] **Step 3: 提交**

```bash
git add .github/workflows/friend-screenshots.yml
git commit -m "feat(friends): 友链截图 Action 新增 push 触发，添加友链后自动截图上线"
```

### Task 3: CLAUDE.md 同步 + 全量验证

**Files:**
- Modify: `CLAUDE.md:21`（第 0 节脚本清单表格行）
- Modify: `CLAUDE.md:183`（友链页支撑系统段落）

**Interfaces:**
- Consumes: Task 1/2 已落地的行为
- Produces: 文档与新行为一致

- [ ] **Step 1: 更新 `CLAUDE.md:21` 表格行**

原文：

```
| `node scripts/友链截图/index.mjs` | 站点截图（Playwright，产物 public/assets/friends-shots/；Action 每周日自动跑） |
```

改为：

```
| `node scripts/友链截图/index.mjs [友链id] [--force]` | 站点截图（Playwright，伪装真实浏览器/等字体+缓冲/3 次尝试；产物 public/assets/friends-shots/{id小写}.webp；Action 每周日全量 + push friends 变化自动跑） |
```

- [ ] **Step 2: 更新 `CLAUDE.md:183` 支撑系统段落**

原文中 `与 `friend-screenshots.yml`（每周日 3:23 Playwright 截图 → public/assets/friends-shots/{contentId}.webp）` 改为：

```
与 `friend-screenshots.yml`（每周日 3:23 全量补漏 + push main 变更 `src/content/friends/**` 时自动触发，Playwright 截图 → public/assets/friends-shots/{contentId}.webp，伪装真实浏览器 + load 后等字体就绪与 1.5s 缓冲，失败 3 次尝试）
```

- [ ] **Step 3: 全量构建验证**

Run: `pnpm build && pnpm check && pnpm type-check`
Expected: 三条命令全部成功退出（build 生成图标 → astro build → pagefind 索引；astro check 无错误；tsc --noEmit 无错误）

- [ ] **Step 4: 提交**

```bash
git add CLAUDE.md
git commit -m "docs(friends): CLAUDE.md 同步友链截图新用法与 push 自动触发"
```

### Task 4: 提交本地待上线的截图产物

**Files:**
- Add: `public/assets/friends-shots/29-jerrylife.webp`、`34-临渊羡鱼.webp`、`35-闪程-猫条的笔记.webp`、`36-secret-blog.webp`（含 Task 1 重截后的最新版本）

**Interfaces:**
- Consumes: Task 1 Step 3 的重截产物与此前生成的 3 张截图
- Produces: 仓库内 4 张截图随 push 上线；Action 端"已有跳过"逻辑可见它们（否则 Action 在 Linux 会重复截一遍）

- [ ] **Step 1: 确认 4 张截图存在且文件名全小写**

Run: `ls public/assets/friends-shots | grep -E "^(29|34|35|36)"`
Expected: 列出 4 个文件，无大写字母

- [ ] **Step 2: 提交**

```bash
git add public/assets/friends-shots
git commit -m "chore(friends): 补充友链站点截图（29/34/35/36）"
```

- [ ] **Step 3: 提醒用户**

告知用户：push 后 Action 会自动部署背景图上线；用户工作区其余改动（friends.astro、bills 组件等）本计划未动，由用户自行决定何时提交。

---

## 自审记录

- 规格覆盖：伪装浏览器 ✓（Task 1 UA/context）、等待策略 ✓（fonts.ready + 1500ms）、3 次重试 30s 超时 ✓、命令行参数 ✓（Step 1 代码 + Step 3/4/5 验证）、Action push 触发 ✓（Task 2）、CLAUDE.md 同步 ✓（Task 3）、边界（失败列表/降级重试）为既有行为不动 ✓
- 占位符扫描：无 TBD/TODO，所有代码步骤含完整代码，所有 Run 步骤含预期输出
- 类型一致性：`takeShot(entry)` 定义与调用一致；`argId`/`force` 命名全程一致；产物路径 `{id}.webp` 与 friends.astro 的 `shotExists(item.id)` 拼法一致
