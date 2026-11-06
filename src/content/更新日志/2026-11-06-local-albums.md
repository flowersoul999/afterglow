---
version: "v6.18.0"
date: 2026-11-06
time: "20:22"
type: feature
description: 相册改为优先读取仓库本地图片，不再依赖图床和付费存储
---

## 相册支持本地静态照片

- 照片可直接放入 `public/assets/images/albums/<相册目录>/`，随 GitHub Pages 一起发布。
- 相册内容使用 `localFolder` 关联目录，构建时自动递归扫描，不需要逐张维护 URL。
- 新增 `pnpm compress-albums:dry` 和 `pnpm compress-albums`，用于预检并批量转换 WebP。
- 原有 `photos` 与 CloudFlare ImgBed 保留为可选补充和回退，未配置图床不会再显示错误。
- 本地相册操作说明见 `docs/manage-local-albums.md`，核心扫描逻辑见 `src/utils/local-album.ts`。
