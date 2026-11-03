---
version: "v6.10.0"
date: 2026-11-03
time: "23:45"
type: feature
description: 站长登录后可在站内直接改说说，不用再回本地开编辑器
---

## 为什么做

说说一直只能在本机写：打开 VS Code、进 `src/content/动态/年/月/`、手写 frontmatter、commit、push。想随手记一句的时候，这套流程太重了，最后就变成「攒着不发」。

所以加了站长登录：登录之后导航栏变成头像，每条说说右下滑出编辑和删除，顶部菜单能直接新建。手机上也能用。

## 怎么用

1. 点导航栏右侧的「登录」，填一个 GitHub 细粒度令牌
2. 令牌只授权 `flowersoul999/afterglow` 这一个仓库，权限给 `Contents: Read and write` 就够
3. 登录后每条说说 hover 出两个小圆钮：铅笔改、垃圾桶删

令牌存在 `sessionStorage`，关掉标签页就失效，下次还得重新填 —— 这是故意的，明文令牌留在 `localStorage` 里风险太大。

## 一个必须知道的限制

**提交不等于上线。** 站点是纯静态的，内容改动要 push 到 `main`、EdgeOne Pages 重新构建，1~3 分钟后才可见。所以提示语写的是「已提交，正在重新构建」，不是「已发布」。想立刻看到效果只能在本地 `pnpm dev`。

## 实现取舍

**没有服务端。** Astro 是纯静态输出，没有 adapter，加不了接口。做「密码登录」只能在前端校验密码哈希，等于没有密码 —— 任何人都能读源码绕过。所以干脆不做假密码：直接用能真正决定写权限的 GitHub 令牌，并在弹窗里把「令牌能改整个仓库，别乱贴」写清楚。

**没走 `.svelte.ts` + runes。** 项目的类型检查是裸 `tsc --isolatedDeclarations`，它不认识 `$state` 这类编译期宏，写 `.svelte.ts` 会直接卡在 `Cannot find name '$state'`。所以两个全局 store 用 Svelte 官方 store 契约（一个 `subscribe` 方法）实现，组件里照样写 `$editor.isEditor`。

**新建撞车自动让路。** 说说的路径规则是 `年/月/年-月-日.md`，同一天第二条要加 `-2`。新建时 GitHub 返回 422（文件已存在但没给 sha）就自动试 `-2`、`-3`，不用人工判断。

**删除有二次确认。** 卡片上点垃圾桶不会直接删，而是打开抽屉、底部按钮变成「确认删除？」，再点一次才提交。误触的代价太小，而删错一次要重建整篇。

## 文件

- `src/utils/editor/github-client.ts` — Contents API 的读 / 写 / 删，含路径编码
- `src/utils/editor/editor-store.ts` — 登录态与提示
- `src/utils/editor/editor-ui.ts` — 弹窗与抽屉的开合状态
- `src/utils/editor/moment-serializer.ts` — 说说 md 的解析与序列化（未知 frontmatter 字段原样保留）
- `src/components/editor/` — 导航入口、登录弹窗、抽屉、常驻外壳
- `src/styles/components/editor.css` — 全部样式，只由 `EditorRoot.svelte` 引入一次

## 还没做

文章（`src/content/文章/` 目前是空的，没有可编辑的对象）、面经（108 篇，最该有批量能力，但那是另一个量级的事）、图片上传（得先决定图床，现在只能贴已有的 URL）。
