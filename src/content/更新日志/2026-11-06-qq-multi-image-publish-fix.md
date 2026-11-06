---
version: "v6.15.1"
date: 2026-11-06
time: "17:00"
type: fix
description: 修复 QQ 对话一次发布多张图片时 GitHub 返回 HTTP 422
---

## QQ 多图发布修复

- 一次说说中的多张图片现在会合并为一个 GitHub 提交，不再分别争抢更新 `main` 分支。
- 修复第一张图片可能成功、后续图片因非快进更新返回 HTTP 422，导致整条说说中止的问题。
- 未配置图床时仍可直接把图片写入博客仓库，发布操作和原来一致。

实现位置：`plug-in/AstrBot/astrbot_plugin_blog_writer/main.py`、`tests/test_smoke.py`。
