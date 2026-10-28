---
version: "v1.64.2"
date: 2026-10-20
time: "22:20"
type: improvement
description: 首页「站点数据 / 地图指南」区块去掉入场动画，卡片直接静态呈现
---

## 去掉首页数据区块的入场动画

站长要求这一整块「直接摆上去就行」，不要每次进首页都播一遍聚拢再散开的动画。

- 移除 `HomeDataLayer.astro` 里的 `initGuideOpening`（GSAP 时间线）：原来的效果是大标题「地图指南」从左用 `clip-path` 擦出，7 张卡片先被 `gsap.set` 成透明并从舞台中心向外散开（最多 280px，带 ±7° 旋转、scale 0.56），再回收到中心叠成一摞，最后散回真实网格位置。现在完全不播，首屏就是最终布局。
- 顺带删掉只为它服务的代码：`getGuideOpeningBlocks`、`GuideOpeningBlock` 接口、`guideOpeningToken` 竞态令牌、`prefersReducedMotion` / `isDesktopGuideOpening` 两个判定、`waitForPageLoaderHidden` 导入，以及 CSS 里 `[data-guide-opening="playing"]` 的 `will-change` 规则。
- **保留**的交互不变：卡片悬停的「访问轨迹 / 内容索引」浮层动画（`initMetricCards`）、置顶/最新文章的轮播（`initGuideRotators`）、订阅卡展开（`initGuideContact`）、访问量数据拉取（`initVisitStats`）。
- 内容静态呈现后，即使 JS 未执行或 `prefers-reduced-motion` 也不会出现空白——CSS 本来就没有把卡片初始设为隐藏，隐藏态一直只由 JS 临时设置。
