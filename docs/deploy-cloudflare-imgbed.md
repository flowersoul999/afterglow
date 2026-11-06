# CloudFlare ImgBed 部署与博客接入

> 目标：将 `MarSeventh/CloudFlare-ImgBed` 独立部署到 Cloudflare Pages，并通过 `img.jojocode.cn` 为博客相册提供图片读取能力。博客本体继续由 GitHub Pages 托管，现有站长登录 Worker 不需要改动。

## 一、推荐架构

```text
jojocode.cn                 GitHub Pages 博客
img.jojocode.cn             Cloudflare Pages 图床
  ├─ KV: img_url            文件元数据（必选，和 D1 二选一）
  └─ R2: img_r2             图片文件（推荐）
```

推荐使用 KV + R2：部署链路最短，图片读取不依赖 Telegram 或境外第三方接口。R2 免费额度之外可能收费，Cloudflare 通常会要求绑定支付方式。若不想绑定支付方式，可在图床后台改用 Telegram、HuggingFace 或现有 S3/WebDAV 渠道。

## 二、部署 Cloudflare Pages

1. Fork 官方仓库 `MarSeventh/CloudFlare-ImgBed` 到自己的 GitHub 账号。
2. Cloudflare 控制台进入“计算和 AI” → “Workers & Pages” → “创建应用程序” → Pages → “导入现有 Git 存储库”。
3. 选择刚 Fork 的仓库，使用以下构建配置：

| 配置项 | 值 |
|---|---|
| 生产分支 | `main` |
| 构建命令 | `npm install` |
| 构建输出目录 | `/frontend-dist` |

4. 首次部署完成后，暂时不要上传正式图片，先完成数据库、存储和安全配置。

## 三、绑定数据库

KV 与 D1 只选一个。为了快速部署，使用 KV：

1. Cloudflare 控制台进入“存储和数据库” → “Workers KV” → “创建实例”。
2. 命名空间名称填写 `img_url`。
3. 返回图床 Pages 项目 → “设置” → “绑定” → “添加” → “KV 命名空间”。
4. 变量名称必须填写 `img_url`，命名空间选择刚创建的实例。
5. 保存后进入“部署”，对最新部署执行“重试部署”。

变量名写错会导致管理界面不可用。若改用 D1，数据库绑定名必须为 `img_d1`，并先执行官方仓库的 `database/init.sql`。

## 四、绑定 R2 存储

1. Cloudflare 控制台进入 R2，创建存储桶，例如 `jojostar-imgbed`。
2. 返回图床 Pages 项目 → “设置” → “绑定” → “添加” → “R2 存储桶”。
3. 变量名称必须填写 `img_r2`，选择刚创建的存储桶。
4. 再次重试部署。
5. 打开图床管理后台，在“系统设置” → “上传设置”中添加并启用 Cloudflare R2 渠道，将其设为默认上传渠道。

## 五、安全配置

在 Pages 项目的生产环境变量中至少设置：

| 变量 | 用途 |
|---|---|
| `BASIC_USER` | 图床管理员用户名 |
| `BASIC_PASS` | 图床管理员强密码 |
| `AUTH_CODE` | 网页上传认证码 |

保存变量后重新部署。不要把这些值写进博客仓库、`.env.example` 或 GitHub Actions。

进入图床后台后，在“系统设置” → “安全设置” → “认证管理”创建一个 API Token：

- 名称：`jojostar-album-readonly`
- 权限：只选 `list`
- 所有者：管理员账号
- 有效期：可设为长期；若设置过期时间，要同步安排轮换

博客相册会在浏览器中使用这个 Token 调用 `/api/manage/list`，因此它必然对访客可见。绝不能给它 `upload`、`delete` 或 `manage` 权限。上传专用 Token 必须另建，并只保存在服务端或本地私密配置中。

## 六、绑定图床域名

1. Pages 项目 → “自定义域” → 添加 `img.jojocode.cn`。
2. 等待证书生效后，确认以下地址可以打开：

```text
https://img.jojocode.cn/
https://img.jojocode.cn/api/manage/list?start=0&count=1
```

第二个地址不带 Token 时应返回未授权，而不是 404。不要将图床绑定到博客现有的 `/api/*` Worker Route；图床使用独立子域名，不会影响 `jojocode.cn/api/auth/*` 和 `jojocode.cn/api/github/*`。

## 七、接入博客

### 本地开发

在本地 `.env` 中填写：

```dotenv
PUBLIC_IMAGEBED_URL=https://img.jojocode.cn
PUBLIC_IMAGEBED_API_TOKEN=只含list权限的Token
```

### GitHub Pages 生产环境

进入博客仓库 GitHub → Settings → Secrets and variables → Actions → Secrets，新增或更新：

| Secret | 值 |
|---|---|
| `PUBLIC_IMAGEBED_URL` | `https://img.jojocode.cn` |
| `PUBLIC_IMAGEBED_API_TOKEN` | 只含 `list` 权限的 Token |

保存后手动触发 `Deploy to GitHub Pages`，或推送一次 `main`。

## 八、目录约定

博客相册内容中的 `imgbedFolder` 使用以下结构：

```text
blog/album/<相册名>
```

例如 `imgbedFolder: "blog/album/旅行"` 对应图床中的同名目录。文章与说说图片建议分别放在 `blog/posts/` 和 `blog/moments/`，避免根目录长期堆积。

## 九、验收

1. 在图床上传一张测试图到 `blog/album/test`。
2. 使用只读 Token 请求列表接口：

```bash
curl "https://img.jojocode.cn/api/manage/list?dir=blog%2Falbum%2Ftest&start=0&count=10" \
  -H "Authorization: Bearer <只读 Token>"
```

3. 响应中的 `files` 应包含测试图，图片可通过 `https://img.jojocode.cn/file/<文件名>` 打开。
4. 博客重新部署后访问 `/album/`，确认照片墙可以加载图片。
5. 在浏览器开发者工具中确认列表请求只携带 `list` Token，没有管理员密码、上传认证码或上传 Token。

## 十、常见问题

| 现象 | 排查 |
|---|---|
| 管理页打不开或数据为空 | KV 绑定变量必须是 `img_url`；绑定后要重试部署 |
| R2 上传失败 | R2 绑定变量必须是 `img_r2`，后台还要启用 R2 渠道 |
| 相册提示未配置 Token | 检查 GitHub Actions Secrets，并重新部署博客 |
| 相册接口返回 401/403 | Token 是否存在、过期，且包含 `list` 权限 |
| 列表有文件但图片 404 | 检查文件名、目录和 `/file/` 路径；不要手工拼接多余斜杠 |
| 改了 Secret 但线上没变化 | Secret 只在构建时注入，需要重新运行 Pages 部署工作流 |

官方参考：`https://cfbed.sanyue.de/guide/quick-start.html`。
