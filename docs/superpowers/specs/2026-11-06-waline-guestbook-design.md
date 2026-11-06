# Waline 留言服务接入设计

## 目标

将 `my-blog` 的沉浸式对话留言板完整迁移到 `/life/guestbook/`，站点评论后端统一使用 Waline，并为 GitHub Pages + Vercel + Neon 的部署组合补齐配置说明。

## 方案

- 博客仍由 GitHub Pages 托管，不新增站内服务端代码。
- Waline 独立部署到 Vercel，数据存储在 Neon PostgreSQL。
- 前端仅通过 `PUBLIC_WALINE_SERVER` 读取 Waline 公共服务地址。
- 数据库连接、管理员账号、邮件通知等敏感配置只保存在 Vercel 环境变量中。
- 保留 `GuestbookChat.svelte` 现有的消息加载、游客资料、回复、编辑、删除、登录和审核状态交互。
- 同步日期分隔、引用定位、复制、表情、图片、语音输入、成员列表和响应式底部输入面板。
- `/life/guestbook/` 同时作为页面地址和 Waline 数据频道；旧 `/guestbook/` 使用 301 跳转，避免形成两份留言数据。
- `commentConfig.type` 切换为 `waline`，文章评论与留言板共用同一套服务端配置。
- 未配置服务地址时继续显示明确错误，不向任何示例或第三方 Waline 实例发送数据。

## 配置流

1. 在 Vercel 部署 Waline 模板。
2. 在 Vercel 创建并连接 Neon 数据库。
3. 按 Waline 官方 PostgreSQL 初始化脚本建表。
4. 重新部署 Waline，访问 `/ui/register` 注册首位管理员。
5. 将 Waline 服务地址写入 GitHub Actions Secret `PUBLIC_WALINE_SERVER`。
6. GitHub Pages 构建时把该值注入 Astro，留言板和文章评论自动连接 Waline。

## 验收标准

- `commentConfig.type` 为 `waline`。
- 仓库中没有硬编码 Waline 服务地址、数据库 URL、Token 或密码。
- 未配置 `PUBLIC_WALINE_SERVER` 时构建仍成功，页面给出配置缺失提示。
- 配置有效服务地址后，留言列表可加载，游客可提交留言，站长可登录管理。
- 桌面端和移动端均使用沉浸式聊天布局，页面不再渲染旧说明卡片和普通评论卡。
- `pnpm check`、`pnpm build` 与 Biome CI 检查通过。
- `CLAUDE.md`、部署文档和更新日志同步说明本次变更。
