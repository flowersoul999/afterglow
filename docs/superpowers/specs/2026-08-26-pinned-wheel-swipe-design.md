# 置顶区滚轮与滑动切换 — 设计文档

- 日期：2026-08-26
- 状态：设计已确认（方案 A）
- 关联：`src/components/pages/ArticleVirtualList.svelte` 的置顶轮播（`article-list-pinned`）

## 1. 背景

置顶区已从红框角标重做为横向 `content 1fr / cover 0.45fr aspect 2/1` + 标题 4px 红竖线 + 右侧竖点，行为为 `6s` 自动循环、悬停/聚焦暂停、`prefers-reduced-motion` 静止、点竖点可跳，内容与 `grid` 卡复用 `image-pixel-reveal` 像素块链路。用户新增需求：桌面滚轮、移动端手势横滑也能切换置顶。

## 2. 目标 / 非目标

- **目标**：桌面在置顶卡上滚轮即可上下篇切换，移动端在置顶卡上横滑切换；竖滑仍让页面滚动；切换后重播封面的像素块动效。
- **非目标**：改变单列与移动端无图版式、改变 `grid` 的固定 3 列与 `16/10`、改变置顶的横向版式与轮播时长。

## 3. 方案决策

用户选择 **A. 悬停才接管**：仅当指针/手指在 `section.article-list-pinned` 范围内才劫持，外部滚轮与竖滑不拦截，误触最低。单篇置顶 `pinnedPosts.length <= 1` 直接不绑定。

备选 B（始终接管）易误触，C（仅控件上）可用区过小，均不采纳。

## 4. 交互设计

- **桌面滚轮**：监听 `wheel`（`passive: false`），垂直位移阈值约 `±8px`，节流约 `550ms`，`deltaY>0` 下一篇、`deltaY<0` 上一篇，`preventDefault` 后 `goToPinned(±1)` 并重启 6s 定时，同步 `requestAnimationFrame(initCoverLifecycles)` 重播像素块；首尾循环。
- **移动端滑动**：`touchstart` 记 `(x0,y0,t0)`，`touchmove` 当横向位移 `|dx|>28px` 且 `|dx|>|dy|*1.2` 时判为横滑，`preventDefault` 阻断横向滚动；`touchend` 时若横滑成立则按 `dx<0` 下一篇、`dx>0` 上一篇 `goToPinned`，未达阈值或竖滑则放行。容器 `touch-action: pan-y`。
- **共存**：竖滑、页面滚动、`reduced-motion` 下的静止轮播均保留；手势/滚轮触发的切换同样会暂停并重启自动轮播（复用现有 `goToPinned` 的 `stop/start`）。

## 5. 实现要点

- 事件挂在 `section.article-list-pinned` 捕获阶段，Svelte 内 `on:wheel|on:touch*` 或 `onMount` 绑 `addEventListener`，随 `pinnedPosts.length` 变化与 `onMount`/`swup:content:replaced` 重建时解绑。
- 状态：复用 `pinnedActiveIndex / pinnedPaused / startPinnedCarousel / goToPinned / handleLayoutChange`，新增 `wheelLockUntil` 与 `touchStart` 轻量状态，不新增全局 store。
- 动效：沿用 `src/styles/components/image-pixel-reveal.css` 与 `src/utils/article-cover-lifecycle.ts` 的 `is-loading→像素块分散` 链路，切换后 `requestAnimationFrame(initCoverLifecycles)` 重新触发。

## 6. 验证

- `pnpm build` / `pnpm exec biome ci` 通过；本地 `/posts` 的置顶区：桌面悬停滚轮上下滚动切换、非置顶区滚轮正常滚页面、移动端卡上横滑切换而竖滑滚动、单篇不响应、动效在每次切换后重播。

## 7. 风险

- 横竖判定阈值需在小屏真机微调，避免 `28px` 过敏感；`wheel` 的 `deltaMode` 与触控板高频事件需节流；已通过阈值与 500~600ms 锁缓解。
