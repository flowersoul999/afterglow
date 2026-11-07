# 让 Waline 在国内正常访问（留言板 / 评论 / 浏览量）

> 症状：`/life/guestbook/` 一直停在骨架屏，文章评论区空白，浏览量不显示。
> 根因：Waline 服务地址是 `https://jojostar-waline.vercel.app`，`*.vercel.app` 在国内被 DNS 污染 + TCP 阻断。

## 一、为什么直连不通（实测数据）

在这台机器（国内家庭宽带，无代理）上验证：

| 测试 | 结果 |
|---|---|
| `nslookup jojostar-waline.vercel.app` | 解析到 `108.160.167.158`、`2a03:2880:f131:83:face:b00c::25de`（Facebook 段，DNS 污染） |
| 强制 `--resolve` 到 Vercel 真实 IP `76.76.21.21` / `76.76.21.98` / `216.198.79.1` | 三个全部 curl exit 56（TCP 被阻断） |
| `curl https://jojocode.cn/` | 200 正常 |

结论：**不是 Waline 服务挂了，是这个域名在你的网络里根本到不了**。

前端已经做了兜底（15 秒超时 + 明确报错），所以现在看到的是「连接留言服务超时，请检查网络后重试」而不是永久骨架屏。但要让留言板真正能用，必须换一个国内可达的入口。

## 二、三条路线对比

| | 方案 A：CF Worker 反代（推荐） | 方案 B：Vercel 自定义域名 + CF 橙云 | 方案 C：迁出 Vercel |
|---|---|---|---|
| 动手量 | 复制一段代码 + 点几下 | 改 DNS 两轮 + 等证书 | 重新部署服务 + 迁数据库连接 |
| 要不要动 Vercel | **不用** | 要加域名 | 要 |
| 证书 / 域名验证坑 | 无 | 有（见第四节） | 无 |
| 可达性 | 走 Cloudflare 边缘，与 `jojocode.cn` 等同 | 同上 | 取决于新平台 |
| 出问题怎么修 | 改 Worker 一行 | 可能陷入证书死循环 | 重新部署 |
| 长期稳定性 | 免费额度 10 万请求/天 | 好 | 好 |

**推荐 A**。原因很简单：你已经在用 Cloudflare 代理 `jojocode.cn`（A 记录是 `104.21.54.171` / `172.67.140.176`，是 CF 的 IP），这条链路在你的网络里是通的——博客能打开就是证据。Worker 只是在这条已通的链路上多接一个子域名，**Vercel 那边一个字都不用改**，也就绕开了方案 B 所有关于证书和域名验证的坑。

## 三、方案 A：Cloudflare Worker 反代（推荐）

### 原理

```
浏览器 ──> waline.jojocode.cn（Cloudflare 边缘，国内可达）
              └─ Worker 转发 ──> jojostar-waline.vercel.app（CF 海外机房回源，不受墙影响）
```

关键点：**回源是在 Cloudflare 的机房里发起的**，不在你的电脑上，所以那一步不会被墙。

### 第 1 步：建 Worker

1. Cloudflare 控制台 → `Workers & Pages` → `Create` → `Worker`
2. 名字填 `waline-proxy`（随意），`Deploy` 先建出默认模板
3. 点 `Edit code`，把编辑器里的内容**全部删掉**，粘贴 `cloudflare-worker/waline-proxy.js` 的全文，然后 `Deploy`

> 代码在仓库的 **`cloudflare-worker/waline-proxy.js`**，打开它全选复制即可。它和站长登录 Worker（`cloudflare-worker/index.js`）同一个目录，两个功能各用各的 Worker、各绑各的域名，互不干扰。

**这段代码在做什么**（复制之前先知道为什么这么写）：

- **`/__health` 本地应答**：不下发到上游，用来区分「代理没通」和「Waline 挂了」。
- **`OPTIONS` 预检自己答**：上游返回的 CORS 头是按 `jojostar-waline.vercel.app` 算的，原样透给浏览器会被判跨域失败。
- **响应头逐条搬、丢掉 `content-encoding`**：Workers 拿到的 body 已经解压过，保留这个头会让浏览器二次解码失败。
- **`set-cookie` 用 `getSetCookie()` 逐条取**：它是多值头，直接 `headers.set()` 会把多条压成一条，登录态就丢了。
- **`redirect: "manual"` + 改写 `Location`**：否则上游一个 302 就把访客带出代理域名，又回到被墙的 vercel.app。
- **204 / 304 / HEAD 返回空 body**：`new Response(body)` 遇到这些状态码会直接抛错。
- **上游挂了回 502 + JSON**：前端才能走「服务不可用」，而不是白屏。

### 第 2 步：绑自定义域名

1. 这个 Worker → `Settings` → `Domains & Routes` → `Add` → **`Custom domain`**
2. 填 `waline.jojocode.cn` → `Add domain`
3. 稍等 1~2 分钟变成 `Active`

Cloudflare 会**自动**在 `jojocode.cn` 区域里建好这条 DNS 记录（橙云，不能改）。**不要手去加 CNAME 指向 `cname.vercel-dns.com`** —— 那是方案 B 的做法，两者互斥，加了会冲突。

### 第 3 步：验证代理通不通

```bash
# 1. 代理自己活着
curl -s https://waline.jojocode.cn/__health
# 期望：waline-proxy ok

# 2. 能拿到真实留言数据（这条最关键）
curl -s "https://waline.jojocode.cn/api/comment?path=%2Flife%2Fguestbook%2F&page=1&pageSize=1&lang=zh-CN" | head -c 300
# 期望：{"errno":0,"errmsg":"","data":[...]} 或 data 为空数组，不能是 502/504

# 3. Waline 后台也能进
# 浏览器打开 https://waline.jojocode.cn/ui
```

三条都过了再往下走。

### 第 4 步：切换博客的配置

博客代码不用改，只改一个 Secret：

`GitHub 仓库 → Settings → Secrets and variables → Actions → PUBLIC_WALINE_SERVER`

```
https://waline.jojocode.cn
```

保存后**手动跑一次** `Deploy to GitHub Pages`（或推一次 `main`）—— `PUBLIC_WALINE_SERVER` 是**构建时**注入的，不重新构建不生效。

本地调试：`.env` 里同样写 `PUBLIC_WALINE_SERVER=https://waline.jojocode.cn`。

### 第 5 步：验收

1. 打开 `/life/guestbook/`，骨架屏变成留言列表（没有留言则显示空状态）
2. 随便找篇文章，评论区正常加载、能发表
3. 文章列表卡片能显示浏览量数字
4. 登录 `https://waline.jojocode.cn/ui` 能审核留言

## 四、方案 B：Vercel 自定义域名 + Cloudflare 橙云

能走通，但坑多，只有在「不想用 Worker」时才选。

### 步骤

1. Vercel 项目 → `Settings` → `Domains` → 输入 `waline.jojocode.cn` → `Add`
2. Vercel 会提示要配的 DNS 记录：`CNAME` / 名称 `waline` / 值 `cname.vercel-dns.com`
3. **回 Cloudflare，先把这条记录建成「DNS only」（灰云，橙色开关关掉）**
   —— 这一步不能省，橙云状态下 Vercel 无法验证域名所有权、也签不了证书
4. 回 Vercel 等状态从 `Pending` 变成 `Valid Configuration`，且 SSL 证书签发完成
5. **再回 Cloudflare 把这条记录改成 Proxied（橙云）**
6. Cloudflare → `SSL/TLS` → `Overview` → 加密模式必须是 **Full (strict)**
   —— 选 Flexible 会立刻 `ERR_TOO_MANY_REDIRECTS`
7. 等几分钟，Vercel 会提示 `DNS points to Cloudflare` 的警告，可以忽略

### 四个必须知道的坑

1. **Vercel 官方不支持这么干**，它会持续检测到 DNS 在 Cloudflare 并给出警告；不影响运行，但**域名验证和证书续期是周期性重跑的**。Let's Encrypt 每 90 天续期走 HTTP-01 验证（`/.well-known/acme-challenge/*`），这条路如果被 Cloudflare 的规则、WAF 或缓存拦住，续期失败 → 到期后站点直接 526。
2. **重定向循环**：Vercel 的 `Redirect to www` + Cloudflare 的 `Always Use HTTPS` 同时开会互相弹。真遇到就关掉其中一个。
3. **国内速度不会因为换成自己的域名就变快**。走的还是 Cloudflare 免费边缘，跟 `jojocode.cn` 一个水平——能用，但不算快。
4. **和方案 A 互斥**：`waline.jojocode.cn` 只能有一个归属。如果先按方案 A 建了 Worker 自定义域名，要先把那条删掉才能给 Vercel 用。

## 五、方案 C：迁出 Vercel（长期方案）

如果不想长期依赖 Vercel + 反代这层间接，就把 Waline 整个搬走。要动的东西：

1. 在新平台重新部署 Waline（它就是个 Node 服务，环境变量 `SITE_NAME` / `SITE_URL` / `SECURE_DOMAINS=jojocode.cn` / `COMMENT_AUDIT=true` / `DISABLE_REGION=true` 照搬）
2. **数据库不用迁**：数据在 Neon（独立于 Vercel），把 `DATABASE_URL` / `DATABASE_SSL` 等连接变量复制到新平台即可，表结构和数据都在
3. 新平台要有一个**国内可达的默认域名**，或者同样配自定义域名
4. 改 `PUBLIC_WALINE_SERVER` + 重新部署博客
5. 注册过管理员就还是那一套，后台 `<新地址>/ui`

选平台时的判断标准只有一条：**默认域名在国内能不能直连**。`*.vercel.app` 是被墙的典型，其他平台的国内可达性也会变，签合同/充值前先 `curl` 一次确认。

> 顺带说一句：换评论后端（比如 Twikoo、Artalk）不是省事选项。当前留言板是围绕 Waline 的数据结构深度定制的（`GuestbookChat.svelte` 1452 行，回复用 `pid`/`rid`、表情包、审核状态、编辑删除全绑在 Waline 上），换后端等于重写整个留言板。迁移托管比重写前端便宜得多。

## 六、切换后必须回头检查的两件事

1. **`SECURE_DOMAINS` 还是 `jojocode.cn`**，不用改。浏览器页面的 Origin 始终是 `https://jojocode.cn`，代理只换了接口地址，Waline 的 CSRF 校验照样通过。若哪天出现 403 CSRF 报错，先回来查这一项。
2. **管理员的登录态是存在 `localStorage` 里的**，换域名后要重新登录一次 `https://waline.jojocode.cn/ui`。

## 七、回滚

任何一步出问题，把 `PUBLIC_WALINE_SERVER` 改回 `https://jojostar-waline.vercel.app`，重新部署一次博客即可回到「15 秒超时报错」的状态——不会比现在更差。

## 八、方案 A 的代码验证记录

`cloudflare-worker/waline-proxy.js` 不是抄来就贴的。落地前在本地起了一个假上游（故意返回错误的 CORS 头、两条 `set-cookie`、一个 302、一个 204），用 Node 的 `Request`/`Response`/`fetch`（undici，API 与 Workers 同构）跑了 9 个用例：

| 用例 | 期望 | 实测 |
|---|---|---|
| `GET /__health` | 200 `waline-proxy ok` | ✅ |
| `GET /api/comment` | 200 + JSON 透传 | ✅ |
| 上游给了错误的 `Access-Control-Allow-Origin` | 被改写成请求的 Origin | ✅ 改成 `https://jojocode.cn` |
| 上游给两条 `set-cookie` | 两条都保留（不能被压成一条） | ✅ |
| `OPTIONS` 预检 | 204，且**不打到上游** | ✅ |
| 上游返回 302 到 vercel.app | Location 换成代理域名 | ✅ 改成 `https://waline.jojocode.cn/ui` |
| 上游返回 204（空 body） | 不因 `new Response(body)` 报错 | ✅ |
| `POST` 带 JSON body | body 原样透传 | ✅ 回显一致 |
| 上游整台挂掉 | 502 + `{"errno":-1}`，不是白屏 | ✅ |

唯一只在本地测试里出现的差异：Node 转发 stream body 必须带 `duplex: "half"`，**Cloudflare 里不能加这个参数**，所以 `waline-proxy.js` 里没有它——这是正确的，别自己补上。

