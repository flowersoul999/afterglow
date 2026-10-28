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

`enablement: true` 让首次运行时自动创建 Pages 站点并把 Source 设为 **GitHub Actions**。若因权限失败，手动走：仓库 `Settings → Pages → Build and deployment → Source: GitHub Actions`。

### 2. 自定义域名

`public/CNAME` 内容为 `jojocode.cn`，随产物一起发布，GitHub Pages 据此识别自定义域名。**不需要**在 Settings 里再填一遍，但建议去 `Settings → Pages → Custom domain` 确认已识别，并勾选 `Enforce HTTPS`（在 EdgeOne 证书就绪后）。

### 3. 环境变量

构建需要 13 个 `PUBLIC_*`，缺任何一个都不会让构建失败，只会让对应功能静默降级（评论无后端、统计空白、图床上传不可用等）。在 `Settings → Secrets and variables → Actions` 添加：

```
PUBLIC_AMAP_KEY            PUBLIC_UMAMI_BASE          PUBLIC_IMAGEBED_URL
PUBLIC_AMAP_KEY_PLACES     PUBLIC_UMAMI_USERNAME      PUBLIC_IMAGEBED_AUTH_CODE
PUBLIC_BIXYH_QJHXRZP_HR    PUBLIC_UMAMI_PASSWORD      PUBLIC_IMAGEBED_FOLDER
PUBLIC_UMAMI_SHARE_ID      PUBLIC_WALINE_SERVER       PUBLIC_IMAGEBED_API_TOKEN
PUBLIC_TTS_SERVER
```

清单来源见根目录 `.env.example`。

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

## 四、已知坑

1. **回源 HOST 忘记改** → 全站 404 或显示 GitHub 404 页。这是该方案最高频的故障。
2. **裸域 CNAME** → DNS 服务商拒绝保存。用 ALIAS/ANAME，或改用 `www`。
3. **构建产物 173 MB / 828 文件** → 远低于 Pages 的 1 GB 站点上限，但首次部署上传较慢属正常。
4. **`pagefind` 索引** → 由 `pnpm build` 的最后一步生成在 `dist/pagefind/`，漏掉这一步搜索会空。
5. **本地跑 Biome 报一堆假错** → 见 `.gitattributes` 里的行尾契约；Windows 检出若不是 LF，Biome 会把每行都判成格式不符。
