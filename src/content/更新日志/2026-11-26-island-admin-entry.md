---
version: "v6.31.8"
date: 2026-11-26
time: "08:58"
type: fix
description: 灵动岛个人面板补回站长入口，登录 / 进后台不再无处可点
---

## 后台入口回来了

- 桌面端导航换成灵动岛后，个人信息面板（头像 + 名字 + 社交 + 文章热力图）漏了站长入口 —— 登录按钮整个消失，站长在页面上找不到进后台的地方。现在补回来了。
- 位置：展开灵动岛 → 个人信息面板 → 底部图标行最右一枚，和 GitHub / B 站 / 邮箱那一排并排。
- 未登录时是一枚蓝色「登录」图标（悬停有「站长登录」提示），点开仍是原来的 GitHub 授权弹窗。
- 已登录时换成「后台」图标，右上角一颗绿点表示处于编辑态，点一下直达 `/admin`；想退出登录还是走原来资料卡的入口。
- 手机端不受影响，入口仍在导航菜单底部（`EditorMobileMenuEntry.svelte`）。
- 代码：新增 `src/components/editor/IslandAdminEntry.svelte`，挂在 `src/components/layout/DynamicIsland.astro` 的 `.di-profile__socials` 行尾；样式 `src/styles/layout/dynamic-island.css` 的 `.di-profile__admin`。
