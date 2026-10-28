---
version: "v1.64.4"
date: 2026-10-20
time: "23:35"
type: fix
description: 修复图谱页导航栏被左移半个屏幕的问题
---

## 图谱页导航栏错位修复

进入 `/categories/` 后导航条只剩「动态 / 记录 / 关于」露在左上角，搜索框跑到屏幕中间——整条导航被左移了半个视口。

**根因**：`styles/pages/categories.css` 照抄了参考站的「fixed + left:50% + translateX(-50%)」置顶居中手法，但两站的 `#top-row` 结构不同——

- 参考站的 `position: sticky` 写在 class 里，规则可以覆盖成 fixed，left 与 translate 恰好抵消，视觉不动
- 本站的 `position: sticky; top: 0` 写在**行内 style** 里，行内样式优先级高于任何规则：`fixed` 被拦下没生效，`left: 50%` 和 `translateX(-50%)` 却照常生效 → sticky 容器被平移 -720px（半个 1440 视口），导航整体跑出左屏

**修复**：删掉 `html:has(.graph-page) #top-row` 整条规则。本站图谱页不滚动（overflow hidden），sticky 导航原位就是顶部，`z-50` 也已压过画布的 `z-10`，无需任何额外规则；原位置留了注释说明差异，防止将来照参考站抄回来。

实测：图谱页 topRow 回到 x=0 / y=0、无 transform，导航完整显示；首页不受影响。
