---
version: "v6.32.2"
date: 2026-11-26
time: "14:26"
type: improvement
description: 首屏右下角的熔融字水印从「B站：jojo」换成一句站内 slogan「keep reading」
---

## 改了什么

首屏右下角那块手绘熔融字一直是「B站：jojo」—— 但它既没带链接（点不动），平台名和内容页的链接列表也对不上号，看着更像一张没写完的名片。现在换成两行 slogan：小字 `keep`、大字 `reading`，气质和本站「坐下来慢慢读」的调子一致。

- 组件不再硬拼中文冒号：`HeroContact.astro` 原来把 `{platform}：` 写死在标记里，现在两行都是配置里的自由文本，标点要在配置里自己写
- 文案改在 `homeConfig.hero.contact`，字段名（`platform` / `handle`）保持不动以免牵动类型与其他调用点，已在类型定义里补注释说明它现在只是「小字行 / 大字行」
- 需要挂链接时照旧填 `href`，整块会渲染成 `<a>`

## 关键文件

- `src/components/layout/HeroContact.astro` —— 去掉硬编码冒号，两行文本各自独立渲染
- `src/config/homeConfig.ts` —— `hero.contact` 改为 `{ platform: "keep", handle: "reading" }`
- `src/types/config.ts` —— `HeroContactConfig` 补注释，说清字段实际含义

## 想改的话

改这两行字只动 `homeConfig.hero.contact`：`platform` 是小字行、`handle` 是大字行。大字行是 6.6vw 的粗体，超过 7 个拉丁字母在窄屏会顶到左边，想换长句就先在 375px 宽度下看一眼。
