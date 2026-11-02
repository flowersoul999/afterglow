---
version: "v6.8.0"
date: 2026-10-29
time: "22:15"
type: feature
description: 从 jojo! 站整站迁入七张技能图（修行路四张 + 修行录三张），导航新增独立「技能」入口
---

## 七张技能图整体迁入

把 jojo! 站的整套技能图搬到主站，一共七页：

**修行路**（有境界门禁、算修为、发飞剑传书）

- `/cs/` 计算机基础 —— 数学打底，往上长语言、数据结构与算法、组成原理、操作系统、网络、数据库
- `/skills/` 前端技能图 —— 从零到技术专家，78 个方块 / 9 层
- `/backend/` 后端技能图 —— 站在前端基础上往全栈转，起点方块默认点亮
- `/agent/` Agent 开发 —— 从模型与 Token 到底到流式、鉴权、成本、上线

**修行录**（无门禁、不计修为、不发故事，只给属性点）

- `/music/` 音乐、`/english/` 英语、`/finance/` 理财

## 页面形态

每页都是同一套：顶部属性面板（修为条或三/四维属性）+ 技能图切换条 + 按前置依赖自动分层的技能图。方块上是真实技术 logo（内联 SVG path，不依赖图标集），连线代表「先会了上面才能解锁下面」，亮度按清单完成比例四重表达（水位高度 / logo 饱和度 / 描边亮度 / 勾满外发光）。

## 导航

顶层最终定为 **导航 / 文章 / 动态 / 开心 / 关于** 五项：

- 七张技能图并入「开心」下拉（书架、影视、足迹、更新日志之后），不再单独占一个「技能」入口。
- 原来的「记录」改名 **开心**，图标换成 `auto-awesome`。
- 「主页」项去掉 —— 左侧站点 Logo 本身就是回首页的链接。
- 移动端抽屉（`MobileMenuSheet.astro`，硬编码，和桌面导航分开维护）同步合并。

## 技术要点

- **布局适配**：jojo! 的 `MainGridLayout` 支持 `hideSidebars` / `fullWidth`，主站的没有（走 `NO_SIDEBAR_PAGE_TYPES` 白名单 + `data-no-sidebar`）。七个路由因此归入新的页面类型 `skills`，在 `src/utils/page-type.ts` 里用集合精确匹配，宽度与 `overflow: clip` 规则写在 `no-sidebar-pages.css`。
- **数据层**：`src/data/` 下 25 个文件（七套 Skills / Icons / Checks + `cultivation.ts` 修为体系 + `cultivationStories.ts` 故事 + `saga/` 四卷话本），另加 `src/lib/sfx.ts`（WebAudio 程序化合成，不塞音频文件）。
- **进度存 localStorage**：键名沿用 `aemeath-*` 前缀（与原站同源），换域名等于重新开始打坐。
- **两版差异已抹平**：主站 6.6.13 / 原站 6.13.5，Svelte 5.50 与 5.56 都能编，`$derived.by` 等 runes 语法没有版本门槛；`@/*` 别名两边一致，导入路径未做改动。
