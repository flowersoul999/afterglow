---
version: "v6.11.0"
date: 2026-11-04
time: "14:10"
type: feature
description: 站长登录换成 GitHub 授权登录，不再手填令牌，入口挪进左上角的资料卡
---

## 为什么换

上一版是「粘贴一个 GitHub 细粒度令牌」登录。能跑，但每次换设备、令牌过期、清过浏览器缓存，都得回 GitHub 重新生成一串 `github_pat_...` 再贴回去。自己用着都嫌烦，而且那串东西明文存在 `sessionStorage` 里，看着就不踏实。

这次改成点一下就走：点「登录」→ 跳到 GitHub → 点 Authorize → 回站，已经是登录态。

登录入口也从导航栏右侧挪进了左上角的资料卡：鼠标移到 `JOJOSTAR` 上，卡片里就是那个「登录」小胶囊。导航栏右段本来就要在滚动时收缩成球，塞一个常驻按钮进去只会碍事。

## 为什么突然需要服务端了

GitHub 的 OAuth 有两个绕不过去的事实：

1. 换 access token 那一步需要 `client_secret`，这东西不能放在前端 —— 浏览器里的一切都是公开的。
2. GitHub 的 token 端点不支持跨域，浏览器里根本发不出去这个请求。

所以「纯静态站也能 GitHub 登录」是不成立的。好在 EdgeOne Pages 支持 **边缘函数**：仓库根目录建一个 `edge-functions/`，按目录结构自动生成路由，`context.env` 读控制台里的环境变量。于是：

- `/api/auth/login` 生成 state，跳去 GitHub 授权页
- `/api/auth/callback` 用 `client_secret` 换 token，**顺带问一句 GitHub「这人是谁」**，不是 `flowersoul999` 就直接打回
- token 用 AES-GCM 封起来塞进 **HttpOnly Cookie**，页面上的脚本永远读不到
- `/api/auth/me` 只往回吐「我是谁」，不吐 token
- `/api/github/file` 代理读写删，强制只能碰 `src/content/`

前端从「拿着一把能改整个仓库的钥匙」变成「拿着一个自己打不开的凭证」，这是这一版最实质的变化。

## 怎么用

1. 鼠标移到左上角 `JOJOSTAR`，卡片里点「登录」
2. 弹窗里点「使用 GitHub 登录」，在 GitHub 上点 Authorize
3. 回来后每条说说 hover 出编辑 / 删除，卡片里换成「说说 / 退出」两个小按钮

登录态保持 30 天，Cookie 过期或手动退出即可。

## 几个刻意的选择

**只申请 `public_repo`。** 不申请 `repo` —— 那会顺带拿到这个账号所有私有仓库的读写权，为了改一个博客不值当。

**「是不是站长」在服务端判定。** 前端不做任何身份判断，`login === "flowersoul999"` 这一句写在边缘函数里。别人授权进来也只会拿到一句「这个 GitHub 账号不是站长」。

**state 不是摆设。** 它和「登录完回哪一页」一起封进一个 10 分钟有效的 Cookie，回调时两边比对。挡的是有人拿自己的 code 构造链接、把你登录成他的账号。

**失败也说话。** 取消授权、state 过期、secret 没配、账号不对，每种情况都回跳带一个 `reason`，前端翻成中文提示。比「点了没反应」好排查得多。

## 需要站长手动做一次

代码这边已经齐了，但 GitHub 上那个 OAuth App 只能人去点（我没法代劳）：

1. <https://github.com/settings/developers> → New OAuth App
2. Callback URL 填 `https://jojocode.cn/api/auth/callback`，**必须一字不差**
3. 记下 Client ID，生成 Client Secret
4. EdgeOne 控制台加环境变量 `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`，重新部署

**绝对不要**给这两个变量加 `PUBLIC_` 前缀 —— 带 `PUBLIC_` 的会被打进客户端产物，等于把 secret 公开。完整步骤和排障表在 `docs/deploy-edgeone-pages.md` 第二节之 5。

## 文件

- `edge-functions/_lib/auth.js` — 新增。Cookie、AES-GCM 信封加密、JSON 响应、路径编码
- `edge-functions/api/auth/[action].js` — 新增。login / callback / me / logout
- `edge-functions/api/github/[action].js` — 新增。Contents API 代理，只放行 `src/content/`
- `src/utils/editor/github-client.ts` — 重写。不再持有 token，全部走 `/api`；新增跳转前的服务探测
- `src/utils/editor/editor-store.ts` — 重写。去掉 token 存储，改成 Cookie 会话探测 + OAuth 回跳原因翻译
- `src/components/editor/EditorLoginModal.svelte` — 重写。删掉令牌输入框，只剩一个 GitHub 按钮
- `src/components/editor/EditorNavButton.svelte` — 改成资料卡内的紧凑胶囊
- `src/components/layout/NavbarProfileCard.astro` — 挂载点
- `src/components/layout/Navbar.astro` — 移除右侧入口
- `src/styles/components/editor.css` — 换成胶囊样式，清掉头像下拉菜单那套

## 还欠着的

本地 `pnpm dev` 不跑边缘函数，所以**本地登不上**（会明确提示「登录服务未部署」，不是静默失败）。想在本地调登录逻辑，得用 `edgeone` CLI 起函数调试环境。

文章和面经的站内编辑仍然没做 —— 跟上一版一样，文章集合是空的，面经 108 篇是另一个量级的事。
