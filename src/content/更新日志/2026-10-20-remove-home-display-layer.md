---
version: "v1.64.4"
date: 2026-10-20
time: "23:00"
type: removal
description: 首页删掉全屏滚动展示层（柱子+百叶窗动画），保留首屏 Hero、跑马灯与地图指南数据层
---

## 首页去掉「作品展示」全屏滚动动画

按站长要求，首页删掉最后那一整段全屏滚动演出（`HomeDisplayLayer`）：竖线从底部延展 → 柱子水平展开 → 5 张百叶窗长条图依次滑入 → 中间插入段（背景渐黑 + 长条反向滑入 + 人物前景）→ 结尾三层大图/视频合成，总滚动距离 7000px 的 GSAP + ScrollTrigger pin 动画。

**保留的三块**：首屏 Hero、公告跑马灯、**「地图指南」数据层**（站点访问/文章档案两张数据卡 + 7 张入口九宫格 + 置顶文章轮播 + 访问统计）。页脚由 `MainGridLayout` 提供，不受影响。

**删除清单**：

- 组件：`HomeDisplayLayer.astro`；以及 `HomePortfolioShutterLayer.astro`——它是前者的前身，早就没有被任何页面 import，却仍依赖下面这批 shutter 工具与样式，留着会变成唯一还在引用已删文件的孤立组件
- 样式：`home-display-layer.css`、`home-portfolio-shutter.css`
- 工具：`home-display-layer.js`、`home-portfolio-shutter.js`
- 配置：`homeConfig` 里的 `displayLayer` / `portfolioShutter` 两段，以及 `types/config.ts` 里的 `HomeDisplayLayerConfig`、`HomePortfolioShutter*` 共五个类型

**没删的东西**：`home-data-layer.js` 里的 `countReadableCharacters` / `formatCompactNumber` 仍被文章页目录面板 `ArticleTocPanel` 使用（同时摘掉了无人调用的 `normalizeSkillItems` 与技能图标映射表）；首页素材图 `src/assets/images/home/portrait/*` 也留在磁盘上，将来想恢复组件可直接搬回配置。

> 更正：本次操作一度连「地图指南」数据层一起删掉了，站长确认后已整体还原（含当天早些时候给这块做的两项改动：去掉整块入场动画、修复置顶文章卡描述第二行被切），所以现在首页是 Hero + 跑马灯 + 地图指南三段。
