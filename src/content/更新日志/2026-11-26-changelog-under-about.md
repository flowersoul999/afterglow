---
version: "v6.31.9"
date: 2026-11-26
time: "09:10"
type: improvement
description: 导航栏「更新日志」从「开心」下拉移到「关于」下拉下
---

## 改了什么

「更新日志」原来挂在「开心」这一栏的下拉里，跟书架、影视与游戏、足迹、技能混在一起。现在把它挪到「关于」下拉的最下面 —— 关于 → 友链 → 赞助 → 更新日志。更新日志本质是站点的版本记录，和「关于」这类站点信息放一起更顺手；「开心」那一栏也就回到纯粹的个人记录。

## 涉及的地方

- 桌面导航：`src/config/navBarConfig.ts:96` 的「开心」子项列表删掉 `LinkPreset.Changelog`，`src/config/navBarConfig.ts:159` 的「关于」子项按 `siteConfig.pages.changelog` 开关追加。
- 移动端菜单：`src/components/layout/MobileMenuSheet.astro:114` 同步调整（这份是手写的静态列表，桌面导航改了这里必须跟着改，否则手机端两个入口会不一致）。
- 「开心」的默认跳转兜底：原来 `books`、`moviesGames` 都关掉时兜底到 `/changelog/`，现在改成永远的常驻项「足迹」（`/life/places/`）。

## 顺带说明

页脚（`src/config/footerConfig.ts:58`）和更新日志卡片里的页面徽章仍保留 `/changelog/` 入口，这次只动导航栏的分组位置，页面本身没变。
