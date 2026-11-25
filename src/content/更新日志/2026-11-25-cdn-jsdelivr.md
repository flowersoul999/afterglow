---
version: "v6.27.3"
date: 2026-11-25
time: "15:50"
type: fix
description: MiSans 字体、Artalk、Spine 播放器的 CDN 从 unpkg 换到 jsdelivr，修国内直连返回 000
---

## 三个外链资源不再赌 unpkg

`unpkg.com` 在国内经常直接连不上（curl 返回 000），表现是字体悄悄回退成系统字体、评论区空白、
看板娘模型加载不出来 —— 而且都不会报错，只是「看起来不对」。

这次统一换成 `cdn.jsdelivr.net`：

| 资源 | 位置 | 改动 |
|------|------|------|
| MiSans 字体（Normal / Regular / Semibold 三档） | `config/fontConfig.ts` | `unpkg.com/misans@4.1.0/...` → `cdn.jsdelivr.net/npm/misans@4.1.0/...` |
| Artalk 评论 | `components/comment/Artalk.astro` | 样式 `Artalk.css` 与模块 `Artalk.mjs` 都换源 |
| Spine 看板娘播放器 | `components/features/SpineModel.astro` | CSS 与 iife 脚本换源，顺手把 `4.2.*` 通配写成 `4.2` |

Spine 本来就有 CDN 失败自动回退本地文件的逻辑，这次是让第一步就不容易失败。

⚠️ Waline 走的是另一条路 —— 它已经完全改成本地依赖打包，见 v6.27.4，不再走任何 CDN。
