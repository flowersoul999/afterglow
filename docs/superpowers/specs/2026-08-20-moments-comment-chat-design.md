# 动态评论聊天室重构设计

> **状态**：已通过 brainstorming，用户确认方案 A 单频道 `"/moments/"` + `>>MOMENT>>` 引用，照搬留言板双栏。

**Goal**：删动态详情页，全部动态共用一个聊天室弹窗，点卡片右下评论按钮弹留言板同款聊天室，评论带 `发布时间+正文摘要` 引用块，桌面 `1fr 18rem` 双栏、移动端抽屉，复用 `GuestbookChat` 的 Waline 鉴权/乐观更新/轮询/表情/图片/净化。

**Architecture**：单 Waline 频道 `"/moments/"` 存储，`src/utils/moment-chat.ts` 复用 `guestbook-chat` 协议层并新增 `MOMENT_QUOTE` 编解码，`src/components/moments/MomentCommentChat.svelte` 复用 `GuestbookChat*` 的 Message/Composer/Sidebar 与 `guestbook-chat.css`，`MomentCard` 仅触发 `open(momentId)` 预填引用，全局 `window.__momentComment` 单例。

**Tech Stack**：Astro 7.1.6 + Svelte 5 runes + Tailwind v4 + `@waline/api 1.1.2` + `marked+gfm` + `guestbook-chat.css` token，`pnpm 9.14 / Node >=22 / Biome 2.5.7`

---

## 1. 删详情页

**Files**
- Delete: `src/pages/moments/[slug].astro`
- Modify: `src/components/moments/MomentCard.astro:10` 去 `detail` prop、`L281` `card-comment-section` 与 `L41-117` 内联 Waline 初始化脚本、`L264` 保留 `data-moment-id/data-moment-excerpt/data-moment-published` 供引用
- Modify: `src/layouts/Layout.astro:323` 删 `__momentsCommentHandler` 中 `loadWalineComment` 残留分支，保留 `click .comment-toggle-btn → window.__momentComment.open()`
- Modify: `src/utils/swup-lifecycle-controller.ts:408` 保留无限滚动，删评论相关

## 2. 数据层 `src/utils/moment-chat.ts`

**Interfaces**
- Consumes: `commentConfig.waline.serverURL`, `guestbookConfig.adminNicknames`, `Waline Comment {objectId, nick, comment, orig, time, type, user_id, browser, os, addr}`
- Produces: `MOMENT_QUOTE_RE`, `buildMomentBody(quote, body): string`, `parseMomentQuote(comment): {id,published,excerpt}|null`, `normalizeMomentComment()`, `flattenMomentComments()`, `mergeMomentComments()`, `uploadMomentImage()`, `loadMomentEmojiPacks()`

**Encoding**
```
>>MOMENT>>${id}||${published.toISOString()}||${excerpt.slice(0,80).replace(/\n/g," ")}<<MOMENT<<
${userBody}
```
`excerpt` 取 `moment.body.replace(/[#*`]/g,"").trim().slice(0,80)`，`published` 用 `formatDateI18n` 展示，`parse` 后供 `MomentQuotePreview` 渲染与 `onJump` 高亮。

复用 `guestbook-chat.ts:39` 的 `WALINE_INLINE_IMAGE_SIZE_LIMIT 128k`、`SAFE_IMAGE_SOURCE 180k`、`sanitizeGuestbookHtml` 白名单。

## 3. 聊天室 `src/components/moments/MomentCommentChat.svelte`

**Reuse**
- Copy `src/components/features/GuestbookChat.svelte:62` 的 `messages/profile/authUser/draft/replyTarget/pollTimer/dataController` 状态与 `fetchPage/loadInitial/syncLatest/loadOlder/startPolling` 轮询 `30s` + `visibility/online` 监听
- Props: `serverURL`, `adminNicknames`, `channelPath="/moments/"`, `pageSize=30`
- Global: `window.__momentComment = {open(id), close()}`，`open` 时 `replyTarget = {id, published, excerpt}` 并 `focusComposer()`

**Subcomponents**
- `GuestbookChatMessage.svelte:41` 直接复用，`quotePreview` 改为 `parseMomentQuote` 的 `published+excerpt`，`onJump` → `document.querySelector([data-moment-id="${id}"])?.scrollIntoView({behavior:"smooth",block:"center"}) + highlight 1.6s`
- `GuestbookChatComposer.svelte:70` 直接复用，`MAX_DRAFT 300`、`:key:` ↔ `![key](url)`、拖拽高度、图片远端/base64 分流

**UI**
- 样式：`@import "src/styles/components/guestbook-chat.css"` 并覆写 `--chat-accent: var(--primary)`，结构 `header(在线人数+刷新) / workspace(grid 1fr 18rem) / sidebar-desktop / sidebar-mobile(drawer translateX 100% + overlay)`，移动断点 `@768` 与留言板一致，`Composer` 底部 `padding-bottom: calc(mobile-dock-clearance + safe-area)`
- 复用 `CommentSidebarDesktop/Mobile.svelte` 展示 `commenters` 去重与 `count`

## 4. 卡片交互

`MomentCard.astro:264` `.comment-toggle-btn` 保留 `data-moment-id`，`Layout.astro` 代理 `click` → `window.__momentComment.open(momentId)`，`open` 时从 `data-moment-*` 取 `published/excerpt` 预填 `replyTarget`，`Composer` 顶部 `MomentQuotePreview` 显示“引用：2026-08-20 · 摘要…”，发送后 `messages` 追加带引用气泡，清空 `replyTarget` 但不关弹窗。

## 5. 历史与校验

- 旧 `"/moments/${id}/"` 评论默认废弃，可选脚本 `scripts/migrate/moments-comments.mjs` 拉旧 `path` 按 `id` 补 `MOMENT_QUOTE` 合并到 `"/moments/"`（`pnpm build` 前一次性执行）
- 校验：访客未填 `nick` 弹 `GuestbookChat.svelte` 同款游客弹窗，`mail` 必填与 `max 300` 复用 `getGuestbookErrorMessage` 对 `401/429/limit` 友好提示
- 鉴权：复用 `guestbookConfig.adminNicknames` 判 `isAdmin`，站长可 `Edit/Delete`（`canManageMessage` 同 `GuestbookChat.svelte:122`）

## 6. 测试与验证

- `pnpm check` + `pnpm build` 0 error，浏览器：桌面弹居中 `dialog` 双栏、移动端 72vh 圆角抽屉、`sendMessage` 乐观 `sending→sent/failed`、`retry`、`loadOlder` 保持滚动、`onJump` 高亮、`swup:content:replaced` 后 `observer` 与 `dataController` 正确 `abort`
