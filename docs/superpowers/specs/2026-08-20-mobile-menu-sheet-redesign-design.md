# 移动端中间按钮菜单重设计 (MobileMenuSheet)

**Date:** 2026-08-20
**Status:** Draft
**Author:** OpenCode Brainstorm
**Related:** `src/components/layout/MobileMenuSheet.astro`, `src/styles/components/mobile-menu-sheet.css`, `src/config/navBarConfig.ts`

## 1. 背景与问题

当前 `MobileMenuSheet`（中间按钮弹出的 Bottom Sheet）将桌面端全部 19 个入口平铺为 4 列网格（文章/分类/归档/说说/相册/留言板/笔记/朋友圈/书架/音乐/影视/足迹/更新日志/应用/关于/友链/赞助/导航/QQ群），无分组、无层级。用户反馈：按键太多分不清，且现有卡片为单层 `rgba(255,255,255,0.7)` 无内高光，显塑料，不符合苹果卡片质感。底部 `MobileDock` 的 5 按钮布局（首页/搜索/菜单/主题/返回）用户表示满意，本次不动。

## 2. 目标

*   将 19 个入口按桌面端已有分组重新装箱，降低认知负担，手机上 3 秒内找到目标
*   重做视觉为真实苹果毛玻璃（多层、内高光、细描边、层次阴影），与站点现有黑白主调一致，不引入彩色渐变等花哨元素
*   保持实用：大热区、键盘可达、Swup 兼容、≤768px 才渲染

非目标：改动底部 Dock、不新增后端接口、不改桌面端导航、不加搜索框（Dock 已有）

## 3. 信息架构

完全复用 `navBarConfig.ts` 的 5 组配置，自动跟随 `siteConfig.pages` 开关：

| 卡片 | 标题 | 入口（3-6项） |
|------|------|---------------|
| 1 | 网站导航 | 导航 (/projects/) — 通栏大卡片，单磁贴居中 |
| 2 | 文章 | 文章 / 分类 / 归档 |
| 3 | 动态 | 说说 / 相册 / 留言板 / 笔记 / 朋友圈 |
| 4 | 记录 | 书架 / 影视 / 音乐 / 足迹 / 应用 / 更新日志 |
| 5 | 关于 | 关于 / 友链 / 赞助 / QQ群 |

*卡片顺序与桌面端一致，QQ群为外链（新标签打开）。总数 19 不删减，仅重分组。*

Sheet 结构自上而下：拖拽条（装饰）→ 标题区（MENU / Explore your world + 关闭×）→ 5 张分组卡片纵向堆叠（gap 12px）→ 底部 safe-area  padding。

每张卡片：头部 10px 大写分组名 + 数量徽标，内部 2 列磁贴网格（图标块 48×48 圆角 12px + 11px 标题），单磁贴最小热区 48px，适合拇指。

## 4. 视觉系统

对齐站点现有设计令牌，不引入新色板：

*   **外层 Sheet**：`background: color-mix(in oklch, var(--page-bg) 84%, transparent)` + `backdrop-filter: blur(24px) saturate(1.8)`，圆角 28px（仅顶部），阴影 `0 -10px 40px rgba(0,0,0,0.08)`，暗色同理用 `var(--page-bg)` 84%
*   **中层卡片**：`background: rgba(255,255,255,0.72)` / 暗色 `rgba(255,255,255,0.08)`，`border: 0.5px solid rgba(0,0,0,0.06)` / 暗色 `rgba(255,255,255,0.12)`，`inset 0 1px 0 rgba(255,255,255,0.65)` 内高光，圆角 20px，阴影 `0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)`，卡片间距 12px
*   **内层磁贴**：图标块 `48×48` 圆角 12px，背景 `color-mix(in oklch, var(--primary) 8%, transparent)`（保持黑白主调，不用彩虹），图标 24px `currentColor`，标题 11px 500，磁贴 `active: scale(0.96)` + 背景加深，无 hover 闪烁
*   **字体**：沿用站点 `ui-monospace` / 系统字体，标题 1.4rem 800，分组名 10px 600 tracking 0.08em
*   **动效**：Sheet `transform translateY(100%) → 0` + `cubic-bezier(0.22,1,0.36,1) 350ms`，遮罩 `opacity 0→1 300ms`，磁贴 `scale 0.96 150ms`，`prefers-reduced-motion` 时降为 150ms 淡入

## 5. 交互与状态

*   打开：点 Dock 中间按钮，图标 menu ↔ close 切换，`is-open` 类驱动 Sheet 与遮罩
*   关闭：点遮罩 / 右上角 × / ESC / 下滑超过 80px / Swup 导航后自动关闭
*   焦点：Sheet 打开时焦点 trapped 在关闭按钮，Tab 循环卡片磁贴，焦点环 `2px solid var(--primary)`，支持键盘 Enter 激活
*   滚动：Sheet `max-height 78vh` + `overflow-y auto`，`-webkit-overflow-scrolling: touch`，`safe-area-inset-bottom` 适配
*   响应式：`@media (min-width: 769px) { display: none }`，桌面端完全不渲染
*   性能：纯 CSS 动画，无新增依赖，图标复用 `astro-icon`

## 6. 数据与依赖

*   数据源：`getCollection("posts")` 仅用于之前统计（保留），菜单项直接来自 `navBarConfig` 的 5 组配置，无需新增 API
*   过滤：根据 `siteConfig.pages.books/moviesGames/musicPage/changelog` 自动隐藏对应磁贴（与桌面端一致）
*   外链：QQ群 `https://qm.qq.com/q/FjkXxV9Hmo` 加 `target="_blank" rel="noopener"`

## 7. 组件拆分

*   `MobileMenuSheet.astro`：负责渲染 5 张卡片、标题区、拖拽条，接收分组数据
*   `mobile-menu-sheet.css`：外层/中层/内层三层样式，暗色与动效
*   `MobileDock.astro` 内联脚本：仅保留 open/close 状态切换与 Swup 清理逻辑，移除重复的 sheet 样式

单测点：分组数量是否与桌面端一致、每张卡片磁贴数是否正确、暗色切换是否同步、键盘可达性、Swup 后是否自动关闭。

## 8. 风险与回退

*   19 项在 5 张卡片内仍可能显多：已按桌面端分组是最符合用户心智的最小分组，若仍觉多，后续可将“关于”卡片折叠为“更多”展开
*   毛玻璃在低端机可能掉帧：已加 `will-change: transform`，并在 `prefers-reduced-motion` 下降级

## 9. 验收标准

*   手机上 3 秒内能定位到任意入口（测试：找“书架”“笔记”“友链”）
*   视觉与 iOS 控制中心一致：有内高光、细描边、层次阴影，非单层白塑料
*   与桌面端分组完全一致，开关同步
*   无障碍与动效：键盘可遍历、ESC 可关闭、深色/浅色/减少动效均正常
