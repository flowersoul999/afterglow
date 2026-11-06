---
version: "v6.15.0"
date: 2026-11-06
time: "12:00"
type: feature
description: NapCat QQ 好友私聊可直接对话编辑说说并提交博客
---

## QQ 私聊直接写说说

- 用自己的 QQ 私聊 NapCat 机器人小号，发送普通文字即可开始说说草稿。
- 支持继续发送文字和图片，并用“预览”“重写：内容”“撤销上一条”编辑。
- 只有发送“发布”才会提交到 GitHub；随后由 GitHub Actions 构建和部署网站。
- QQ 群聊、QQ 官方机器人、未知来源消息不会自动创建草稿。
- 微信 ClawBot 和原有 `/动态` 等命令继续保留。

实现位置：`plug-in/AstrBot/astrbot_plugin_blog_writer/main.py`、`README.md`、`安装说明.md`。
