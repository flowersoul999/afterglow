---
version: "v6.27.1"
date: 2026-11-25
time: "16:05"
type: improvement
description: 网站导航页铺上第一批内容，11 个分类 65 个站点
---

## 之前为什么是空的

`/projects/` 页面本身没问题 —— `src/pages/projects.astro` 会 `getCollection("daohang")`，而 `src/content/导航/` 里只有一个 `.gitkeep`，集合是空的，于是走到「暂无收录的网站」那个空态。

## 这次补了什么

按目录即分类的约定（分类由**文件夹名**决定，不再写 frontmatter 的 `category`），新建 11 个分类目录共 65 条：

| 分类 | 条目数 | 侧重 |
| --- | --- | --- |
| 我的网站 | 2 | 本站与博客源码仓库 |
| 常用网站 | 7 | GitHub / B 站 / 知乎 / 掘金 / CSDN / Stack Overflow / 少数派 |
| 工具网站 | 6 | TinyPNG、Squoosh、Excalidraw、IT-Tools、Can I Use、Carbon |
| 开发者工具 | 6 | VS Code、Postman、Docker Hub、npm、pnpm、regex101 |
| 开发者服务平台 | 5 | Vercel、Cloudflare、Netlify、Supabase、GitHub Pages |
| AI 工具 | 11 | ChatGPT、Claude、DeepSeek、Kimi、Gemini、通义千问、智谱清言、豆包、Perplexity、Cursor、Hugging Face |
| 文档 | 8 | MDN、Astro、Vue、Tailwind、Vite、TypeScript、Svelte、Node.js |
| 学习网站 | 7 | LeetCode、代码随想录、阮一峰 ES6、现代 JS 教程、菜鸟教程、小林 coding、freeCodeCamp |
| 设计资源 | 7 | Iconify、Google Fonts、Font Awesome、unDraw、Coolors、中国色、Dribbble |
| 资源网站 | 3 | jsDelivr、GitHub Trending、Greasy Fork |
| API | 3 | 高德开放平台、和风天气、GitHub REST API |

每条只写 schema 允许的四个字段（`name` / `url` / `icon` / `description`）+ 可选的 `tags`。分类内的排序由 `projects.astro` 按 `name` 拼音自动处理，不用手写 `order`。

## 两处容易踩的坑

- **分类目录名必须和 `src/pages/projects.astro` 的 `CATEGORY_META` 对上**，否则会带着默认地球图标掉到列表末尾。这次新建的 11 个都在表里，`order` 分别为 0/1/2/3/4/5/6/7/8/10/11。
- **`icon` 不要写本地路径**（踩到了，`pnpm build` 直接挂）。`projects.astro:621` 的本意是「以 `http` 或 `/` 开头的当图片」，但实测把 `icon: /favicon/favicon-light-192.png` 这种值喂进去，构建会抛 `Unable to load the "local" icon set!` —— 它没走 `<img>` 分支，而是被 `<Icon>` 当成图标名解析，而 `/favicon/...` 不含冒号，被归到 `local` 图标集（`src/icons/` 不存在）就炸了。同一份数据换成 `https://jojocode.cn/favicon/favicon-light-192.png` 立刻通过。
- **其余图标走 Iconify 名**。可用的前缀在 `astro.config.mjs:87` 的 `icon({ include })` 里限定为 material-symbols / fa7-brands / fa7-regular / fa7-solid / simple-icons / mdi，写别的前缀会渲染成空白。这批全部校验过：`simple-icons` 里没有的品牌（智谱、豆包、Node 以外的少数几个）退回 `material-symbols`。

## 后面怎么加

往对应分类目录丢一个 `.md` 就行，例如 `src/content/导航/AI 工具/xxx.md`；分类不存在就新建文件夹，但记得同步登记 `CATEGORY_META`。标签（`tags`）不填不会报错，只是分类标题行不出现那排子标签。
