---
version: "v1.63.1"
date: 2026-10-20
time: "22:05"
type: fix
description: 修复导航栏搜索按钮溢出到屏幕外（右段改按 right 贴边定位）
---

## 导航栏搜索按钮跑到页面外

顶部导航栏右段的「Ctrl K + 搜索」胶囊贴不住右边，右侧圆角被切掉、白色底色一直顶到滚动条里，看起来像跑到了页面外面。滚动一下或缩放窗口后又恢复正常。

### 原因

右段是 `position: absolute`，位置由 `Navbar.astro` 里的内联脚本按 `left = 容器宽度 - 右段宽度` 算成 px 写死的。这套坐标只在「滚过 80px」和 `window.resize` 两个时机重算。

但加载过程中容器宽度自己会变：页面内容（图片、banner、字体）撑高之后竖向滚动条才出现，可视宽度随之少掉十几像素 —— 这个过程不触发 `window.resize`，于是右段停在按「旧宽度」算出的 left 上，右边缘正好被推出屏幕被裁掉。

### 修复

- **右段改用 `right` 贴边**：展开态直接写死 `right: 0`，不再按 px 换算，容器宽度怎么变都贴住右边缘，算错也只会往左偏、不会溢出（收缩态贴中间椭圆时才用 JS 按 px 算）
- CSS `.navbar-seg` 的过渡补上 `right`，滚动收缩/展开的滑动动画保持原样
- 补一个 `ResizeObserver` 盯 `.navbar-segments` / `#navbar` / `#navbar-wrapper` 的宽度变化，加上 `load`、`astro:page-load` 两个时机重排 —— 覆盖滚动条出现、Swup 换页后内容变高这类 `window.resize` 抓不到的情况
- 左右段位置都夹在容器范围内，防止将来再出现意料外的溢出

### 顺便：两个胶囊离窗口边缘的留白

站长要求左右两个胶囊像参考站那样离页面边缘有点距离（原来左边贴死 0、右边顶到滚动条）。容器 `.navbar-segments` 的宽度改为 `calc(100% - 1.5rem * 2)`，两个胶囊随之内缩 24px；移动端留白减半（0.75rem）。

> 注意：绝对定位的子元素不受父级 `padding` 影响（containing block 是 padding box），靠给容器加 padding 是缩不进去的，必须缩容器本身。
