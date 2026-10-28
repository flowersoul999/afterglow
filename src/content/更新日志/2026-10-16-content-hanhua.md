---
version: "v1.60.0"
date: 2026-10-16
time: "16:30"
type: improvement
description: content 集合目录全部汉化、动态按年/月归档、life 拆分为地点/笔记本
---

## 目录汉化与结构重组

- 13 个集合目录 git mv 为中文（文章/页面/动态/追番/相册/资源/友链/应用/墓碑/导航/账单/日程/更新日志）
- life 拆除：notebooks→笔记本（顶层）、places→地点（顶层，新注册 places 集合，删除 life 集合及其 4 处 isIn 过滤）
- 120 条动态按 published 归档进 动态/<年>/<月>/ 子文件夹；MomentCard/moments 图片 glob 改为递归
- 站点内 8 处硬编码路径同步（含 friends 的 fs 读取、notebooks 页面路径）
- 外部 75+73 处同步：.pages.yml 14 处、_frontmatter、友链截图工作流、scripts 12 个、note-organizer 技能、三个 Obsidian 插件源码与 tests、AstrBot BlogWriter 全量路径（BlogCreator 已弃用不改动，198 tests 全绿）
- 应用/账单 内容清空（站长确认），保留空集合目录与 .gitkeep
- URL 与分类逻辑不受影响（entry id 相对集合 base）

> 已知变化：动态 entry id 变化会使 /moments/#锚点 旧分享链接失效。
> 验证：pnpm build exit 0；BlogWriter pytest 198 passed；AstrBot 真机发送待站长验证。
