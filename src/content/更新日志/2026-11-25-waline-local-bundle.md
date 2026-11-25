---
version: "v6.27.4"
date: 2026-11-25
time: "15:52"
type: fix
description: Waline 改用本地打包依赖，评论区与首页浏览量统计不再是空白
---

## 评论和访问数终于能出来了

以前页面里写的是 `import ... from 'https://unpkg.com/@waline/client@v3/dist/waline.js'`，
国内直连基本连不上，于是评论区一直空着，首页那排浏览量也一直是 0 或干脆不显示 ——
和 v6.21.2 修过的 Umami 读数不是同一个问题，那个是接口前缀，这个是脚本根本没下载下来。

`@waline/client` 本来就在 `package.json` 里，只是没用上。这次全部改成本地依赖：

- **评论区** `components/comment/Waline.astro`：`import "@waline/client/style"` + `init` 来自 `@waline/client/full`，
  配置从 `data-waline-config` 属性读，不再靠 `define:vars` 注入
- **说说页懒加载** `layouts/Layout.astro`：新增 `window.__loadWaline()`，脚本和样式同批按需加载；
  删掉了往 `<head>` 里插 unpkg `<link>` 的旧逻辑，本地模块没就绪时明确打日志
- **浏览量统计** `layouts/MainGridLayout.astro`：`pageviewCount` 改成本地按需 import，
  `serverURL` 由隐藏的 `<span data-server-url>` 带过去

加载时机没变：还是等用户真的点开评论区才下载，只是下载源从境外 CDN 换成了自己打包的产物。
Spine / Artalk / MiSans 那几个仍走 CDN，但换到了 jsdelivr，见 v6.27.3。
