---
version: "v6.13.0"
date: 2026-11-05
type: feature
description: 微信 ClawBot 私聊可直接对话编辑说说草稿，确认后提交部署
---

## 微信里直接写说说

- 在微信 ClawBot 一对一私聊中发送普通文字即可开始说说草稿，后续可继续发送文字和图片。
- 支持“预览”“重写：内容”“撤销上一条”；只有发送“发布”才会提交到 GitHub。
- 群聊、其他平台及无法明确识别为微信私聊的消息不会自动创建草稿。
- 提交后由 GitHub Actions 构建并部署到 GitHub Pages，构建完成后网站更新。
- 旧的 `/动态`、`/发布` 等命令继续可用。

实现位置：`plug-in/AstrBot/astrbot_plugin_blog_writer/main.py`、`README.md`。
