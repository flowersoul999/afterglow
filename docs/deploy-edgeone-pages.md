# EdgeOne Pages 部署指南（GitHub 集成）

> ## ⚠️ 这份文档描述的是**未采用的方案**，别照着操作
>
> 本文是随上游仓库一起搬过来的残留文档。本仓库**从未**迁到 EdgeOne Pages 托管，
> 实际部署是 **GitHub Actions → GitHub Pages**（外加 CDN 回源），见 **`deploy-github-pages.md`**。
>
> 保留它只为对比参考。真正会误导人的两处：本文说「生产为 EdgeOne Pages 托管」、
> 说「仓库不含 GitHub Pages 遗留配置（`public/CNAME` 已删除）」—— 两条都不符合现状：
> `public/CNAME` 存在且必须保留，`deploy-pages.yml` 才是线上部署工作流。
>
> （2026-11-04 查证：`curl -I https://jojocode.cn` 响应头带 `x-github-request-id`，回源确实是 GitHub Pages。）

> 博客生产部署为 **EdgeOne Pages**：push 到 `main` 后 EdgeOne 拉取仓库自动构建并托管，线上地址 `https://jojocode.cn/`。
> 本文档是控制台操作手册，2026-09 从 GitHub Pages 迁移而来（迁移记录见第四节）。

## 一、部署架构

```text
Push main（日常写作 / PagesCMS 后台 / 友链自动脚本）
    ↓ GitHub Webhook
EdgeOne Pages 项目（GitHub 集成，自动构建）
    ├─ pnpm build → dist/（生成图标 → astro build → pagefind）→ 静态托管
    └─ edge-functions/ → 边缘函数，自动映射成 /api/*（站长登录 + GitHub 代理，2026-11-04）
    ↓ DNS（jojocode.cn CNAME → Pages 分配的默认域名）
用户浏览器
```

- 无独立 CDN 加速层：EdgeOne Pages 托管本身即边缘分发
- 无 GitHub Actions 部署工作流（`pages.yml` 已删除）；`build.yml` 保留作 CI 质量门（`astro check` + `pnpm build`，与 EdgeOne 构建一致）
- 后台 PagesCMS 独立部署在 Vercel（`cms.jojocode.cn`），只写 git 仓库，与博客托管无关（见 `deploy-pagescms-vercel.md`）

## 二、EdgeOne 控制台配置（首次一次性）

### 1. 创建 Pages 项目

1. 打开 EdgeOne 控制台 → **Pages** → **新建项目**（或复用现有项目）
2. 选择 Git 提供商 **GitHub** → 关联仓库 `flowersoul999/afterglow`
3. 分支：`main`

### 2. 构建设置

| 配置项 | 值 |
|---|---|
| 构建命令 | `pnpm build`（内部 = `node scripts/生成图标/index.js` → `astro build` → `pagefind --site dist`） |
| 输出目录 | `dist` |
| Node.js | 22.x |
| 包管理器 | pnpm（仓库 `.npmrc` 强制；`packageManager` 固定 `pnpm@9.14.4`） |

### 3. 环境变量（13 个 `PUBLIC_*` 必填；站长登录另有 2 个，见 5.2）

这些变量对应渲染期/构建期密钥，值从 GitHub 仓库 **Settings → Secrets and variables → Actions** 复制（两边必须保持同步；改任何一边都要同步另一边）：

| 变量名 | 用途 |
|---|---|
| `PUBLIC_AMAP_KEY` | 高德地图 |
| `PUBLIC_AMAP_KEY_PLACES` | 高德地点 |
| `PUBLIC_UMAMI_BASE` | Umami 统计地址 |
| `PUBLIC_UMAMI_USERNAME` | Umami 服务端代理账号 |
| `PUBLIC_UMAMI_PASSWORD` | Umami 服务端代理密码 |
| `PUBLIC_UMAMI_WEBSITE_ID` | Umami 站点 ID |
| `PUBLIC_UMAMI_SHARE_ID` | Umami 分享 ID（首页统计 fallback） |
| `PUBLIC_WALINE_SERVER` | Waline 评论后端地址 |
| `PUBLIC_IMAGEBED_URL` | 图床地址 |
| `PUBLIC_IMAGEBED_AUTH_CODE` | 图床上传鉴权码 |
| `PUBLIC_IMAGEBED_FOLDER` | 图床上传目录 |
| `PUBLIC_IMAGEBED_API_TOKEN` | 图床 API Token |
| `PUBLIC_TTS_SERVER` | 文章朗读 TTS 服务地址，留空降级浏览器系统语音 |

> 缺失任何变量构建仍会成功，但对应功能静默降级（评论无后端、统计空白），务必逐项核对。

### 4. 首次构建与预览验证
触发构建直到成功，用分配的预览域名（非正式域名）验证关键路径：

- 首页渲染、Swup 导航、主题切换
- 文章页、分类页、归档页
- 账单 `/bills/`、笔记本 `/笔记本/`、日程 `/schedules/`（内容直接展示）
- `/search/`（pagefind）、`sitemap.xml`、`robots.txt`、RSS
- 评论 / 首页统计 / 音乐 / 相册 / 朋友圈 /circle/ / 友链状态徽标
- 404 页、`trailingSlash` 尾斜杠路由

### 5. 站长登录（GitHub OAuth + 边缘函数）

> 2026-11-04 新增。站内编辑要先确认「你是站长」，纯静态站做不到，所以登录走 GitHub OAuth，
> **换 token 与校验身份由仓库根目录 `edge-functions/` 下的边缘函数完成**（EdgeOne Pages 的函数能力，
> 按目录自动生成路由，不需要额外配置文件）。
> 这套东西**只在线上生效**：`pnpm dev` 不跑边缘函数，本地点登录会提示「登录服务未部署」，属正常。

#### 5.1 创建 GitHub OAuth App

1. 打开 <https://github.com/settings/developers> → **OAuth Apps** → **New OAuth App**
2. 填写：

| 字段 | 值 |
|---|---|
| Application name | 随意，比如 `jojocode 站内编辑` |
| Homepage URL | `https://jojocode.cn` |
| Authorization callback URL | `https://jojocode.cn/api/auth/callback` ← **必须一字不差** |

3. 创建后记下 **Client ID**；点 **Generate a new client secret**，记下 **Client secret**（只显示一次，页面刷掉就没了）

> Callback URL 必须精确到 `/api/auth/callback` 这个路径。填错会在授权时看到
> GitHub 报 `redirect_uri_mismatch`，而且不会回跳到本站。

#### 5.2 追加环境变量

在 EdgeOne Pages 项目的环境变量设置里追加（与现有 13 个 `PUBLIC_*` 并列）：

| 变量名 | 值 | 必填 | 说明 |
|---|---|---|---|
| `GITHUB_CLIENT_ID` | 5.1 的 Client ID | ✅ | |
| `GITHUB_CLIENT_SECRET` | 5.1 的 Client Secret | ✅ | **机密** |
| `SITE_ORIGIN` | `https://jojocode.cn` | — | 不填默认就是它；将来换域名才需要 |
| `AUTH_SECRET` | 一串长随机字符 | — | 不填时用 Client Secret 派生 Cookie 加密密钥 |

> ⚠️ **绝不要**给 `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` 加 `PUBLIC_` 前缀。
> 带 `PUBLIC_` 的变量会被 Vite 打进客户端产物，等于把 secret 发给每一个访客。

改完环境变量必须**重新部署**才生效。

#### 5.3 验证

1. 打开 <https://jojocode.cn/>，鼠标移到左上角 `JOJOSTAR` 上
2. 资料卡里出现「登录」小胶囊 → 点击
3. 弹窗里点「使用 GitHub 登录」→ 跳 GitHub → 点 **Authorize**
4. 回到站内应看到绿色提示「GitHub 登录成功」，每条说说 hover 出现编辑/删除按钮

| 现象 | 原因 |
|---|---|
| 点登录提示「登录服务未部署」 | `edge-functions/` 没被构建进去；或该 Pages 项目没开函数能力 |
| 点登录提示「还没配置 GitHub OAuth」 | 5.2 的两个变量没填 / 没重新部署 |
| GitHub 报 `redirect_uri_mismatch` | 5.1 的 Callback URL 与 `SITE_ORIGIN + /api/auth/callback` 不一致 |
| 回跳后仍是未登录 | Cookie 没写进去：必须 HTTPS；用预览域名登录但 `SITE_ORIGIN` 填的是正式域名也会这样 |
| 提示「这个 GitHub 账号不是站长」 | 判定在服务端硬编码为 `flowersoul999`，改它要改 `edge-functions/_lib/auth.js` 的 `ALLOWED_LOGIN` |

## 三、域名绑定与切换（零宕机）

1. 预览验证通过后，在 Pages 项目绑定 `jojocode.cn`，按控制台指引完成域名校验
2. 修改 DNS：`jojocode.cn` 的 CNAME 记录指向 Pages 项目分配的默认域名
3. **剥离旧配置**：EdgeOne 站点加速中 `jojocode.cn` 的加速配置必须移除（同一域名不能同时挂在站点加速和 Pages 下，避免解析/回源冲突）；旧 GitHub Pages 站点随工作流删除自动停用
4. 验证：`nslookup jojocode.cn` 确认 CNAME 指向 Pages 默认域名，浏览器实测关键路径，观察 1-2 天

## 四、迁移记录（2026-09-04：GitHub Pages → EdgeOne Pages）

**迁移前**（2026-08-22 ~ 09-04，提交 `a86280f`）：GitHub Actions（`pages.yml`）构建 → GitHub Pages 托管 → DNS → EdgeOne 站点加速（纯 CDN 回源）。
**迁移后**：EdgeOne Pages 直接拉仓库构建托管，链路缩短一跳。

代码侧变更：

- 删除 `.github/workflows/pages.yml`（GitHub Pages 部署）与 `public/CNAME`
  - 注：这两项在 2026-09-04 迁移时**漏删了**，`pages.yml` 仍随每次 push 触发部署（部署的是没绑自定义域名的 github.io 站点，属无效构建）；已于 **2026-09-21** 补删
- `build.yml` / `biome.yml` / `friend-status.yml` / `friend-screenshots.yml` 保留不动

注意事项：

- 友链状态检测每日 5:17 自动 commit `public/friends-status.json`、友链截图在 friends 内容变化时自动提交，都会触发 EdgeOne 构建（约每日 1 次 + 内容更新时），留意 EdgeOne Pages 构建配额
- PagesCMS 后台在后台编辑保存同样 push main → 触发构建，属正常
- 回滚：DNS 指回旧配置可秒级回滚；`pages.yml`/`CNAME` 在 git 历史中可随时恢复

## 五、常见问题

| 问题 | 排查 |
|---|---|
| 构建失败 | 先看 Node 版本是否 ≥ 22、pnpm 是否 9.14.x、构建命令是否为 `pnpm build`；与 `build.yml` 的 CI 行为对照 |
| 功能静默缺失（评论/统计空白） | 检查 13 个环境变量是否逐项填齐（见第二节表） |
| 需要换域名 | 改 `src/config/siteConfig.ts:16` 的 `site_url`（sitemap/robots/RSS/canonical 自动跟随）+ 控制台重新绑定域名；其余子服务地址（音乐 API 等）在各自 config 里单独维护，改域名不影响它们 |