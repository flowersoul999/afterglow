---
version: "v1.64.3"
date: 2026-10-20
time: "22:40"
type: fix
description: 修复首页置顶文章卡描述文字第二行被拦腰切断（文字下半截被挡住）
---

## 置顶文章卡的描述文字不再被切

站长发现本地首页「置顶文章」卡的简介第二行下半截看不见，线上却是好的。

**不是线上线下代码差异**——用 Playwright 在 1080/1280/1440/1600/1920 五个宽度分别量过本地与线上，`cardW`、`containerH`、`spanH`、字体（LXGW WenKai 13.44px）全部逐像素一致。真正的变量是**窗口宽度**：

- 卡片行高 `--guide-row-height: clamp(12rem, 14vw, 14rem)`，`<1600px` 时取 12rem=192px，卡片内轮播区只剩 96px；
- 而「meta 17px + 标题行 44px（含 44px 触控按钮）+ 两行描述 37.6px + 两个 6.4px 间距」需要约 112px，**超出 16px**；
- 轮播页是绝对定位的定高 column flex，超出部分被默认 `flex-shrink: 1` 从描述文字上扣掉，把两行压成 22px，`-webkit-line-clamp: 2` 与 `overflow: hidden` 只负责裁，于是第二行被水平切开（不是省略号，是腰斩）。

**修复两处**（`src/styles/components/home-data-layer.css`）：

1. `.guide-rotator__slide > span:last-child` 加 `flex-shrink: 0` —— 描述固定占两行高度，超出交给 `-webkit-line-clamp` 打省略号，任何情况下都不会再把整行压扁。
2. `--guide-row-height` 下限 `12rem → 13.75rem` —— 补上缺的那 16px，`1024~1600` 全区间都不再溢出（≥1600 仍是 `14vw → 14rem` 的成长上限，最高 224px 不变）。

**验证**：390 / 768 / 900 / 1080 / 1440 / 1600 六个宽度实测 `spanH === lineHeight × 2` 且溢出 ≤ 0.3px（亚像素，肉眼不可见），三档截图确认两行完整、末尾正常出现省略号；整块九宫格的网格比例与移动端布局不受影响（≤768px 走的是 `min-height` 那套，不读这个变量）。
