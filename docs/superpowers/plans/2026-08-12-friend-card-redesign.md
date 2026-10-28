# 友链卡片重设计 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `/friends/` 友链页卡片重做为清羽飞扬风格（站点截图卡 + hover 全家桶 + 状态徽标），新增两个 GitHub Action 支撑系统（Playwright 截图、Node 延迟检测），并添加「友链墓碑」纪念区块。

**Architecture:** 服务端渲染三个区块（新朋友/我的朋友们/更多伙伴，已上线），卡片组件重写为「截图整卡背景 + 下半部信息」结构；交互全部走事件委托 + 守卫变量（符合 CLAUDE.md 第 8/9 节）；截图与延迟数据由 GitHub Action 定时生成提交仓库，前端降级容错（无截图 → 纯头像卡，无状态 JSON → 隐藏徽标）。

**Tech Stack:** Astro 7.1.6、Svelte 5、Tailwind v4（原子类 + CSS）、Playwright、Node 22+、GitHub Actions。

## Global Constraints

- 本项目**无测试框架**：验证手段 = `pnpm check` + `pnpm build` + dev 浏览器实测
- 包管理仅 pnpm（preinstall 强制）；禁止 Python 脚本（一律 Node）
- 禁止新增 `!important`、硬编码 `#000/#fff`，颜色一律 `var(--*)` 令牌；暗色选择器 `:root.dark`
- 事件监听遵守 CLAUDE.md 第 8 节（AbortController/委托/清理）+ 第 9 节（`window.__xxx` guard）
- i18n 新键必须 5 语言同步（en/zh_CN/zh_TW/ja/ru）
- `.pages.yml` 字段必须与 `src/content.config.ts` zod 对齐（merge:false，未声明字段保存被丢弃）
- 提交信息用中文；每任务结束必须 `pnpm build` 验证
- spec 参考：`docs/superpowers/specs/2026-08-12-friend-card-design.md`

---

### Task 0: 提交区块化改版基线

**Files:**
- Commit: 当前工作区全部 50 个未提交文件（friends 区块化改版：schema、.pages.yml、38 个友链数据、friends.astro、i18n×5、CLAUDE.md、scripts/回填友链字段）

**Interfaces:**
- Consumes: 无
- Produces: 干净基线——后续任务 diff 只含本次改动

- [ ] **Step 1: 检查并提交**

```bash
cd E:/GithubProgect/MyRunProject/dumplingandcakeblog
git add -A
git status --short | wc -l   # 期望 50
git commit -m "feat(friends): 友链页区块化改版（新朋友/我的朋友们/更多伙伴 + added/group 字段回填）"
```

- [ ] **Step 2: 验证基线**

```bash
pnpm check    # 期望 0 errors
```

---

### Task 1: tombstones 内容集合

**Files:**
- Modify: `src/content.config.ts`（collections 注册处 283-296 行）
- Modify: `.pages.yml`（apps 集合声明之后）
- Create: `src/content/tombstones/.gitkeep`（空目录，git 不跟踪空目录）
- Modify: `src/i18n/i18nKey.ts` + `src/i18n/languages/{en,zh_CN,zh_TW,ja,ru}.ts`

**Interfaces:**
- Consumes: 无
- Produces: 集合 `tombstones`，schema 字段 `title: string` / `avatar?: string` / `note?: string`；i18n 键 `friendsTombstone` / `friendsTombstoneDesc`

- [ ] **Step 1: 注册集合**（`src/content.config.ts`，`appsCollection` 定义之后加）

```ts
const tombstonesCollection = defineCollection({
	loader: glob({ pattern: "**/*.md", base: "./src/content/tombstones" }),
	schema: z.object({
		title: z.string(),
		avatar: z.string().optional(),
		note: z.string().optional(),
	}),
});
```

并在 `export const collections`（283-296 行）追加 `tombstones: tombstonesCollection,`。

- [ ] **Step 2: 同步 .pages.yml**（`apps` 集合声明块之后追加）

```yaml
      - name: tombstones
        label: 🪦 友链墓碑
        type: collection
        path: src/content/tombstones
        format: yaml-frontmatter
        filename:
          template: "{primary}.md"
          field: create
        view:
          primary: title
          fields: [title, note]
          sort: ["title asc"]
        fields:
          - name: title
            label: 站点名
            type: string
            required: true

          - name: avatar
            label: 头像链接
            type: string

          - name: note
            label: 备注
            type: string
            description: 下线原因、时间等
```

- [ ] **Step 3: 建空目录**

```bash
mkdir -p src/content/tombstones && touch src/content/tombstones/.gitkeep
```

- [ ] **Step 4: i18n 键**（`src/i18n/i18nKey.ts` 在 `friendsMore = "friendsMore"` 后加）

```ts
	friendsTombstone = "friendsTombstone",
	friendsTombstoneDesc = "friendsTombstoneDesc",
```

- [ ] **Step 5: 5 语言翻译**（各语言文件 `[Key.friendsMore]` 行后插入）

zh_CN.ts:
```ts
	[Key.friendsTombstone]: "🪵 友链墓碑 · 相逢何必曾相识",
	[Key.friendsTombstoneDesc]: "此处记录的友链因长期无法访问、站点关闭、或友链反链丢失，长期未更新(一年)等原因，由站长慎重考虑后，手动下线。若因技术问题导致下线，欢迎站长修复后随时联系恢复。若站点已停止维护，则可能不再接受恢复请求。",
```
en.ts:
```ts
	[Key.friendsTombstone]: "🪵 Friend Link Tombstones · Those who once walked beside us",
	[Key.friendsTombstoneDesc]: "These links were manually retired after being unreachable for a long time, shut down, losing reciprocal links, or dormant for over a year. If a site returns, feel free to contact us to restore it.",
```
zh_TW.ts:
```ts
	[Key.friendsTombstone]: "🪵 友鏈墓碑 · 相逢何必曾相識",
	[Key.friendsTombstoneDesc]: "此處記錄的友鏈因長期無法訪問、站點關閉、或友鏈反鏈丟失，長期未更新(一年)等原因，由站長慎重考慮後，手動下線。若因技術問題導致下線，歡迎站長修復後隨時聯繫恢復。",
```
ja.ts:
```ts
	[Key.friendsTombstone]: "🪵 リンク墓碑 · 出会いはなぜ偶然",
	[Key.friendsTombstoneDesc]: "ここに記録されたリンクは、長期間アクセス不可・サイト閉鎖・相互リンク消失・一年以上の更新停止などの理由で、管理人により慎重に検討した上で手動で下線されました。技術的な問題によるものであれば、復旧後にいつでもご連絡ください。",
```
ru.ts:
```ts
	[Key.friendsTombstone]: "🪵 Надгробия дружеских ссылок · Та, что была, не вернётся",
	[Key.friendsTombstoneDesc]: "Эти ссылки были вручную сняты после долгой недоступности, закрытия сайта, потери взаимности или более года без обновлений. Если сайт вернётся — свяжитесь с нами для восстановления.",
```

- [ ] **Step 6: 验证 + 提交**

```bash
pnpm check   # 期望 0 errors
git add -A && git commit -m "feat(friends): 新增 tombstones 友链墓碑集合（schema + PagesCMS 声明 + i18n）"
```

---

### Task 2: 墓碑区块渲染

**Files:**
- Modify: `src/pages/friends.astro`
- Modify: `src/styles/pages/friends.css`

**Interfaces:**
- Consumes: Task 1 的 `tombstones` 集合、`I18nKey.friendsTombstone` / `friendsTombstoneDesc`
- Produces: `.tombstone-section` 区块（空集合时不渲染）；CSS 类 `.tombstone-section/-desc/-list/-item/-avatar/-name`

- [ ] **Step 1: friends.astro 数据准备**（frontmatter 中 `moreFriends` 定义之后）

```ts
// 友链墓碑（纪念下线的友链，空集合时不渲染区块）
const tombstoneEntries = await getCollection("tombstones");
```

- [ ] **Step 2: 墓碑区块模板**（「更多伙伴」section 之后、`<Markdown>` 之前插入）

```astro
      <!-- 友链墓碑：纪念因失联/关闭而下线的友链 -->
      {
        tombstoneEntries.length > 0 && (
          <section class="tombstone-section">
            <h2 class="tombstone-title">{i18n(I18nKey.friendsTombstone)}</h2>
            <div class="tombstone-desc">
              <blockquote>
                <p>{i18n(I18nKey.friendsTombstoneDesc)}</p>
              </blockquote>
            </div>
            <div class="tombstone-list">
              {
                tombstoneEntries.map((entry) => (
                  <span class="tombstone-item">
                    {entry.data.avatar && <img class="tombstone-avatar" src={entry.data.avatar} alt="" loading="lazy" />}
                    <span class="tombstone-name">{entry.data.title}</span>
                  </span>
                ))
              }
            </div>
          </section>
        )
      }
```

- [ ] **Step 3: tombstone 样式**（`src/styles/pages/friends.css` 末尾追加）

```css
/* ============================================
   友链墓碑（纪念下线的友链）
   ============================================ */
.tombstone-section {
	margin-top: 3rem;
}

.tombstone-title {
	margin: 0;
	font-size: 1.12rem;
	font-weight: 800;
	letter-spacing: -0.02em;
	color: var(--deep-text);
}

.tombstone-desc {
	margin-top: 0.35rem;
	margin-bottom: 1rem;
	font-size: 0.9375rem;
	line-height: 1.65;
	color: color-mix(in oklch, var(--deep-text) 60%, transparent);
}

.tombstone-desc blockquote {
	margin: 0;
	padding-left: 0.85rem;
	border-left: 3px solid color-mix(in oklch, var(--primary) 30%, transparent);
}

.tombstone-list {
	display: flex;
	flex-wrap: wrap;
	gap: 0.75rem;
	line-height: 1;
}

.tombstone-item {
	display: inline-flex;
	align-items: center;
	gap: 0.35rem;
	white-space: nowrap;
	color: color-mix(in oklch, var(--deep-text) 65%, transparent);
	text-decoration-line: underline;
	text-decoration-color: color-mix(in oklch, var(--deep-text) 30%, transparent);
	text-underline-offset: 4px;
	transition: color 200ms ease, text-decoration-color 200ms ease, transform 200ms ease;
}

.tombstone-item:hover {
	color: var(--primary);
	text-decoration-color: var(--primary);
	transform: translateY(-2px);
}

.tombstone-avatar {
	width: 14px;
	height: 14px;
	flex-shrink: 0;
	border-radius: 50%;
	object-fit: cover;
}

.tombstone-name {
	font-size: 0.9375rem;
	font-weight: 500;
}
```

- [ ] **Step 4: 验证 + 提交**

```bash
pnpm check && pnpm build    # 期望全绿（空集合 → 页面无墓碑区块）
git add -A && git commit -m "feat(friends): 友链墓碑区块渲染（空集合自动隐藏）"
```

---

### Task 3: FriendCard.astro 重写（截图卡结构）

**Files:**
- Modify: `src/components/features/FriendCard.astro`（全量重写）

**Interfaces:**
- Consumes: 页面传入 props（见下）
- Produces: `Props: { title, href, imgurl, desc, tags?, screenshot? }`——`screenshot` 不存在时不渲染截图层（`.friend-card--no-shot` 由父级加 class）

- [ ] **Step 1: 重写组件**

```astro
---
export interface Props {
	title: string;
	href: string;
	imgurl: string;
	desc: string;
	tags?: string[];
	screenshot?: string;
}

const { title, href, imgurl, desc, tags = [], screenshot } = Astro.props;

// 类型标签：标明是文档还是博客（沿用旧逻辑）
const tagLabels: Record<string, string> = {
	Blog: "博客",
	Docs: "文档",
};
const primaryTag = tags[0] || "Blog";
const tagLabel = tagLabels[primaryTag] || primaryTag;

// 头像加载失败 / 骨架占位使用的首字
const initial = title.trim().slice(0, 1);
---

<div
  class="friend-card"
  role="link"
  tabindex="0"
  data-href={href}
  data-siteurl={href}
  data-title={title}
>
  {/* 鼠标跟随光晕 */}
  <div class="friend-card-glow" aria-hidden="true"></div>

  {/* 整卡背景：站点截图（无截图时不渲染此层） */}
  {screenshot && (
    <div class="friend-siteshot" aria-hidden="true">
      <img src={screenshot} alt="" loading="lazy" />
    </div>
  )}

  <div class="friend-body">
    <div class="friend-main">
      {/* 头像（沿用 data-src 懒加载 + 涂鸦 fallback 机制） */}
      <div class="friend-avatar-wrap">
        <div class="friend-card-avatar" data-initial={initial}>
          <span class="friend-card-avatar__face" aria-hidden="true"></span>
          <img
            alt={title}
            class="friend-card-avatar__img"
            data-src={imgurl}
          />
        </div>
        <a
          class="friend-avatar-overlay"
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={title}
        >
          <span class="friend-avatar-overlay__icon" aria-hidden="true">↗</span>
        </a>
      </div>
      <div class="friend-name-wrap">
        <span class="friend-name">{title}</span>
      </div>
    </div>

    <p class="friend-desc">{desc}</p>

    {/* 访问状态徽标：页面 JS 注入，无数据时隐藏 */}
    <span class="friend-status-tag" data-siteurl={href} hidden>
      <span class="friend-status-dot" aria-hidden="true"></span>
      <span class="friend-status-text"></span>
    </span>
  </div>

  {/* 顶部类型标签（胶带样式缩小版，保留手绘基因） */}
  <span class="friend-card-tab">{tagLabel}</span>
</div>
```

**说明**：`data-siteurl` 在卡片根节点和徽标上各一份（根节点供状态注入匹配，徽标直接填充文本）。外链图标用文本 `↗` 避免引入新图标依赖（参考站为 SVG，本项目用 `material-symbols:arrow-outward-rounded` 需在父级注入，先文本简化，Task 5 若需要再换 Icon）。

- [ ] **Step 2: 验证 + 提交**

```bash
pnpm check   # 期望 0 errors（样式在 Task 4，此步仅结构）
git add -A && git commit -m "refactor(friends): FriendCard 重写为截图卡结构（截图/光晕/状态徽标占位）"
```

---

### Task 4: friend-card.css 重写

**Files:**
- Modify: `src/styles/components/friend-card.css`（全量重写）

**Interfaces:**
- Consumes: Task 3 的 DOM 结构（.friend-card / -glow / -siteshot / -body / -main / -avatar-wrap / -overlay / -name / -desc / -status-tag / -tab）
- Produces: 全套卡片样式 + 涂鸦头像机制（保留旧 .friend-card-avatar__face 系列）

- [ ] **Step 1: 重写样式**（整文件替换；令牌全部来自 `var(--*)`）

```css
/* ============================================
   友链卡片 — 截图卡（清羽飞扬风格）
   结构：截图整卡背景 + 下半部（头像/名字/描述）+ 右上角状态徽标
   头像沿用 data-src 懒加载 + 涂鸦 fallback
   ============================================ */

.friend-card {
	position: relative;
	display: flex;
	flex-direction: column;
	width: 100%;
	overflow: hidden;
	border-radius: 16px;
	background: color-mix(in oklch, var(--card-bg) 55%, transparent);
	border: 1px solid color-mix(in oklch, var(--border) 40%, transparent);
	cursor: pointer;
	text-decoration: none;
	transition: box-shadow 300ms ease, border-color 300ms ease;
}

.friend-card:hover {
	box-shadow: 0 4px 20px color-mix(in oklch, var(--primary) 8%, transparent),
		inset 0 0 30px color-mix(in oklch, var(--primary) 3%, transparent);
	border-color: color-mix(in oklch, var(--primary) 25%, transparent);
}

.friend-card:focus-visible {
	outline: 2px dashed var(--primary);
	outline-offset: 3px;
}

/* 鼠标跟随光晕 */
.friend-card-glow {
	position: absolute;
	inset: 0;
	z-index: 2;
	background: radial-gradient(
		300px circle at var(--mouse-x, 50%) var(--mouse-y, 50%),
		color-mix(in oklch, var(--primary) 8%, transparent),
		transparent 60%
	);
	opacity: 0;
	pointer-events: none;
	transition: opacity 350ms ease;
}

.friend-card:hover .friend-card-glow {
	opacity: 1;
}

/* 整卡背景：站点截图，hover 放大 6% */
.friend-siteshot {
	position: absolute;
	inset: 0;
	z-index: 0;
}

.friend-siteshot img {
	width: 100%;
	height: 100%;
	object-fit: cover;
	transform: scale(1);
	transition: transform 400ms ease;
}

.friend-card:hover .friend-siteshot img {
	transform: scale(1.06);
}

/* 信息区：叠在截图下方（无截图时 .friend-card--no-shot 收紧） */
.friend-body {
	position: relative;
	z-index: 1;
	display: flex;
	flex-direction: column;
	gap: 0.4rem;
	padding: 4.5rem 0.8rem 0.8rem;
	margin-top: auto;
	background: linear-gradient(
		to top,
		var(--card-bg) 55%,
		color-mix(in oklch, var(--card-bg) 85%, transparent) 85%,
		transparent
	);
}

.friend-card--no-shot .friend-body {
	padding-top: 0.8rem;
	background: none;
}

.friend-main {
	display: flex;
	align-items: center;
	gap: 0.6rem;
}

/* 头像（38px 圆，沿用涂鸦 fallback） */
.friend-avatar-wrap {
	position: relative;
	width: 2.35rem;
	height: 2.35rem;
	flex-shrink: 0;
	border-radius: 999px;
	overflow: hidden;
}

.friend-card-avatar {
	position: relative;
	width: 100%;
	height: 100%;
	border-radius: 50%;
	border: 2px solid color-mix(in oklch, var(--border) 60%, transparent);
	transition: border-color 300ms ease;
	overflow: hidden;
}

.friend-card:hover .friend-card-avatar {
	border-color: color-mix(in oklch, var(--primary) 50%, transparent);
}

.friend-card-avatar__face {
	position: absolute;
	inset: 0;
	opacity: 0;
	background:
		radial-gradient(circle at 25% 12%, var(--meta-divider) 15%, transparent 16%),
		radial-gradient(circle at 50% 6%, var(--meta-divider) 18%, transparent 19%),
		radial-gradient(circle at 75% 12%, var(--meta-divider) 15%, transparent 16%),
		radial-gradient(ellipse at 50% 22%, var(--meta-divider) 45%, transparent 46%),
		var(--inline-code-bg);
}

.friend-card-avatar.is-error .friend-card-avatar__face {
	opacity: 1;
}

.friend-card-avatar__img {
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
	object-fit: cover;
	opacity: 0;
	z-index: 1;
	transition: opacity 400ms ease;
}

.friend-card-avatar.is-loaded .friend-card-avatar__img {
	opacity: 1;
}

.friend-card-avatar.is-error .friend-card-avatar__img {
	display: none;
}

/* hover 白圆覆盖层 + 外链图标 */
.friend-avatar-overlay {
	position: absolute;
	inset: 0;
	z-index: 3;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 999px;
	background: rgba(255, 255, 255, 0.75);
	color: var(--primary);
	opacity: 0;
	transition: opacity 200ms ease;
}

:root.dark .friend-avatar-overlay {
	background: rgba(0, 0, 0, 0.6);
}

.friend-avatar-wrap:hover .friend-avatar-overlay {
	opacity: 1;
}

.friend-avatar-overlay__icon {
	font-size: 1rem;
	font-weight: 700;
	line-height: 1;
}

/* 名字 */
.friend-name-wrap {
	min-width: 0;
}

.friend-name {
	display: block;
	font-size: 1rem;
	font-weight: 700;
	color: var(--deep-text);
	line-height: 1.3;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

/* 描述：单行省略 */
.friend-desc {
	margin: 0;
	font-size: 0.8125rem;
	line-height: 1.5;
	color: var(--content-meta);
	display: -webkit-box;
	-webkit-box-orient: vertical;
	-webkit-line-clamp: 1;
	line-clamp: 1;
	overflow: hidden;
}

/* 访问状态徽标（JS 注入，四色档位） */
.friend-status-tag {
	position: absolute;
	top: 0.55rem;
	right: 0.55rem;
	z-index: 4;
	display: inline-flex;
	align-items: center;
	gap: 0.35rem;
	padding: 0.18rem 0.5rem;
	border-radius: 999px;
	font-size: 0.6875rem;
	font-weight: 600;
	font-variant-numeric: tabular-nums;
	border: 1px solid color-mix(in oklch, var(--friend-status-color) 28%, transparent);
	background: color-mix(in oklch, var(--card-bg) 70%, transparent);
	color: var(--friend-status-color);
	backdrop-filter: blur(4px);
	transition: transform 200ms ease, border-color 200ms ease, background 200ms ease;
}

.friend-card:hover .friend-status-tag {
	transform: translateY(-1px);
	border-color: color-mix(in oklch, var(--friend-status-color) 42%, transparent);
	background: color-mix(in oklch, var(--friend-status-color) 14%, color-mix(in oklch, var(--card-bg) 76%, transparent));
}

.friend-status-dot {
	width: 0.42rem;
	height: 0.42rem;
	flex-shrink: 0;
	border-radius: 999px;
	background: currentcolor;
	box-shadow: 0 0 0 3px color-mix(in oklch, var(--friend-status-color) 12%, transparent);
}

.friend-status-tag--fast { --friend-status-color: #15803d; }
.friend-status-tag--ok { --friend-status-color: var(--primary); }
.friend-status-tag--slow { --friend-status-color: #b45309; }
.friend-status-tag--down { --friend-status-color: #dc2626; }

:root.dark .friend-status-tag--fast { --friend-status-color: #4ade80; }
:root.dark .friend-status-tag--slow { --friend-status-color: #fbbf24; }
:root.dark .friend-status-tag--down { --friend-status-color: #fb7185; }

/* 顶部类型标签（缩小版胶带） */
.friend-card-tab {
	position: absolute;
	top: 0.45rem;
	left: 0.55rem;
	z-index: 4;
	padding: 0.14rem 0.6rem;
	font-size: 0.625rem;
	font-weight: 700;
	letter-spacing: 0.08em;
	color: var(--deep-text);
	background: color-mix(in oklch, var(--deep-text) 14%, transparent);
	border: 1px solid color-mix(in oklch, var(--deep-text) 22%, transparent);
	border-radius: 2px 5px 2px 6px;
	backdrop-filter: blur(2px);
}

/* 尊重减少动画偏好 */
@media (prefers-reduced-motion: reduce) {
	.friend-card,
	.friend-card-glow,
	.friend-siteshot img,
	.friend-status-tag {
		transition: none;
	}
}
```

- [ ] **Step 2: 验证 + 提交**

```bash
pnpm check && pnpm build    # 期望全绿
git add -A && git commit -m "style(friends): friend-card.css 重写为截图卡风格（光晕/缩放/状态徽标/涂鸦保留）"
```

---

### Task 5: friends.astro 页面改造 + 交互 JS

**Files:**
- Modify: `src/pages/friends.astro`
- Modify: `src/styles/pages/friends.css`（grid 改 4 列 + 区块徽标）

**Interfaces:**
- Consumes: Task 3/4 的卡片结构与样式；`public/assets/friends-shots/`（截图，Task 7 生成）；`public/friends-status.json`（Task 6 生成）
- Produces: 三个区块渲染新 props；区块计数徽标；三个守卫 JS：光晕跟随 / 整卡点击 / 状态注入

- [ ] **Step 1: frontmatter 数据准备**（`moreFriends` 之后加）

```ts
import fs from "node:fs";
import path from "node:path";

// 站点截图：public/assets/friends-shots/{contentId}.webp，不存在则不传（卡片退化为纯头像卡）
const shotsDir = path.join(process.cwd(), "public", "assets", "friends-shots");
const shotExists = (id: string) => fs.existsSync(path.join(shotsDir, `${id}.webp`));

// 域名（new URL().host，取不到时回退空串）
const hostOf = (siteurl: string) => {
	try {
		return new URL(siteurl).host;
	} catch {
		return "";
	}
};
```

- [ ] **Step 2: 三个区块的卡片传新 props**（三处 `.map` 中 `<FriendCard>` 全部替换为）

```astro
<FriendCard
  title={item.data.title}
  href={item.data.siteurl}
  imgurl={item.data.imgurl}
  desc={item.data.desc}
  tags={item.data.tags}
  screenshot={shotExists(item.id) ? `/assets/friends-shots/${item.id}.webp` : undefined}
/>
```

并在每处外层 div 上：`class={"friend-card" + (shotExists(item.id) ? "" : " friend-card--no-shot")}`。

- [ ] **Step 3: 区块标题加计数徽标**（三处 `<span class={sectionCountClass}>` 替换为）

```astro
<span class="friend-group-badge">{myFriends.length}</span>
```

`friend-group-badge` 样式（friends.css 追加）：

```css
/* 区块计数徽标（毛玻璃 + 主题色，参考站 group-badge） */
.friend-group-badge {
	padding: 0.2rem 0.55rem;
	border-radius: 999px;
	border: 1px solid color-mix(in oklch, var(--primary) 15%, transparent);
	background: color-mix(in oklch, var(--primary) 8%, transparent);
	color: var(--primary);
	font-size: 0.875rem;
	font-weight: 600;
	backdrop-filter: blur(8px);
}
```

- [ ] **Step 4: grid 改 4 列**（friends.css 中 `.friends-grid` 的 `grid-template-columns: repeat(3, 1fr)` 改为 `repeat(4, 1fr)`，gap 改 `1rem 0.85rem`）

- [ ] **Step 5: 交互 JS**（替换现有懒加载守卫 script 为三合一守卫，`window.__friendCardReady`）

```html
  <!-- 友链卡片交互：光晕跟随 / 整卡点击 / 头像懒加载 / 状态注入（守卫 + 事件委托） -->
  <script is:inline>
    (function() {
      if (window.__friendCardReady) return;
      window.__friendCardReady = true;

      /* --- 头像懒加载（沿用旧 loadAvatar 逻辑） --- */
      function loadAvatar(card) {
        var img = card.querySelector(".friend-card-avatar__img");
        if (!img || img.dataset.avatarLoaded) return;
        img.dataset.avatarLoaded = "1";
        var wrap = img.parentElement;
        var src = img.dataset.src;
        if (!wrap || !src) return;
        var TIMEOUT = 5000;
        var timer = setTimeout(function() {
          if (!wrap.classList.contains("is-loaded")) wrap.classList.add("is-error");
        }, TIMEOUT);
        img.addEventListener("load", function() {
          clearTimeout(timer);
          wrap.classList.remove("is-error");
          wrap.classList.add("is-loaded");
        });
        img.addEventListener("error", function() {
          clearTimeout(timer);
          wrap.classList.add("is-error");
        });
        img.src = src;
        if (img.complete && img.naturalWidth > 0) {
          clearTimeout(timer);
          wrap.classList.remove("is-error");
          wrap.classList.add("is-loaded");
        }
      }

      var io = null;
      function bindAvatarObserver() {
        if (io) io.disconnect();
        var cards = document.querySelectorAll(".friend-card");
        if (!cards.length) return;
        io = new IntersectionObserver(function(entries) {
          entries.forEach(function(entry) {
            if (!entry.isIntersecting) return;
            loadAvatar(entry.target);
            io.unobserve(entry.target);
          });
        }, { rootMargin: "200px 0px" });
        cards.forEach(function(card) { io.observe(card); });
      }

      /* --- 鼠标跟随光晕（事件委托到容器，一次绑定） --- */
      function bindGlow() {
        document.querySelectorAll("[data-friends-grid]").forEach(function(grid) {
          if (grid.dataset.glowBound) return;
          grid.dataset.glowBound = "1";
          grid.addEventListener("mousemove", function(e) {
            var card = e.target.closest(".friend-card");
            if (!card) return;
            var rect = card.getBoundingClientRect();
            card.style.setProperty("--mouse-x", (e.clientX - rect.left) + "px");
            card.style.setProperty("--mouse-y", (e.clientY - rect.top) + "px");
          });
        });
      }

      /* --- 整卡点击（事件委托：click / Enter / Space） --- */
      function bindCardClick() {
        document.addEventListener("click", function(e) {
          var card = e.target.closest(".friend-card");
          if (!card || e.target.closest("a")) return; // 头像 overlay 链接优先
          var href = card.dataset.href;
          if (href) window.open(href, "_blank", "noopener,noreferrer");
        });
        document.addEventListener("keydown", function(e) {
          if (e.key !== "Enter" && e.key !== " ") return;
          var card = e.target.closest(".friend-card");
          if (!card) return;
          var href = card.dataset.href;
          if (href) { e.preventDefault(); window.open(href, "_blank", "noopener,noreferrer"); }
        });
      }

      /* --- 状态注入：fetch friends-status.json 按 siteurl 匹配 --- */
      var statusFetched = false;
      function bindStatus() {
        if (statusFetched) return;
        statusFetched = true;
        fetch("/friends-status.json")
          .then(function(r) { if (!r.ok) throw new Error("status json missing"); return r.json(); })
          .then(function(data) {
            var sites = data.sites || {};
            document.querySelectorAll(".friend-card").forEach(function(card) {
              var info = sites[card.dataset.siteurl];
              var tag = card.querySelector(".friend-status-tag");
              if (!tag || !info) return;
              tag.classList.add("friend-status-tag--" + info.status);
              tag.querySelector(".friend-status-text").textContent =
                info.status === "down" ? "DOWN" : (info.ms + " MS");
              tag.hidden = false;
            });
          })
          .catch(function() { /* 无 JSON：静默隐藏徽标 */ });
      }

      function init() {
        bindAvatarObserver();
        bindGlow();
        bindStatus();
      }

      init();
      document.addEventListener("astro:page-load", init);
      document.addEventListener("swup:content:replaced", init);
    })();
  </script>
```

**注意**：原 `data-friends-grid` 属性仍保留在三个区块的 grid 容器上（用作光晕委托的作用域）；原「添加友链」滚动 script 保留不动；`bindCardClick` 中 `window.open` 每次导航绑定一次（guard 防重复），事件委托在 document 上。

- [ ] **Step 6: 验证 + 提交**

```bash
pnpm check && pnpm build
# dev 实测：pnpm dev 后浏览器访问 /friends/
#   - 卡片显示截图 + 头像/名字/描述 + 胶带标签
#   - hover：截图放大、光晕跟随鼠标、头像边框变主题色、白圆图标浮现、整卡柔光
#   - 点击卡片 / Enter 跳转；小头像 hover 白圆点击也跳转
#   - 无截图卡片正常降级（--no-shot）；无 friends-status.json 时徽标隐藏
git add -A && git commit -m "feat(friends): 页面接入截图卡（props/徽标/光晕/整卡点击/状态注入 JS）"
```

---

### Task 6: 访问延迟检测（Node 脚本 + Action）

**Files:**
- Create: `scripts/友链状态检测/index.mjs`
- Create: `.github/workflows/friend-status.yml`

**Interfaces:**
- Consumes: `src/content/friends/*.md` 的 `siteurl`
- Produces: `public/friends-status.json`，结构 `{ "timestamp": "2026-08-12T05:00:00Z", "sites": { "<siteurl>": { "status": "fast|ok|slow|down", "ms": 620|null } } }`

- [ ] **Step 1: 检测脚本**

```js
/* 友链状态检测：逐个 fetch 友链 siteurl 测响应时间，输出 public/friends-status.json
   用法：node scripts/友链状态检测/index.mjs   （结果提交回仓库由 Action 完成） */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const FRIENDS_DIR = path.join(import.meta.dirname, "../../src/content/friends");

// 解析 frontmatter 的 siteurl（不引入 gray-matter，简单正则即可）
function readSiteurls() {
	const sites = [];
	for (const f of fs.readdirSync(FRIENDS_DIR).filter((x) => x.endsWith(".md"))) {
		const raw = fs.readFileSync(path.join(FRIENDS_DIR, f), "utf8");
		const m = raw.match(/^siteurl:\s*(.+)$/m);
		if (m) sites.push(m[1].trim().replace(/^["']|["']$/g, ""));
	}
	return sites;
}

// 分档阈值（ms）
const FAST = 800;
const SLOW = 3000;
const TIMEOUT = 8000;

async function check(url) {
	const start = performance.now();
	try {
		const res = await fetch(url, {
			method: "HEAD",
			redirect: "follow",
			signal: AbortSignal.timeout(TIMEOUT),
		});
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		const ms = Math.round(performance.now() - start);
		return { status: ms < FAST ? "fast" : ms < SLOW ? "ok" : "slow", ms };
	} catch {
		// HEAD 失败（部分站点不支持）→ 退化 GET
		try {
			const start2 = performance.now();
			const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(TIMEOUT) });
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const ms = Math.round(performance.now() - start2);
			return { status: ms < FAST ? "fast" : ms < SLOW ? "ok" : "slow", ms };
		} catch {
			return { status: "down", ms: null };
		}
	}
}

const sites = readSiteurls();
const out = { timestamp: new Date().toISOString(), sites: {} };
for (const url of sites) {
	out.sites[url] = await check(url);
	console.log(`${out.sites[url].status.padEnd(5)} ${String(out.sites[url].ms ?? "-").padStart(6)}ms  ${url}`);
}

const outPath = path.join(import.meta.dirname, "../../public/friends-status.json");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n");
console.log(`\n已写入 ${outPath}（${sites.length} 个站点）`);
```

- [ ] **Step 2: workflow**（`.github/workflows/friend-status.yml`）

```yaml
name: 友链状态检测
on:
  schedule:
    - cron: "17 5 * * *"   # 每天 5:17（避开整点）
  workflow_dispatch:

permissions:
  contents: write

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: node scripts/友链状态检测/index.mjs
      - name: 提交结果
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add public/friends-status.json
          git diff --cached --quiet || git commit -m "chore: 更新友链状态检测结果"
          git push
```

- [ ] **Step 3: 本地验证 + 提交**

```bash
node scripts/友链状态检测/index.mjs    # 期望输出各站点状态行 + 生成 public/friends-status.json
head -20 public/friends-status.json    # 检查 JSON 结构
pnpm build                             # 确认构建不报错
git add -A && git commit -m "feat(friends): 友链状态检测脚本 + GitHub Action 定时任务"
```

---

### Task 7: 站点截图（Playwright 脚本 + Action）

**Files:**
- Create: `scripts/友链截图/index.mjs`
- Create: `.github/workflows/friend-screenshots.yml`

**Interfaces:**
- Consumes: `src/content/friends/*.md` 的 `siteurl` 与文件名（contentId）
- Produces: `public/assets/friends-shots/{contentId}.webp`（宽 640 webp；失败站点跳过并记录）

- [ ] **Step 1: 截图脚本**

```js
/* 友链站点截图：Playwright 无头浏览器逐个访问友链站点，压缩为 640 宽 webp
   用法：node scripts/友链截图/index.mjs   （产物提交回仓库由 Action 完成）
   依赖：pnpm add -D playwright（chromium） */

import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import sharp from "sharp";

const FRIENDS_DIR = path.join(import.meta.dirname, "../../src/content/friends");
const OUT_DIR = path.join(import.meta.dirname, "../../public/assets/friends-shots");

function readEntries() {
	const entries = [];
	for (const f of fs.readdirSync(FRIENDS_DIR).filter((x) => x.endsWith(".md"))) {
		const raw = fs.readFileSync(path.join(FRIENDS_DIR, f), "utf8");
		const m = raw.match(/^siteurl:\s*(.+)$/m);
		if (m) entries.push({ id: f.replace(/\.md$/, ""), url: m[1].trim().replace(/^["']|["']$/g, "") });
	}
	return entries;
}

const entries = readEntries();
fs.mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
const ok = [];
const failed = [];
for (const entry of entries) {
	const outPath = path.join(OUT_DIR, `${entry.id}.webp`);
	if (fs.existsSync(outPath)) { console.log(`⏭  已有 ${entry.id}.webp`); continue; }
	const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
	try {
		await page.goto(entry.url, { waitUntil: "networkidle", timeout: 20000 });
		const buf = await page.screenshot({ type: "png" });
		await sharp(buf).resize({ width: 640 }).webp({ quality: 75 }).toFile(outPath);
		ok.push(entry.id);
		console.log(`✅ ${entry.id}  ${entry.url}`);
	} catch (e) {
		failed.push(`${entry.id}（${e.message.slice(0, 60)}）`);
		console.log(`❌ ${entry.id}  ${entry.url}`);
	} finally {
		await page.close();
	}
}
await browser.close();

console.log(`\n完成：成功 ${ok.length}，失败 ${failed.length}`);
if (failed.length) console.log("失败列表：\n  " + failed.join("\n  "));
```

- [ ] **Step 2: 安装依赖**

```bash
pnpm add -D playwright
pnpm exec playwright install chromium
```

（`pnpm-lock.yaml` 会更新；workflow 中缓存 `~/.cache/ms-playwright` 加速）

- [ ] **Step 3: workflow**（`.github/workflows/friend-screenshots.yml`）

```yaml
name: 友链站点截图
on:
  schedule:
    - cron: "23 3 * * 0"   # 每周日凌晨 3:23
  workflow_dispatch:

permissions:
  contents: write

jobs:
  shots:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: corepack enable && pnpm install --frozen-lockfile
      - uses: actions/cache@v4
        with:
          path: ~/.cache/ms-playwright
          key: ms-playwright-${{ runner.os }}
      - run: pnpm exec playwright install chromium --with-deps
      - run: node scripts/友链截图/index.mjs
      - name: 提交截图
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add public/assets/friends-shots
          git diff --cached --quiet || git commit -m "chore: 更新友链站点截图"
          git push
```

- [ ] **Step 4: 本地跑一次 + 提交**

```bash
node scripts/友链截图/index.mjs     # 期望：逐个截图，输出 ✅/❌ 列表（超时 20s/站）
ls public/assets/friends-shots | wc -l
pnpm check && pnpm build
git add -A && git commit -m "feat(friends): 友链站点截图脚本 + GitHub Action 定时任务 + 首批截图"
```

---

### Task 8: CLAUDE.md 同步

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: 更新文档**

1. 第 0 节命令表追加：
   | `pnpm`（无新命令） | 友链截图/状态检测为一次性脚本：`node scripts/友链截图/index.mjs`、`node scripts/友链状态检测/index.mjs` |
2. 第 2 节 `scripts/` 描述：8 个 → 10 个中文脚本目录（追加「友链截图」「友链状态检测」）
3. 第 3.4 节集合表：追加 `| tombstones | 友链墓碑（title/avatar/note，2026-08 新增） |`，并注明 12 → 13 集合
4. 第 19 节：注明 .pages.yml 现声明 12 个集合（含 tombstones）
5. 第 16 节技术栈：追加 `playwright`（devDep，截图 Action 用）

- [ ] **Step 2: 验证 + 提交**

```bash
pnpm check
git add -A && git commit -m "docs: CLAUDE.md 同步友链截图/状态检测脚本与 tombstones 集合"
```

---

## Self-Review 记录

- **Spec 覆盖**：§1.1 卡片结构 → Task 3；§1.2 样式 → Task 4；§1.3 光晕 JS → Task 5；§1.4 整卡点击 → Task 5；§2 数据（域名推导/截图路径/状态 JSON）→ Task 5/6/7；§3 截图 Action → Task 7；§4 状态 Action → Task 6；§5 清单 → 全部任务；§6 墓碑 → Task 1/2；§7 验证 → 各任务 Step。✓
- **占位符**：无 TBD/TODO。✓
- **类型一致性**：`friend-status-tag--{fast|ok|slow|down}`（Task 4 CSS ↔ Task 5 JS classList 一致）；`data-siteurl`（Task 3 组件 ↔ Task 5 fetch 匹配一致）；`friend-card--no-shot`（Task 3/5 一致）。✓
