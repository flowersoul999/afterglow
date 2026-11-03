# AGENTS.md

**回复语言：必须全程使用中文回答用户，禁止使用英文**（用户看不懂英文）。

**先读 CLAUDE.md**：本仓库唯一权威工程规范（23 节 §0-22：命令、目录结构、样式/组件规范、i18n、Swup 生命周期、反模式清单、技术栈版本、PagesCMS 后台、更新日志与收尾规范）。所有开发行为必须遵守。修改项目后必须同步更新 CLAUDE.md（第 20 节）。

**勿把 CLAUDE.md 内容复制进本文件**（CLAUDE.md §17 规定 AGENTS.md 只是入口，避免双重维护）。本文件仅保留最高频的启动事实，细节一律以 CLAUDE.md 为准。

## 项目概览

- Firefly v6.6.13 —— "jojostar"（jojo 的个人博客），Fork 自 CuteLeaf/Firefly 并深度定制
- 部署：**生产为 EdgeOne Pages**（GitHub 集成：push main 自动 `pnpm build` 并托管 https://jojocode.cn，见 `docs/deploy-edgeone-pages.md`）；GitHub Actions 的 `build.yml` 仅作 CI 质量门；仓库不含 GitHub Pages 遗留配置（`pages.yml` / `public/CNAME` 均已删除）。后台 PagesCMS **当前未部署**（配置在根目录 `.pages.yml`，字段必须与 `src/content.config.ts` 的 zod 对齐，未声明字段保存时被丢弃）
- 12 个 Astro Content Collections（`src/content.config.ts` + `src/content/`：文章/页面/动态/影视/足迹/面经/相册/导航/资源/友链/更新日志，以及 `src/content/友链/墓碑`（tombstones）；**集合键名是英文、不随目录改名**，`getCollection()` 用键名）
- **本地 AstrBot 插件**（`plug-in/AstrBot/astrbot_plugin_blog_writer/`，`plug-in/` 被本仓库整体 gitignore → 改动不进 git）：微信/QQ 发消息直接提交博客内容。**改它之后必须** `python -m unittest discover -s tests`（129 用例）+ 用 Python `zipfile` 重打 `plug-in/AstrBot/打包/` 里的 zip（`Compress-Archive` 会把中文文件名打成乱码）；部署见 `plug-in/AstrBot/部署/部署手册.md`
- 主要目录：`src/components/`（按功能域 12 子目录：about/analytics/comment/common/controls/features/layout/misc/moments/pages/seo/widget，禁止根目录平铺） / `src/pages/`（35 路由，admin 已删） / `src/styles/main.css`（唯一入口） / `src/config/`（27 配置 + index.ts barrel） / `src/utils/`（41 个工具与控制器，含 category-tree.ts、tts-text.ts） / `scripts/`（11 个中文命名脚本目录 + cli.js 与 5 个英文 .mjs 脚本，含 TTS服务/ 朗读服务）

## 快速上手

- 包管理器仅限 pnpm 9.14（preinstall 强制）；Node >= 22；主仓库无测试框架（验证 = dev 实测 + build/check，分级见 CLAUDE.md §18.1；AstrBot 插件子目录例外，它有 129 个 unittest）
- 本地 dev/build 前先备 `.env`（照抄 `.env.example`）：缺失 `PUBLIC_*` 变量不会报错，但对应功能静默降级（评论无后端、统计空白）
- `pnpm dev` 开发；**日常小改不必构建**，只有**推送线上前**或**大改动完成**时才跑 `pnpm build`（生成图标 → astro build → pagefind 索引），分级规则见 CLAUDE.md §18.1
- 提交信息格式 `<type>(<scope>): <描述>`（feat|fix|refactor|style|docs|chore|perf，见 CLAUDE.md §18）
- 验证手段 = `pnpm dev` 实测 +（推送线上 / 大改动时）`pnpm build` + `pnpm check`（astro check）+ `pnpm type-check`（tsc --noEmit --isolatedDeclarations）
- GitHub Actions：build.yml（main/PR）跑 `astro check`（Node 22+23）+ `pnpm build`（Node 22）；biome.yml 跑 `biome ci ./src --reporter=github`；CI 若红优先看 astro check 类型错误
- `pnpm lint` / `pnpm format` = Biome（唯一 linter/formatter，作用域 ./src；CI 自动读 package.json 固定版本 2.5.7，勿在 workflow 里写 `latest`）
- 每完成一个模块/功能（属 §18.1 C 档）：立即写 `src/content/changelog/` 条目（§21，feature→minor、fix→patch 递增 version，勿攒批）+ 按 §22 收尾（清临时脚本、`pnpm build` + `pnpm check` + `pnpm exec biome ci ./src --reporter=github` 全绿、浏览器实测关键路径，边界不清就问站长）

## 最易踩坑（详见 CLAUDE.md §15）

- Astro 7 + Svelte 5 + Tailwind v4：无 tailwind.config.js，勿按 Astro 6 / Tailwind 3 文档操作
- 样式必须经 `src/styles/main.css` 导入；禁止新建 `!important`、硬编码 `#000/#fff`、Stylus 文件；暗色选择器统一 `:root.dark`
- Svelte 5 runes：响应式变量（含 DOM ref）必须 `$state`；非 void 标签禁止自闭合
- Swup SPA 导航：容器内组件避免 `client:load`；监听器用 AbortController 清理；跨导航单例用 `window.__xxx` guard（§8-9）
- 新 i18n 键要同时加进 `i18nKey.ts` 与 `languages/zh_CN.ts`（2026-10-20 起只有中文一份，§7）
- 新增 Swup 功能禁止改 `swup-lifecycle-controller.ts`，用 `swup:content:replaced` 事件自注册（§11.4）
- 页面交互脚本必须放在 Swup 容器内（MainGridLayout slot 里），否则 SPA 导航进入页面时不执行（§15）
- dev 下组件卡初始状态（"加载中…"、按钮无反应）先查浏览器控制台是否报 `504 Outdated Optimize Dep`：删 `node_modules/.vite` 重启 dev（§15）
- 禁止用 Python 脚本操作/修改文件，一律用 Node 脚本（§15）
- **`src/content/` 是嵌套 git 仓库**（私人内容备份），**绝不能在 `src/content/` 下放 `.gitignore`**——会被博客主仓一并读取，把 `文章/`、`笔记本/`、`更新日志/` 整体忽略，导致新文章静默提交不上去。备份仓库的规则只能写 `src/content/.git/info/exclude`（§23）
- 在 `src/content/` 里执行 git 操作的是**备份仓库**，不是博客主仓；两个仓库的 `git status` 互不通用（§23）
