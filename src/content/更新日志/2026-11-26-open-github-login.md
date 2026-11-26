---
version: "v6.33.0"
date: 2026-11-26
time: "14:45"
type: feature
description: 登录对所有人开放，用 GitHub 登录后留言自动带身份；站长仍自动识别
---

## 谁都能用 GitHub 登录了

以前登录是站长专属：非站长在 GitHub 那边点完授权，回来也会被服务端直接拒掉。现在改成**登录对所有人开放**，区别只在登录之后能看到什么。

- **普通访客**：用 GitHub 登录后，唯一的收益是留言板不用再手填昵称 —— 昵称和主页会自动带上你的 GitHub 身份，头像也会显示在留言框左边。页面里**不会**出现任何编辑按钮。
- **站长**：同一个按钮登录，服务端比对 GitHub 账号名后自动识别，桌面灵动岛和手机菜单里照旧出现「内容管理 / 新建说说 / 退出登录」。
- **安全边界**：写仓库的四条接口（`/file`、`/blob`、`/batch`、`/tree`）从「已登录就能用」收紧成「必须是站长」。否则登录一开放，任何访客都能改博客仓库。
- **留言板登录按钮改走站内 GitHub 授权**。原先接的是 Waline 自带的 OAuth，那条链路需要 Waline 服务端配密钥，线上一直返回 403，点了没反应；现在换成站点自己的登录，访客和站长共用一次授权。
- 退出登录会一起清掉：Waline 登录态、自动填进留言资料的昵称和主页、站内 GitHub 登录态。只清一半的话下次留言会顶着别人的名字。

## 一处已知限制

评论区列表里的头像和「站长」徽章来自 Waline 服务端（头像由邮箱推 gravatar，徽章要 Waline 自己的登录态），所以访客留言仍显示字母头像。要让列表里也出现 GitHub 头像，得去 Waline 项目配上 `GITHUB_ID` / `GITHUB_SECRET` / `JWT_TOKEN` 打开它自带的 OAuth，这次没动。

## 改了哪些文件

- `cloudflare-worker/index.js`：`callback` 不再拒非站长，session 与 `/api/auth/me` 增加 `isOwner`；新增 `requireOwner()`，四个写接口全部改用它。
- `src/utils/editor/github-client.ts`、`editor-store.ts`：身份增加 `isOwner`，快照增加 `loggedIn`（登录态）与 `isEditor`（编辑权）分离。
- `src/components/editor/`：`IslandAdminEntry`、`EditorNavButton`、`EditorMobileMenuEntry` 统一三态；`EditorLoginModal` 文案不再写「站长登录」。
- `src/components/features/GuestbookChat.svelte`、`GuestbookChatComposer.svelte`：接入站内登录身份，预填昵称/主页，留言身份胶囊显示 GitHub 头像。
