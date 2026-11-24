---
version: "v6.25.0"
date: 2026-11-24
time: "23:58"
type: feature
description: 相册页的管理菜单多了「新建相册」：起个名字、挑个日期、顺手放几张图，就有一本新相册；照片墙照旧显示全部照片
---

## 相册页可以自己建相册了

以前想加一本相册，只有一条路：去仓库里手写一个 `src/content/相册/<id>.json`。
现在登录之后点「管理 → 新建相册」，填完就是一本新相册，手机上也行。

### 只加了一个入口，照片墙没动

- 顶部筛选条、散落 / 照片墙双视图、拖拽摆放、搜索、灯箱**全部原样保留** ——
  照片墙仍然是「所有相册的所有照片铺在一起」。
- 新建的相册会作为新的相册名出现在筛选条第二行；点它，照片墙就只剩这本的照片。
- 单相册独立页面仍然不存在（2026-09-30 起就删掉了），相册之间靠筛选条切换。

### 新建的时候能填什么

- **相册名**（必填）、**日期**（决定照片墙上的排序）、**照片**（可选，建的同时就能塞进第一批）。
- **副标题 / 地点 / 标签**都可空，和现有相册的字段一一对应。
- **图片目录**是进阶项，默认已经生成了一串不会撞名的 `album-xxxxxx`：
  照片会写到 `public/assets/images/albums/<它>/`，它同时是文件名
  （`src/content/相册/<它>.json`）。填中文会被清成空并提示 —— 这个值要当 URL 用，
  不做拼音猜测，猜出来的 slug 比报错更难维护。
- 保存前先探一次同名文件，撞了会明确报「已经存在，换个标识」，不会静默覆盖别人的相册。

### 顺手把两段表单抽成了 snippet

照片区和标签区在「新建相册」和「新增照片」两种模式下完全一样，抽成
`{#snippet photoField(idx)}` / `{#snippet tagField(idx)}`，各自传自己的序号，
省得以后改一处漏一处。

### 底层

- `album-serializer.ts` 新增 `sanitizeAlbumId` / `newAlbumFolderId` / `createAlbumDraft`
  三个纯函数，单测从 8 条加到 13 条。
- `album-ui.ts` 的 `AlbumDrawerMode` 从 `create | edit` 扩到 `create | edit | new`；
  相册页派发 `album:new` 自定义事件，`EditorRoot` 收到后调 `albumUi.openNewAlbum()`。
- 新建走 `writeFile` 不带 `sha` 的那条路径（Worker 的 `PUT /api/github/file` 缺 `sha`
  就按新建处理，带了才会更新已有文件）。
- 建完 1~3 分钟才可见：push 之后还要等 GitHub Actions 重新构建。
