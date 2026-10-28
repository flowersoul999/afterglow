# 动态评论聊天室重构 Implementation Plan（修订版）

> 目标：删除动态详情页，所有动态共用同一个聊天室弹窗。点击任意动态卡片右下角的评论按钮，弹出与留言板同款的聊天室（桌面端居中弹窗、移动端抽屉/底抽），发送时自动带上 `发布时间 + 摘要` 的引用块。

## 0. 对你原话的理解与纠正

你原话有两处表述需要精确化，避免后续实现跑偏：

1. **“所有动态共用同一个评论卡片 / 共用这一个评论按钮”** —— 准确含义是：**所有动态共用同一个 Waline 频道 `/moments/` 和同一个弹窗组件实例**。不是把所有卡片的按钮合并成一个物理按钮。实际是：每张 `MomentCard` 右下角仍各有一个“评论”按钮，但点击任意一个都打开同一个 `MomentCommentChat` 弹窗，并预填对该条动态的引用。卡片本身不再各自挂载 Waline。
2. **“目前移动端和桌面端的聊天室样式都有 bug”** —— 这句话过于宽泛。结合代码现状，bug 的具体所指是：旧的 `CommentModal.svelte` 是按 `path=/moments/{id}/` 逐条隔离的弹窗，与新需求的单频道不符；且其 `chat-workspace: 1fr 11rem`、`modal-card` 尺寸、移动端 640px 断点与留言板 `guestbook-chat.css` 的 `1fr 18rem / 768px 抽屉 + overlay` 不一致，导致样式与交互（滚动、侧栏、遮罩）对不上。重构标准就是：**以 `GuestbookChat.svelte + guestbook-chat.css` 为标杆**，复用其双栏、抽屉、滚动、同步状态等实现。

> 若以上理解与你的预期不一致，请直接指出，我按你的更正继续改方案，不要让我猜。

## 1. 现状与标杆

**现状（以仓库当前为准）：**
- `src/pages/moments.astro:138` 仍挂载 `CommentModal client:load`，`src/components/moments/MomentCard.astro:10` 保留 `detail?: boolean` 与 `card-comment-section / waline-{id}` 详情分支，`src/pages/moments/[slug].astro` 仍通过 `getStaticPaths` 生成详情页（与“详情页不需要了”冲突）。
- 已提交的 `src/utils/moment-chat.ts` 与 `src/components/moments/MomentCommentChat.svelte` 实现了 `>>MOMENT>>...<<MOMENT<<` 协议与 `window.__momentComment` 单例，但尚未在 `moments.astro` 中挂载，也未删除旧的逐条 `CommentModal` 路径。
- `src/components/comment/CommentModal.svelte` 仍是逐条 `path=/moments/{id}/` 的实现，包含独立的侧栏、加载动画与 `field` 输入，不应再作为动态页的主路径。

**标杆（必须照抄的参考）：**
- `src/components/features/GuestbookChat.svelte`：`CHANNEL="/guestbook/"`、`PAGE_SIZE=30`、30s 轮询、`AbortController` 合并、`merge/flatten/normalize`、`localState: sending/failed` 乐观更新、`isNearBottom` 与回到底部、离线/可见性处理、`GuestbookChatMessage/Composer` 复用。
- `src/styles/components/guestbook-chat.css`：`grid-template-rows: auto minmax(0,1fr)`、`workspace: minmax(0,1fr) var(--guestbook-sidebar-width)`、`@768px` 切 `display:block + 侧栏 translateX(100%) + overlay` 抽屉、`header` 桌面/移动双形态、骨架/空状态/历史按钮等。

## 2. 架构决策

- **单频道 Waline**：`MOMENT_CHANNEL = "/moments/"`，所有动态的评论都落到这一个 `path` 下查询与发送，不再按 `moment.id` 分流。
- **引用协议**：`>>MOMENT>>id||published||excerpt<<MOMENT<<\nbody`，`published` 取 `moment.data.published.toISOString()`（消息内再格式化展示），`excerpt` 取 `moment.body` 纯文本截断 80 字符并把换行替换为空格（避免破坏首行解析）。解析失败则视为无引用。
- **组件复用**：`MomentCommentChat.svelte` 拷 `GuestbookChat.svelte` 的数据流与子组件，`GuestbookChatMessage` 负责气泡、`GuestbookChatComposer` 负责输入，样式复用 `guestbook-chat.css`，仅新增 `.moment-quote` / `.moment-comment-modal` 弹窗壳。
- **交互**：`MomentCard` 仅负责触发 `window.__momentComment.open(id, published, excerpt)` 并预填 `momentQuote`；`MomentCommentChat` 负责弹窗开关、引用预览、发送后清空引用、乐观更新与轮询。
- **Swup/单例**：`window.__momentComment` guard 跨导航复用，不改 `swup-lifecycle-controller.ts`，监听器用 `AbortController`，`onMount` 清理 `pollTimer/dataController/mediaCleanup`。

## 3. 文件结构

**已存在（需校验与对齐）：**
- `src/utils/moment-chat.ts` — `MOMENT_CHANNEL / MOMENT_QUOTE_RE / buildMomentBody / parseMomentQuote / normalizeMomentComment / flattenMomentComments / mergeMomentMessages` 等
- `src/types/moment-chat.ts` — `MomentQuote / MomentChatMessage`
- `src/components/moments/MomentCommentChat.svelte` — 单频道弹窗主体

**本次改动：**
- 修改 `src/components/moments/MomentCard.astro` — 删除 `detail` 分支与 `card-comment-section`，保留 `data-moment-id/published/excerpt` 供按钮触发
- 修改 `src/pages/moments.astro` — 移除 `CommentModal`，挂载 `MomentCommentChat client:only="svelte"`，保留访客统计与无限滚动
- 删除 `src/pages/moments/[slug].astro` — 详情页不再需要
- 修改 `src/styles/components/guestbook-chat.css` 或新增覆写 — 仅补充 `.moment-quote` 与 `.moment-comment-modal__overlay/panel`，复用既有 `workspace 1fr 18rem` 与 `@768` 抽屉
- 可选清理 `src/components/comment/CommentModal.svelte` — 动态页不再引用，是否删除由你确认（建议先保留，待动态页验证通过后再删）

## 4. 任务拆解

### Task 1 — 协议层 `moment-chat.ts` 校验

**文件：** `src/utils/moment-chat.ts`、`src/types/moment-chat.ts`
**做：** 校验已提交的 `MOMENT_QUOTE_RE = /^>>MOMENT>>(.+?)<<MOMENT<<\n?/s` 与 `buildMomentBody/parseMomentQuote` 的分隔符 `||` 是否与 `excerpt` 清洗一致；补齐 `parseMomentMessageBody` 去首行后 `trim`；确认 `normalizeMomentComment` 的 `orig || htmlToPlainText` 与 `isAdminNick` 复用 `guestbookConfig.adminNicknames`。
**验：** `node --input-type=module -e "import{buildMomentBody,parseMomentQuote} from './src/utils/moment-chat.ts'; const b=buildMomentBody({id:'abc',published:'2026-08-20T00:00:00.000Z',excerpt:'hello world'},'正文'); console.log(parseMomentQuote(b))"` 期望 `{id:'abc', ...}`；`pnpm check` 0 error。
**提交：** 若需改动则 `feat(moments): fix moment-chat quote codec`，否则跳过。

### Task 2 — 聊天室 `MomentCommentChat.svelte` 对齐留言板

**文件：** `src/components/moments/MomentCommentChat.svelte`
**做：** 以 `GuestbookChat.svelte` 为逐行对照源：`CHANNEL="/moments/"`、`PAGE_SIZE/POLL_INTERVAL/MIN/MAX`、`profile/auth/draft` 三存储键（`moment-chat-*` 隔离）、`fetchPage` 带 `token/signal`、`loadInitial/syncLatest/loadOlder/startPolling`、`isNearBottom/scrollToBottom/preserveInitialBottomWhileMediaLoads`、`validateComposer/validateMessageBody`、`sendMessage` 经 `buildMomentBody(quote, content)` 落库、`send后清空 momentQuote`、`window.__momentComment` guard。样式上：弹窗壳 `position:fixed inset:0 / z-index:var(--z-modal) / overlay oklch(0 0 0 / 0.42) + blur`，面板 `min(100%,58rem) x min(92dvh,46rem)`，内容区直接复用 `.guestbook-chat` 的 `workspace/sidebar/messages/composer`，移动端 `≤768px` 走 `guestbook-chat.css` 既有抽屉逻辑。
**验：** `pnpm check` 0 error；本地 `pnpm dev` 打开 `/moments/` 点击任意卡片评论按钮能弹层、引用块显示 `published + excerpt`、发送后引用清空、消息列表出现带引用块的新消息。
**提交：** `feat(moments): align moment comment chat to guestbook`

### Task 3 — 简化 `MomentCard`（去详情分支）

**文件：** `src/components/moments/MomentCard.astro`
**做：** 删除 `detail` prop 与 `detail && card-comment-section / waline-mount / comment-loader` 分支；卡片底部保留标签与 `comment-toggle-btn`，按钮补 `data-moment-id / data-moment-published / data-moment-excerpt`（`excerpt` 纯文本 `slice(0,80)`），不再区分 `!detail` 条件。点击由全局委托触发，不在卡片内各自初始化 Waline。
**验：** `pnpm build` 输出无 `moments/[slug]` 路由；`grep -rn "detail" src/components/moments` 0 命中。
**提交：** `refactor(moments): simplify card, remove detail branch`

### Task 4 — 挂载弹窗与删除详情页

**文件：** `src/pages/moments.astro`、`src/pages/moments/[slug].astro`、`src/layouts/Layout.astro`（如需）
**做：** `moments.astro` 顶部 `import MomentCommentChat from "@/components/moments/MomentCommentChat.svelte"`，底部用 `<MomentCommentChat client:only="svelte" />` 替换 `<CommentModal client:load .../>`；删除 `src/pages/moments/[slug].astro`（`git rm`）；若 `Layout.astro` 需兜底点击委托，则在 Swup 容器内用 `document.addEventListener("click", e=>{ const btn=e.target.closest(".comment-toggle-btn"); if(btn) window.__momentComment?.open(...) })` 并用 `window.__xxx` guard，非必要则由 `moments.astro` 内联脚本委托即可，不改 `swup-lifecycle-controller.ts`。
**验：** `pnpm build` 报 `470+ page(s) built` 且无 `moments/[slug]`；`pnpm check` 0 error；浏览器从首页 Swup 导航进 `/moments/` 再点评论仍可弹层。
**提交：** `feat(moments): wire chat modal, remove detail page`

### Task 5 — 样式与移动端对齐

**文件：** `src/styles/components/guestbook-chat.css`、`src/components/moments/MomentCommentChat.svelte` 的 `<style>`
**做：** 不复制整套 `guestbook-chat.css`，仅覆写弹窗壳与引用块：`.moment-comment-modal / __overlay / __panel`、` .moment-quote{ border-left:3px solid var(--primary); background:var(--guestbook-panel)}`，其余 `header/workspace/sidebar/messages/composer` 完全复用；确认 `@768px` 下侧栏为 `translateX(100%) -> is-open` 抽屉且 `overlay` 可点关，`workspace` 切 `display:block`，移动端弹窗 `100dvh` 全屏。
**验：** 桌面端弹窗居中、遮罩可点关、Esc 可关；移动端全屏、侧栏按钮可开抽屉、输入区不被 `mobile-dock` 遮挡（复用 `--guestbook-mobile-dock-clearance`）。
**提交：** `style(moments): reuse guestbook layout, fix mobile drawer`

### Task 6 — 校验、清理与文档

**文件：** `CLAUDE.md`、`src/content/changelog/YYYY-MM-DD-moments-comment.md`、`.pages.yml`（如涉及）
**做：** 跑 `pnpm build && pnpm check && pnpm exec biome ci ./src` 全绿；浏览器实测：多条动态各点评论均进同一频道、引用块正确、发送/编辑/删除/离线/轮询均与留言板一致；写 `changelog`（`version: "v1.24.0" type: feature description: 动态评论改为单频道聊天室，带引用块，复用留言板`）；同步 `CLAUDE.md` 第 2/13/21 节的组件与样式计数；确认 `.pages.yml` 无需新增字段（动态评论走 Waline 非 Content Collection）。
**提交：** `docs(changelog): moments comment chat unified` + `docs(spec): sync CLAUDE`

## 5. 验收标准

- 无 `src/pages/moments/[slug].astro` 路由，`MomentCard` 无 `detail` 分支。
- `/moments/` 点击任意卡片评论按钮均弹出同一个聊天室，输入框上方显示 `引用动态 · {published}` 与摘要，发送后引用清空，新消息自带引用块且复用 `guestbook-chat.css` 的气泡与时间样式。
- 桌面端为居中弹窗、移动端为全屏+抽屉侧栏，与 `GuestbookChat` 的断点与交互一致，无布局错位与滚动异常。
- `pnpm build + pnpm check + biome ci` 全绿。

## 6. 自检

- 未新建 `!important`、未硬编码 `#000/#fff`、未新建 Stylus、未改 `swup-lifecycle-controller.ts`、Svelte 变量均 `$state`、非 void 标签未自闭合。
- `window.__momentComment` 单例与 `AbortController` 清理已覆盖 Swup 导航。
- 方案中所有 `buildMomentBody/parseMomentQuote` 签名在 Task1 与 Task2 一致，无 TODO 占位。
