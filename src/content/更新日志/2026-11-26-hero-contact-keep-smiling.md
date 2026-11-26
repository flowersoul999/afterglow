---
version: "v6.33.3"
date: 2026-11-26
time: "15:07"
type: improvement
description: 首屏右下角水印的 slogan 改成「keep smiling」
---

## 改了什么

上一版把首屏右下角的熔融字水印从「B站：jojo」换成了「keep reading」，站长看完决定要更松快一点的调子，于是大字行从 `reading` 改成 `smiling`，小字行 `keep` 不动。

- 只动 `homeConfig.hero.contact.handle` 一个值，样式与入场动画全部沿用
- `smiling` 与 `reading` 同为 7 个拉丁字母，宽度与换行表现和上一版完全一致

## 关键文件

- `src/config/homeConfig.ts` —— `hero.contact.handle: "smiling"`

## 想改的话

改这两行字只动 `homeConfig.hero.contact`：`platform` 是小字行、`handle` 是大字行。大字行是 6.6vw 粗体，超过 7 个拉丁字母在窄屏会顶到左边，想换长句先在 375px 宽度下看一眼。
