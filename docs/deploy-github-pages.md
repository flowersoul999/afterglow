# 部署：GitHub Actions → GitHub Pages → EdgeOne CDN

> 链路：`push main` → Actions 构建 → 上传 Pages 站点 → EdgeOne 边缘缓存回源
> 域名：`jojocode.cn`（站点 `siteConfig.site_url` 与此一致，`base` 保持 `/`）

## 为什么这么绕

| 环节 | 作用 |
|---|---|
| GitHub Actions | 构建。无次数限制，替代 EdgeOne Pages 每月 500 次的构建额度 |
| GitHub Pages | 托管静态产物，免费、无带宽账单 |
| EdgeOne CDN | 边缘缓存 + 国内可达性。纯 `github.io` 在大陆访问不稳定 |

关键在于：**`base` 不需要改成 `/afterglow/`**。站点是挂在自定义域名根路径下的，所以代码里那些 `/assets/...`、`/pio/...` 的根绝对路径全都成立，不用逐个改。

## 一、GitHub 侧

### 1. 工作流

`.github/workflows/deploy-pages.yml`，`push main` 或手动 `workflow_dispatch` 触发：

```
checkout → pnpm 9.14.4 + Node 22 → pnpm install --frozen-lockfile
→ configure-pages(enablement: true) → pnpm build → upload-pages-artifact(dist)
→ deploy-pages
```

首次运行前**必须手工**在仓库 `Settings → Pages → Build and deployment → Source` 选择 **GitHub Actions**，否则 `deploy-pages` 会报「Get Pages site failed」。本流程刻意**不使用** `configure-pages` 的 `enablement: true`——它需要 `pages: write` 之外的建站权限，`GITHUB_TOKEN` 会被拒（`Resource not accessible by integration`）。

若想用命令行一次搞定，可用有 admin 权限的 token 调 API：

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  https://api.github.com/repos/flowersoul999/afterglow/pages \
  -d '{"build_type":"workflow"}'
```

### 2. 自定义域名

`public/CNAME` 内容为 `jojocode.cn`，随产物一起发布，GitHub Pages 据此识别自定义域名。**不需要**在 Settings 里再填一遍，但建议去 `Settings → Pages → Custom domain` 确认已识别，并勾选 `Enforce HTTPS`（在 EdgeOne 证书就绪后）。

### 3. 环境变量

构建读取 10 个 `PUBLIC_*`，**全部可选**——缺任何一个都不会让构建失败，只会让对应功能静默降级。在 `Settings → Secrets and variables → Actions → New repository secret` 逐个添加：

| 名称 | 用途 | 不配的后果 |
|---|---|---|
| `PUBLIC_AMAP_KEY` | 高德地图 Web端(JS API) Key | 「足迹」页地图不显示 |
| `PUBLIC_AMAP_KEY_PLACES` | 高德地图 Web服务 Key（地点搜索） | 足迹地点搜不出坐标 |
| `PUBLIC_UMAMI_BASE` | 自建 Umami 实例地址 | 统计脚本不加载 |
| `PUBLIC_UMAMI_WEBSITE_ID` | Umami 站点 ID | 首页统计空白 |
| `PUBLIC_UMAMI_SHARE_ID` | Umami 公开分享 ID（免账号密码拉数据） | 首页访客数走 API 代理，可能空白 |
| `PUBLIC_UMAMI_USERNAME` | Umami 账号（服务端代理拉数用） | 同上 |
| `PUBLIC_UMAMI_PASSWORD` | Umami 密码（同上） | 同上 |
| `PUBLIC_WALINE_SERVER` | Waline 后端地址 | **已切 giscus，可不配** |
| `PUBLIC_IMAGEBED_URL` | 自建 CloudFlare ImgBed 地址 | 相册/说说不能从后台上传图 |
| `PUBLIC_IMAGEBED_API_TOKEN` | ImgBed API Token | 同上（且无法上传前查重） |
| `PUBLIC_TTS_SERVER` | 朗读服务后端地址 | 文章「朗读」按钮不可用 |

> 已从工作流移除 `PUBLIC_BIXYH_QJHXRZP_HR`、`PUBLIC_IMAGEBED_AUTH_CODE`、`PUBLIC_IMAGEBED_FOLDER`：这三者在 `src/` 中从未被 `import.meta.env` 读取，属于上游遗留。

清单来源见根目录 `.env.example`。评论系统走 giscus（GitHub Discussions），**不需要**任何密钥，但需要在仓库上安装 giscus GitHub App（见「四、评论」）。

## 二、EdgeOne 侧

### 站点加速配置

| 项 | 值 | 说明 |
|---|---|---|
| 加速域名 | `jojocode.cn` | |
| 源站类型 | 域名 | |
| 源站地址 | `flowersoul999.github.io` | 不要带路径、不要带 `https://` |
| **回源 HOST** | `jojocode.cn` | ⚠️ **最容易踩的坑**：必须填自定义域名，不能是 `github.io` |
| 协议 | HTTP 回源（或「协议跟随」） | GitHub Pages 对自定义域名的证书签发依赖 DNS 指向它，DNS 指向 EdgeOne 时通常签不下来，所以回源用 HTTP 更稳 |
| 缓存 | 静态资源长缓存，HTML 短缓存 | 见下 |

**为什么回源 HOST 必须改**：GitHub Pages 用 Host 头定位站点。不填 `jojocode.cn`，请求会被当成 `flowersoul999.github.io/` 的根站点处理，直接 404 或落到用户主页。

### DNS

```
jojocode.cn  CNAME  <EdgeOne 分配的加速域名>（如 xxx.eo.dnse2.com）
```

⚠️ `jojocode.cn` 是**裸域**，按 DNS 规范不能直接挂 CNAME。要么加一条 `@` 的 A/ALIAS（EdgeOne 会给出目标 IP），要么把站点挂到 `www.jojocode.cn` 再把裸域 301 过去。

### 缓存策略建议

| 路径 | 策略 |
|---|---|
| `/_astro/*`、`/pagefind/*` | 长缓存（内容哈希命名，可 `max-age=31536000`） |
| `/*.html`、`/` | 短缓存或 `no-cache`，保证更新即时可见 |
| `/api/*`、`/friends-status.json` | 不缓存 |

## 三、验证

```bash
# 1. Pages 是否上线（未绑域名前）
curl -I https://flowersoul999.github.io/afterglow/

# 2. 自定义域名 + 边缘缓存
curl -skI https://jojocode.cn/ | grep -iE "EO-Cache-Status|Server|Content-Length"
# 期望看到：Server: edgeone ...、EO-Cache-Status: Cache Hit / Miss / Refreshed

# 3. 回源 HOST 是否正确（首页应有站点标题，而不是 GitHub 404）
curl -s https://jojocode.cn/ | grep -o "<title>[^<]*</title>"
```

## 四、评论系统（giscus）

评论走 **giscus**，本质是把每个页面的评论存成仓库的一条 GitHub Discussion，零后端、零密钥。

`src/config/commentConfig.ts` 里的值已经填好，**不需要**再去 giscus.app 点一遍（那只是给人看的配置生成器）：

| 字段 | 值 | 来源 |
|---|---|---|
| `type` | `giscus` | — |
| `giscus.repo` | `flowersoul999/afterglow` | — |
| `giscus.repoId` | `R_kgDOVaquiQ` | `GET /repos/{o}/{r}` 的 `node_id` |
| `giscus.category` | `Announcements` | 只有维护者能新建讨论，防止游客在 Discussions 页乱建 |
| `giscus.categoryId` | `DIC_kwDOVaquic4DJ5QM` | GraphQL `discussionCategories` 查询 |

前置条件（前两步已完成，第三步必须人工）：

1. 仓库是 **public**（private 仓库 giscus 读不到）。
2. **Discussions 已开启**：`Settings → General → Features → Discussions` 勾上。也可用 API：`PATCH /repos/{o}/{r}` 传 `{"has_discussions": true}`。
3. **安装 giscus App**：打开 https://github.com/apps/giscus → `Install` → 选中 `afterglow`（或 `All repositories`）→ 授权。**只有仓库 owner 能在浏览器里完成这一步**，API 无法代做。未安装时评论框会显示 `giscus: 仓库未安装 giscus app` 之类的报错。

验证：任意文章页滑到底，能看到评论区并成功发一条测试评论；仓库 `Discussions` 里会出现一条以页面标题命名的讨论（`mapping: "title"`）。

## 五、已知坑

1. **回源 HOST 忘记改** → 全站 404 或显示 GitHub 404 页。这是该方案最高频的故障。
2. **裸域 CNAME** → DNS 服务商拒绝保存。用 ALIAS/ANAME，或改用 `www`。
3. **构建产物 173 MB / 828 文件** → 远低于 Pages 的 1 GB 站点上限，但首次部署上传较慢属正常。
4. **`pagefind` 索引** → 由 `pnpm build` 的最后一步生成在 `dist/pagefind/`，漏掉这一步搜索会空。
5. **本地跑 Biome 报一堆假错** → 见 `.gitattributes` 里的行尾契约；Windows 检出若不是 LF，Biome 会把每行都判成格式不符。
6. **部署后页面卡骨架屏 / `Failed to fetch dynamically imported module`** → 不是服务器坏了，是浏览器拿着缓存里的旧 HTML 去要**已被删除的旧哈希 chunk**。GitHub Pages 每次部署整体替换产物，而 HTML 带 `Cache-Control: max-age=600`。临时解法：`Ctrl+Shift+R` 强刷；根治见下一节。

## 六、让 HTML 不被浏览器缓存（强烈建议）

### 为什么会出问题

GitHub Pages 对所有文件都发 `Cache-Control: max-age=600`，**包括 HTML**。而 `/_astro/*.js` 带内容哈希，每次构建都会变：

1. 访客在部署前加载了页面，HTML 进浏览器缓存（有效 10 分钟）
2. 部署完成，旧哈希的 chunk 全部消失
3. 访客在 10 分钟内再访问 → 用缓存 HTML 里的旧路径请求 chunk → **404**
4. Astro 的 `astro-retry` 会带上 `?astro-retry=<ts>` 重试，但文件已经不存在，重试必然失败 → 页面永久停在骨架屏

已实测：旧 `GuestbookChat.B5ao4h0M.js` 返回 404，新 `GuestbookChat.BKZAQa5y.js` 返回 200，同一时刻并存。

### 修法：Cloudflare 响应头转换规则

让 HTML 每次回源校验（304 很廉价），带哈希的静态资源继续走 10 分钟缓存，两者互不影响。

> **注意**：这里必须用 **Transform Rules → Modify Response Header**，不能用 Cache Rules。Cache Rules 只管 Cloudflare 边缘是否缓存，改不了发给浏览器的 `Cache-Control`。官方文档也明确写了：响应头转换规则改 `cache-control` **不会**影响 Cloudflare 自身的缓存判定（HTML 本来就是 `cf-cache-status: DYNAMIC`，不缓存）。

**操作路径**：Cloudflare → 选中 `jojocode.cn` → `Rules` → `Transform Rules` → `Modify Response Header` → `Create rule`

| 项 | 值 |
|---|---|
| Rule name | `HTML no-cache` |
| When incoming requests match | **Custom filter expression** |
| Field | `URI Path` |
| Operator | `does not contain` |
| Value | `.` |
| Then | **Set static** |
| Header name | `cache-control` |
| Header value | `no-cache` |

表达式等价于 `not (http.request.uri.path contains ".")`。**用 URI 路径做判断而不是 `http.response.content_type`**——响应头规则的筛选阶段对 `http.response.*` 字段的支持受限，路径判断在任何阶段都可用。

站点用的是无扩展名的干净 URL（`/`、`/about/`、`/life/guestbook/` 都不含点），而所有静态资源都带扩展名（`/_astro/x.js`、`/assets/x.webp`、`/rss.xml`），所以这条规则正好只命中 HTML。

创建后重新部署一次或 Purge Cache，然后用下面命令确认：

```bash
curl -sI https://jojocode.cn/about/ | grep -i cache-control   # 期望 no-cache
curl -sI https://jojocode.cn/_astro/ 2>/dev/null | head -1     # 资源不受影响
```

