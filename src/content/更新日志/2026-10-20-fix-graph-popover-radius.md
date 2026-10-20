---
version: "v1.64.5"
date: 2026-10-20
time: "23:34"
type: fix
description: 图谱页弹窗圆角修复（--radius-large 在本站是 0 导致直角）
---

## 图谱弹窗直角修复

筛选弹窗（dock 的「筛选」气泡）与节点详情面板显示为直角。原因是两处样式照抄参考站的
`border-radius: var(--radius-large, 0.75rem)`，而本站 token 把 `--radius-large` 定为 **0**
（tokens/breakpoints.css，全站大面板直角的设计语言），fallback 永远不生效。

- `graph-dock.css` `.kg-dock__popover` → 写死 `border-radius: 0.75rem`
- `graph-detail-panel.css` `.graph-detail` → 同上

黑色描边、箭头方块与阴影不受影响，仍与导航栏下拉同一套语言。
