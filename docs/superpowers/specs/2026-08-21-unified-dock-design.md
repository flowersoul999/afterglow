# 统合右下角浮动按钮设计 (Unified Dock)

**Date:** 2026-08-21
**Status:** Approved - Scheme A
**Author:** OpenCode Brainstorm
**Related:** `FloatingDock.astro`, `MobileDock.astro`, `MobilePostToolbar.astro`, `FloatingButton.astro`

## 1. 背景

当前右下角有 3 套割裂的实现：
- 桌面端 `FloatingDock`（右侧竖排胶囊，标签/分类/公告/音乐/笔记/主题 + 回顶部/回首页/全部文章/目录/回书架）
- 移动端 `MobileDock` 浮动组（三个点展开的主题/音乐/公告 + 回顶部 + 目录/评论/全部文章）
- 移动端 `MobilePostToolbar`（文章页顶部 全部文章|目录 抽屉）

导致“目录”“全部文章”“回顶部”在 3 处重复，显隐逻辑各管各，维护割裂。用户要求合成一套，桌面/手机共用，明确每个页面展示哪些。

## 2. 目标（Scheme A - 苹果胶囊统一Dock）

*   单一组件 `UnifiedDock` 同时服务桌面和移动端，响应式变形（桌面：右侧垂直胶囊居中；手机：右下角圆形悬浮球向上展开）
*   按页面类型明确按钮清单，不再让“全部文章”在首页也出现
*   删除 `MobilePostToolbar`，其功能并入统一 Dock
*   保持苹果毛玻璃语言，与菜单 Bento 一致

## 3. per-page 按钮矩阵（最终）

| 按钮 | 类型 | 首页 | 列表页* | 文章详情 | 书籍详情 | 其他工具页 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 回顶部 | 系统 | ○滚动200px | ○ | ○ | ○ | ○ |
| 回首页 | 导航 | - | ● | ● | ● | ● |
| 目录 | 上下文 | - | - | ●(有标题时) | - | - |
| 全部文章 | 上下文 | - | ● | ● | - | - |
| 评论 | 上下文 | - | - | ● | - | - |
| 回书架 | 上下文 | - | - | - | ● | - |
| 工具：标签/分类/公告/音乐/笔记/主题 | 工具 | ●(收起) | ● | ● | ● | ● |

*列表页 = /posts/, /archive/, /categories/, /tags, /books/, /moments/ 等

`○` = 条件显示，`●` = 属于该页但收在展开内，`-` = 不显示。工具组 6 个始终在展开内，不按页面隐藏。

## 4. 交互

*   默认收起，只露一个主按钮（三个点 / 展开）。点一次向上展开整列，点外部/点主按钮/ESC 收起。
*   展开后从上到下：上下文段（按上表动态）— 分割线 — 工具段 — 分割线 — 系统段（主题/回首页/回顶部）。上下文段无匹配项时整段隐藏，不留空。
*   移动端不再有顶部 `MobilePostToolbar`，其“全部文章/目录”抽屉改为由统一 Dock 的同名按钮触发（复用现有 `dock-drawer-*` 抽屉）。
*   滚动显隐：仅 `回顶部` 受滚动控制，其余不受滚动影响。

## 5. 视觉

*   胶囊：`var(--float-panel-bg) 92%` + `backdrop-blur 20px`，`rounded-full`，`shadow 0 2px 8px`，与导航栏同材质
*   按钮：`48×48` 圆角 14px，`active: scale(0.96)`，图标 24px，暗色自动适配
*   分割线：`1px solid var(--line-divider)` 50% 透明度
*   动效：`max-height 0.35s cubic-bezier(0.22,1,0.36,1)` + `opacity`，`prefers-reduced-motion` 降为淡入

## 6. 实现拆分

1.  新建 `UnifiedDock.astro`（复用 `FloatingDock` 的抽屉和逻辑，合并 `MobileDock` 浮动组的按钮）
2.  删除 `MobilePostToolbar.astro` 的引用（保留文件但不再在布局中引入）
3.  在 `MainGridLayout.astro` 中用 `UnifiedDock` 替换 `FloatingDock` + `MobileDock` 的浮动组部分，保留 `MobileDock` 的底部5键岛和菜单 Bento
4.  抽屉复用现有 `dock-drawer-*`，无需新建

## 7. 验收

*   桌面和手机右下角是同一个组件，展开内容一致（仅按页面上下文增减）
*   首页不出现“全部文章/目录”，文章详情三件套齐全，书籍详情出现“回书架”
*   滚动到顶时“回顶部”隐藏，其余不受影响
*   旧的顶部 `全部文章|目录` 条消失
