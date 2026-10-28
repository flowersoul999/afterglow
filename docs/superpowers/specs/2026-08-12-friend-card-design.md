# 友链卡片重设计：清羽飞扬风格（截图卡 + 状态徽标）

日期：2026-08-12
状态：已与用户确认设计，待实施

## Context

用户对 `/friends/` 页面的友链卡片不满意：现有手绘风卡片（胶带标签 + 涂鸦头像 + 稿纸背景）**太大、不够好看**。用户提供参考站 [清羽飞扬的友链页](https://blog.liushen.fun/link/)（其友链正好包含在本站友链中），要求复刻该风格。2026-08-12 已完成的区块化改版（新朋友 / 我的朋友们 / 更多伙伴 三区块）**保留**，只重做卡片本身及其两个支撑系统。

参考站实现已实测拆解（通过 chrome-devtools 读取真实 DOM 与 CSS）：
- 卡片 257×184px，4 列网格，16px 圆角，半透明毛玻璃底
- **整卡背景 = 站点截图**，hover 时截图 `scale(1.06)` 放大
- 下半部压着：38px 圆头像 + 名字 + 域名 + 单行描述
- 右上角状态徽标：四色小圆点 + 延迟毫秒（fast 绿 / ok 蓝 / slow 橙 / down 红）
- hover 全家桶：鼠标跟随光晕（radial-gradient 跟随 `--mouse-x/--mouse-y`）+ accent 色柔光阴影 + 头像边框变色 + 小头像上白色半透明圆覆盖层浮现外链图标
- 整卡可点击（`role="link"` + `data-href`，点击跳转）

## 已确认的决策

| 项 | 决策 |
|---|---|
| 卡片视觉 | 完整复刻参考站（截图卡 + hover 全家桶） |
| 站点截图 | **GitHub Action + Playwright 自动截**，定时刷新，产物提交仓库 |
| 访问延迟 | **GitHub Action + Node 脚本**定时检测（本项目规范禁 Python），生成 JSON 提交仓库，前端加载展示 |
| 区块结构 | 保留三区块（✨ 新朋友 / 🧑🤝🧑 我的朋友们 / 🌐 更多伙伴），每组标题右侧加毛玻璃计数徽标（参考站 group-badge） |
| 头像 fallback | 沿用现有涂鸦脸机制（`data-src` + `.is-error` 显示涂鸦） |
| schema | **零改动**（域名推导、截图路径约定、状态 JSON 均无需新字段） |

## 1. 卡片视觉设计

### 1.1 结构（FriendCard.astro 重写）

```
<div class="friend-card" role="link" tabindex="0" data-href={siteurl}>
  <div class="friend-card-glow" aria-hidden="true"></div>          ← 鼠标跟随光晕
  <div class="friend-siteshot" aria-hidden="true">
    <img src={screenshot} loading="lazy" alt="">                   ← 整卡背景截图
  </div>
  <div class="friend-body">
    <div class="friend-main">
      <div class="friend-avatar-wrap">                             ← 38px 圆，overflow hidden
        <img class="friend-avatar" data-src={imgurl} alt={title}>  ← 保留懒加载机制
        <a class="friend-avatar-overlay" href={siteurl} target="_blank" rel="noopener noreferrer" aria-label={title}>
          <Icon name="material-symbols:arrow-outward-rounded" />   ← hover 浮现白圆 + 外链图标
        </a>
      </div>
      <div class="friend-name-wrap">
        <span class="friend-name">{title}</span>
        <span class="friend-host">{host}</span>                    ← new URL(siteurl).host
      </div>
    </div>
    <p class="friend-desc">{desc}</p>
    <span class="friend-status-tag" data-status={status}>          ← 由 friends-status.json 注入，无数据则隐藏
      <span class="friend-status-dot"></span>
      {delayMs} MS
    </span>
  </div>
</div>
```

### 1.2 关键样式（friend-card.css 重写）

- `.friend-card`：flex column，16px 圆角，半透明背景 `color-mix(in srgb, var(--card-bg) 20%, transparent)`，`overflow: hidden`，cursor pointer
- `.friend-card-glow`：absolute inset 0，`background: radial-gradient(300px circle at var(--mouse-x,50%) var(--mouse-y,50%), color-mix(in srgb, var(--primary) 8%, transparent), transparent 60%)`，hover 时 opacity 0→1，pointer-events none
- `.friend-card:hover`：`box-shadow: 0 4px 20px color-mix(in srgb, var(--primary) 8%, transparent)` 柔光
- `.friend-siteshot img`：整卡铺满（`width/height 100%` object-fit cover），`transition: transform 0.4s`，hover 时 `scale(1.06)`；截图加载失败时隐藏（fallback 显示纯色背景 + 头像）
- `.friend-avatar`：38px 圆，`border: 2px solid color-mix(in srgb, var(--border) 60%, transparent)`，hover 变 `var(--primary)` 50%
- `.friend-avatar-overlay`：absolute inset 0，白圆 `rgba(255,255,255,0.75)`（dark: `rgba(0,0,0,0.6)`），accent 色图标，opacity 0→1 transition 0.2s
- `.friend-body`：`padding: 4.5rem 0.8rem 0.8rem`（给截图让位），内容叠在截图下方；**无截图时**（`.friend-card--no-shot`）padding-top 降为 0.8rem，卡片退化为纯头像卡
- `.friend-name`：1rem/700；`.friend-host`：小字 meta 色（带锁图标可选，先不做）
- `.friend-desc`：0.8125rem，单行省略（line-clamp 1）
- `.friend-status-tag`：右上角 absolute，`border: 1px solid color-mix(in srgb, var(--status-color) 28%, transparent)` + 半透明底 + 小圆点（`::before`，带 3px 同色光晕）；四档色：fast `#15803d`（dark `#4ade80`）/ ok 主题色 / slow `#b45309`（dark `#fbbf24`）/ down `#dc2626`（dark `#fb7185`）；hover 时上浮 1px + 底色加深
- 网格：`.friends-grid` 改 4 列（lg 3 列 / 中 2 列 / 小 1 列），gap 0.85rem

### 1.3 鼠标跟随光晕 JS

`friend-card` 上加 mousemove 监听更新 `--mouse-x/--mouse-y` CSS 变量（`e.clientX - rect.left`）。**注意事件规范**（CLAUDE.md 第 8 节）：Swup 容器内组件用 AbortController 或事件委托；每个 `.friend-card` 只绑一次（`data-bound` guard 或事件委托到 `.friends-grid` 容器，一次绑定全部卡片，最省）。

### 1.4 整卡点击

`role="link"` + `tabindex="0"`，click/Enter 跳转 `data-href`。事件委托到网格容器。外链用 `window.open` 或 a 模拟（注意 a11y：聚焦样式 `:focus-visible` outline）。

## 2. 数据与字段（零 schema 改动）

| 数据 | 来源 |
|---|---|
| 站点名 / 描述 / 头像 | 现有 frontmatter（title/desc/imgurl） |
| 域名 | `new URL(siteurl).host` 推导 |
| 站点截图 | 约定路径 `public/assets/friends-shots/{contentId}.webp`（contentId = 文件名去 .md），存在则显示，不存在则隐藏截图区（卡片退化为纯头像卡） |
| 状态/延迟 | `public/friends-status.json`（Action 生成）：`{ "timestamp": "...", "sites": { "<siteurl>": { "status": "fast\|ok\|slow\|down", "ms": 620 } } }`，前端 fetch 后按 siteurl 匹配注入；文件缺失时整页隐藏状态徽标（本地 dev 不报错） |

## 3. 支撑系统一：站点截图自动化

- 新建 `scripts/友链截图/index.mjs`：读取 `src/content/friends/*.md` → Playwright（chromium）逐个 `page.goto(siteurl, waitUntil: "networkidle")` → 视口 1280×800 截图 → sharp 压缩为 webp（宽 640 足够，参考站 255px 显示）→ 写入 `public/assets/friends-shots/{contentId}.webp`
  - 失败（超时/证书/拒绝连接）→ 跳过并记录，不中断
  - 超时 20s/站，总超时保护
- 新建 `.github/workflows/friend-screenshots.yml`：`schedule: cron "0 3 * * 0"`（每周日凌晨 3 点）+ `workflow_dispatch` 手动触发；步骤：checkout → pnpm install（或仅安装 playwright 依赖，用 cache 加速）→ 运行脚本 → `git commit` 截图产物 → push 回 main
  - 注意：push 回仓库会触发 EdgeOne Pages 构建 → 自动上线新截图 ✓
- 首次执行由实施阶段手动跑一次（`node scripts/友链截图/index.mjs`），补齐 38 站截图，避免等一周

## 4. 支撑系统二：访问延迟检测

- 新建 `scripts/友链状态检测/index.mjs`（Node，禁 Python）：
  - 读取 friends 集合（或直接读 md）→ 对每个 `siteurl` 发 `fetch`（HEAD 优先，HEAD 不支持则 GET，`redirect: "follow"`），`AbortSignal.timeout(8000)`
  - 记录 `ms`（performance.now 差值）；成功按阈值分档：`< 800` fast / `< 3000` ok / 其余 slow；失败/超时 → down（ms 为 null，前端徽标显示 "DOWN"）
  - 输出 `public/friends-status.json`（key 为 siteurl）
- 新建 `.github/workflows/friend-status.yml`：`schedule: cron "0 5 * * *"`（每天凌晨 5 点）+ `workflow_dispatch`；跑脚本 → commit JSON → push
  - 准确率问题（国外 Action 环境测国内站点）：先不做代理（阈值已放宽），后续若误报多再加梨酱 API / Cloudflare Worker 代理（参考清羽方案，可配置环境变量）
- 前端：`friends.astro` 内联 script（守卫模式，符合第 8/9 节）：fetch `friends-status.json` → 构建 `siteurl → status` Map → 给每个 `.friend-card[data-siteurl]` 注入徽标；失败（404/网络）静默隐藏

## 5. 前端改造清单

| 文件 | 改动 |
|---|---|
| `src/components/features/FriendCard.astro` | 重写为截图卡结构（1.1） |
| `src/styles/components/friend-card.css` | 全部重写（1.2），涂鸦头像机制保留 |
| `src/styles/pages/friends.css` | `.friends-grid` 改 4 列 + 区块徽标样式；新增 `.friend-group-badge` |
| `src/pages/friends.astro` | 传 `screenshot`/`host`/`siteurl` props；区块标题加计数徽标；新增光晕/点击/状态注入 JS（守卫 + 事件委托）；渲染墓碑区块 |
| `src/utils/friends-status.ts`（可选） | 状态 JSON 类型定义 + 解析工具 |
| `src/content.config.ts` + `src/content/tombstones/` | 新集合 tombstones（§6.1） |
| `.pages.yml` | 同步声明 tombstones 集合 |
| `src/i18n/i18nKey.ts` + 5 语言文件 | 新增 2 键：friendsTombstone（标题）、friendsTombstoneDesc（说明文案） |
| `.github/workflows/friend-screenshots.yml` | 新建 |
| `.github/workflows/friend-status.yml` | 新建 |
| `scripts/友链截图/index.mjs` + `scripts/友链状态检测/index.mjs` | 新建 |
| `CLAUDE.md` | 第 2 节 scripts 清单 + 第 0 节命令 + 第 3.4 节集合表（+tombstones）+ 反模式/架构说明同步 |

**不改动**：friends 集合 schema（added/group 已上线）、区块数据逻辑。

## 6. 友链墓碑区块（用户追加需求，2026-08-12 确认）

复刻参考站页面底部的「🪵 友链墓碑 · 相逢何必曾相识」区块：纪念因失联/关闭/反链丢失而手动下线的友链。

### 6.1 数据：新内容集合 `tombstones`

- 新建 `src/content/tombstones/` 集合（12 集合 → 13），schema：
  ```ts
  const tombstonesCollection = defineCollection({
      loader: glob({ pattern: "**/*.md", base: "./src/content/tombstones" }),
      schema: z.object({
          title: z.string(),          // 站点名（必填）
          avatar: z.string().optional(),  // 头像 URL（可选，无头像只显示名字）
          note: z.string().optional(),    // 备注（可选，如下线原因/时间）
      }),
  });
  ```
- `src/content.config.ts` `collections` 注册 + **`.pages.yml` 同步声明新集合**（title 必填 / avatar / note 可选），CMS 后台可维护
- 初始为空目录（可加 `README.md` 说明？不需要，CMS 管理即可）；**空集合时区块不渲染**，不影响现有页面

### 6.2 页面与样式（friends.astro + 新 CSS）

```
<section class="tombstone-section">        ← margin-top: 3rem
  <h2>🪵 友链墓碑 · 相逢何必曾相识</h2>     ← 复用 friend-group-title 风格（1.12rem/800）
  <div class="tombstone-desc">             ← 灰字 0.9375rem/1.65，margin-bottom 1rem
    <blockquote>                           ← border-left 3px var(--primary) 30%，padding-left 0.85rem
      💡 说明：此处记录的友链因长期无法访问、站点关闭、或友链反链丢失，长期未更新(一年)等原因，由站长慎重考虑后，手动下线。
      若因技术问题导致下线，欢迎站长修复后随时联系恢复。…
    </blockquote>
  </div>
  <div class="tombstone-list">             ← flex wrap，gap 0.75rem
    <span class="tombstone-item">          ← 下划线 text-decoration（30% 前景色），hover 上浮 2px + 主题色
      <img class="tombstone-avatar">       ← 14px 圆（可选字段，无 avatar 只渲染名字）
      <span class="tombstone-name">luo</span>
    </span>
    …
  </div>
</section>
```

- 位置：`friends.astro` 中「更多伙伴」区块之后、`<Markdown>` 内容之前
- 区块标题文案走 i18n（`friendsTombstone` 键），说明文案也走 i18n（`friendsTombstoneDesc`，5 语言同步）
- 墓碑项 hover：`color: var(--primary)` + `text-decoration-color: var(--primary)` + `translateY(-2px)`
- 样式放 `src/styles/pages/friends.css`（tombstone 系列）

### 6.3 验证

- 空集合时页面无墓碑区块；添加一个测试条目后区块出现、hover 效果正常
- `pnpm check` / `pnpm build` 通过（新集合 schema 校验）

---

## 7. 验证

1. `pnpm check` + `pnpm build` 全绿
2. `pnpm dev` 浏览器验证：
   - 截图卡正常显示（截图 + 头像 + 名字/域名/描述 + 状态徽标）
   - hover：截图放大、光晕跟随鼠标、头像边框变色、白圆图标浮现、整卡柔光
   - 点击整卡 / Enter 跳转；小头像 overlay 点击也可跳转
   - 无截图/无状态 JSON 的卡片优雅降级
   - Swup 导航往返后交互正常（无重复绑定）
   - console 无报错
3. 本地手动跑一次截图脚本 + 状态检测脚本，产物检查（webp 存在、JSON 结构正确）
4. （部署后）Action 定时任务触发一次，确认产物提交回仓库并触发 EdgeOne 重建
