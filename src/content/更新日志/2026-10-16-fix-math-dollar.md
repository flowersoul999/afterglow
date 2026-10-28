---
version: "v1.61.1"
date: 2026-10-16
time: "19:20"
type: fix
description: 修掉 7 篇 JavaWeb 笔记里被误当数学公式渲染的模板字符串示例
---

## 模板字符串示例不再被渲染成数学公式

`01-JavaWeb课程导学` 起的学习笔记里，「三级 · 骨架」等提示行用 `` \` `` 转义书写 JavaScript 模板字符串，
例如 `` \`${name}的总分是${____}\` ``。`${` 与下一个 `$` 之间夹着中文，会被 markdown 的数学公式解析器
配对成行内公式，导致：

- 构建日志刷 `LaTeX-incompatible input ... Unicode text character "的" used in math mode` 告警
- **页面上那段文字实际被 KaTeX 当公式渲染**，斜体/间距错乱，不是原文该有的样子

修法：只把**正文里**（不在代码块、不在行内代码中）的 `${` 转义为 `\${`，共 7 个文件 13 行。渲染结果不变。

顺带修 `ArchiveHeatmap.astro`：`<style is:global>` 块里误用了 Svelte 语法的 `:global(.dark)`，
lightningcss 压缩时告警「'global' is not a recognized pseudo-class」，改为项目统一的 `:root.dark`。

> 排查要点（写给以后）：markdown 的代码段内**反斜杠不转义反引号**，所以 `` \` `` 里的反引号仍是有效的
> 代码段分隔符 —— 判断某段 `$...$` 会不会被当数学解析，必须先按这个规则切出代码段再配对 `$`。
