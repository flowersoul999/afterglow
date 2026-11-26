---
version: "v6.33.4"
date: 2026-11-26
time: "15:16"
type: feature
description: 后台编辑说说也能配图了：选图 / 拖入 / 拖动排序 / 贴外链，提交时自动压成 webp 写进正文
---

## 后台编辑说说也能配图了

以前只有站内抽屉能发带图的说说，`/admin` 的表单只列发布时间、地点、标签、置顶，配图得自己手写 Markdown。现在正文下面多了一块图片区：

- **三种加法**：点「选择图片」、把文件直接拖进来、或粘贴图片地址（外链，或 `assets/diary/` 开头的仓库路径）
- **单条最多 9 张**：缩略图可拖动排序，右上角 × 删除，纯图不发文字也行
- **上传压在提交时**：浏览器里先压成长边 1920 的 webp 再进仓库，手机直出 4~6MB 的 jpg 不会直接塞进 git；中途取消编辑也不会在仓库留下没人引用的图
- **图片不占 frontmatter**：存的是正文末尾一行一个 `![](assets/diary/xxx.webp)`，和站内抽屉发的、Obsidian 里看到的完全一致
- **旧内容打开即所见**：正文里的图片行会拆出来变成缩略图，正文框里只剩文字，不用再对着 `![](...)` 改文章

## 实现要点

- `src/config/admin-collections.ts:41` 新增 `AdminBodyMedia` 类型，`moments` 用 `mediaInBody` 声明落点（`src/content/动态/assets/diary/`）、引用前缀与上限 —— 通用层只认「这个集合有没有正文图片区」，不认集合 id
- `src/components/admin/AdminEditor.svelte` 图片网格 + 提交前串行上传 + 正文拆分 / 拼装（正文框改绑 `bodyText`，保存时才拼回 `doc.body`）
- `src/utils/moment-media.ts` 新增 `joinBodyMedia` / `moveMediaItem` / `isRepoMediaUrl`，配 8 条单测（`pnpm test:media`）
- `src/utils/editor/image-upload.ts` 抽出 `uploadBodyImage()`，站内抽屉和后台共用同一套压缩逻辑（压缩参数只有一份，不会两边跑偏）

## 已知边界

- 刚上传的图片要等 1~3 分钟重新构建完才有缩略图，之前显示「重新构建后可见」的占位卡，不会裂图
- 删图只从正文移除，仓库里的图片文件保留（与站内抽屉一致，不会误删别处引用的图）
- 「加入待提交」队列存不了图片文件，带未上传图片时会挡住并提示直接提交
