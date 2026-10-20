---
version: "v1.64.3"
date: 2026-10-20
time: "23:20"
type: removal
description: 导航栏「关于」下拉里去掉 QQ 群入口
---

## 去掉导航栏的 QQ 群按钮

「关于」下拉菜单里的 **QQ群**（`https://qm.qq.com/q/FjkXxV9Hmo`）入口去掉了，桌面端和手机端一起去掉。

- `src/config/navBarConfig.ts`：删掉「关于」`children` 里的 QQ 群那一项
- `src/components/layout/MobileMenuSheet.astro`：手机端抽屉菜单是独立维护的一份导航数据，同样的项也删掉（只删桌面端会导致手机上看得到、电脑上看不到）

现在「关于」下面只剩 **关于 / 友链 / 赞助**（赞助受 `siteConfig.pages.sponsor` 控制）。

⚠️ 个人资料卡里的 **QQ 联系方式**（`profileConfig.ts` 的 `simple-icons:tencentqq`，点开是二维码）是另一回事，没动——那个是站长个人联系方式，不在导航栏里。要一起去掉的话再改 `src/config/profileConfig.ts`。
