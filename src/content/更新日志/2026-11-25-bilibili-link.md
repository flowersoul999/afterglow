---
version: "v6.31.4"
date: 2026-11-25
time: "23:59"
type: fix
description: 页脚和资料卡里的 B 站主页链接更新到新 UID，点进去不再是旧账号
---

## B 站主页链接换成新 UID

- 页脚两处 Bilibili 入口（桌面端图标 + 移动端文字链接）从旧 UID `1394731616` 换成 `1395949329`（`src/config/footerConfig.ts:18`、`src/config/footerConfig.ts:101`）。
- 个人资料卡里的 B 站图标同步更新，并去掉了已失效的 `spm_id_from` 旧参数（`src/config/profileConfig.ts:48`）。
