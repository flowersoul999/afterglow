---
version: "v6.32.2"
date: 2026-11-26
time: "14:26"
type: improvement
description: 更新日志的「功能新增」「功能优化」也有了各自的文字颜色，四类日志一眼分清
---

## 改了什么

更新日志卡片左上角那行类型文字，以前只有「问题修复」是红色的，其余三类全是默认灰 —— 现在四类各有一个颜色：

| 类型 | 颜色 | 效果 |
| --- | --- | --- |
| 功能新增 `feature` | 绿 `#1d9e75` | 新功能一目了然 |
| 功能优化 `improvement` | 蓝 `#2f7fd4` | 与「新增」区分开 |
| 问题修复 `fix` | 红 `#e24b4a` | 保持不变 |
| 功能删除 `removal` | 灰蓝 `#64748b` | 退到背景里 |

左侧那颗小圆点跟着同色，点开卡片的详情弹窗里类型文字也是同一套颜色，两处观感一致。

## 为什么之前只有红色

不是漏写，是**选择器写错了值**。样式里用的是 `data-type="feat" / "style" / "refactor" / "chore"`，而 `content.config.ts` 的 changelog 枚举实际是 `feature / improvement / fix / removal`（`src/content.config.ts:273`）——两边只有 `fix` 撞上了，于是只有红色生效，另外三条规则一辈子匹配不到。这次把四个选择器改成真实枚举值，顺带删掉用不上的 `style` / `refactor` / `chore` 三条。

## 暗色主题

四种颜色在深底上会发闷，暗色下统一提亮一档（绿 `#34d399` / 蓝 `#60a5fa` / 红 `#f87171` / 灰 `#94a3b8`），0.75rem 的小字号也看得清。

## 涉及文件

- `src/styles/components/about-changelog.css:229` —— 卡片类型色（含暗色覆盖）
- `src/styles/components/about-changelog.css:399` —— 详情弹窗类型色，改为复用 `--changelog-type-color` 变量
