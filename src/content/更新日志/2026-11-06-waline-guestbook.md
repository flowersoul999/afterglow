---
version: "v6.17.0"
date: 2026-11-06
time: "20:00"
type: feature
description: 评论与对话式留言统一接入 Waline，并补齐审核和部署配置
---

## 评论与留言统一使用 Waline

- 将旧博客的沉浸式对话留言板迁移到 `/life/guestbook/`，文章评论、留言板和浏览量统一连接同一个 Waline 服务。
- 支持日期分隔、引用回复、复制、编辑、删除、表情、图片、语音输入、成员列表和响应式底部输入面板。
- 旧 `/guestbook/` 永久跳转到新入口，Waline 数据频道同步统一为 `/life/guestbook/`。
- 留言板新增审核提示，游客提交后可在 Waline 后台审核再公开展示。
- 补充 Vercel + Neon 部署、管理员注册和 GitHub Actions Secret 配置步骤。
- 相关配置：`src/config/commentConfig.ts`、`src/config/guestbookConfig.ts`、`docs/deploy-github-pages.md`。
