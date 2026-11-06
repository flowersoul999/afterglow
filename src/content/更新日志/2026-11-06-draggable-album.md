---
version: "v6.18.1"
date: 2026-11-06
time: "22:34"
type: feature
description: 相册新增可拖动散落模式、照片墙切换与单张照片标签描述
---

## 相册新增可拖动散落模式

- 相册默认以散落照片桌呈现，照片可拖动排列，位置会保存在浏览器中。
- 保留照片墙模式，可在散落布局与瀑布流之间切换。
- 照片支持独立描述、标签和拍摄时间，灯箱中可查看并拖动描述便签。
- 从旧博客迁移 5 张照片，数据位于 `src/content/相册/old-jojo-gallery.json`。
- 相关页面与交互控制器分别位于 `src/components/pages/album/AlbumGallery.astro` 和 `src/utils/album-gallery-controller.ts`。
