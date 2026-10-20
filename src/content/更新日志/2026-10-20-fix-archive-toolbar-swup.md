---
version: "v1.64.1"
date: 2026-10-20
time: "22:45"
type: fix
description: 修复归档页换页回来后工具栏（面包屑/筛选/全部收起）整块消失
---

## 归档页换页回来工具栏消失

从归档页进别的页面再回来，标题和统计还在，但**面包屑 + 时间/分类/标签胶囊 + 全部收起整块空了**（树本身还在，只是少了工具条）；刷新页面又恢复正常。

### 原因

工具栏默认 `visibility: hidden`，要等脚本给面板打上 `data-enhanced` 才显示——这是为了防止没 JS 时露出生硬的退化控件。

而脚本的重挂载挂在 `swup:content:replaced` 上，写的是 `document.addEventListener`。这个事件是 `window.dispatchEvent(new CustomEvent("swup:content:replaced"))` 派发的，**派发目标是 window，传播路径里根本不经过 document**，所以那个回调从来没执行过：

- 完整刷新 → 脚本首次执行时直接 mount，正常
- Swup 换页回来 → 没有重新 mount，`data-enhanced` 缺失，工具栏一直是隐藏的

### 修复

- `src/utils/archive-panel-controller.ts`：监听目标改成 `window.addEventListener("swup:content:replaced", mount)`，并加注释说明为什么不能写 `document`
- `CLAUDE.md` §11.4 的示例代码同步改成 `window`，并记下这个坑：**不报错、无告警，表现只是「换页回来功能失效」**
- 仓库里还有若干组件（Bookshelf、bangumi/FilterControls、TabNav、ChangelogGraph、PostDirectoryList 等）用的是同样的 `document` 写法，暂未改动，后续若发现这些页面「换页回来失效」按同样方式修

实测（playwright）：归档 → 动态 → 点导航回来，工具栏可见、年份分组可展开收起、视图可切到「分类」并正确计数。
