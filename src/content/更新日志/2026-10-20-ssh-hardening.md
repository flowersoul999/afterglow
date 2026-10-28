---
version: "v1.61.3"
date: 2026-10-20
time: "20:55"
type: improvement
description: 新增服务器 SSH 加固操作手册，站点功能无变化
---

## 文档

- 新增 `docs/ssh-hardening.md`：把「公网 22 端口 + 密码登录」这个最容易被爆破的入口收起来的完整操作手册
  - 分五个阶段：保命检查（云控制台 VNC 可用性）→ 安装公钥 → **新窗口**验证密钥登录 →
    fail2ban（零风险止损）→ 关闭密码登录（`PasswordAuthentication no` + `PermitRootLogin prohibit-password`）
  - 每阶段都有校验命令、期望输出、回滚方法；改 sshd 一律 `sshd -t` 校验后再 `reload`（不是 `restart`）
  - 特意写清 Ubuntu 云镜像的坑：`/etc/ssh/sshd_config.d/*.conf` 会覆盖主配置，
    必须用 `sshd -T` 看**有效值**而不是只看文件内容
- 改动只涉及 sshd 与安全组里的 22 端口规则，**不碰 80/443**，已部署的 nginx（图床、朗读服务）、
  AstrBot、同步容器均不受影响
