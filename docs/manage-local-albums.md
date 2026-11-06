# 本地相册使用手册

相册照片直接保存在博客仓库，由 GitHub Pages 和现有 CDN 分发，不需要图床地址、R2 或 API Token。

## 新建相册

先在 `src/content/相册/` 新建 Markdown，例如：

```text
src/content/相册/2026-hangzhou.md
```

内容：

```yaml
---
title: 杭州旅行
subtitle: 秋天的西湖与街巷
date: 2026-11-06
location: 浙江杭州
tags:
  - 旅行
  - 城市
draft: false
localFolder: hangzhou-2026
---
```

`localFolder` 必须是相对 `public/assets/images/albums/` 的目录，使用英文小写 kebab-case。

## 放入照片

创建对应目录：

```text
public/assets/images/albums/hangzhou-2026/
```

把照片复制进去，文件名使用英文小写和连字符：

```text
west-lake-01.jpg
west-lake-02.jpg
night-street-01.png
```

禁止使用空格、括号、中文文件名或拼音式目录。照片允许放进更深的子目录，页面会递归扫描。

## 转换为 WebP

先预览：

```bash
pnpm compress-albums:dry
```

确认后执行：

```bash
pnpm compress-albums
```

该命令递归处理 `public/assets/images/albums/`，把 JPG、JPEG、PNG、BMP、TIFF 转为质量 80 的 WebP，并删除成功转换的源文件。已经是 WebP 的照片也会重新压缩。

提交前建议确认单张图片不超过 1 MB；博客照片推荐最长边 1600～1920 像素。当前压缩脚本只调整格式和质量，不自动缩放尺寸，超大照片应先在图片编辑工具中缩小。

## 本地预览

```bash
pnpm dev
```

访问：

```text
http://localhost:4321/album/
```

检查：

- 照片墙是否出现新照片。
- 相册筛选是否正确。
- 搜索是否能匹配相册名、地点、标签和文件名。
- 点击照片后灯箱、前后切换和移动端滑动是否正常。

## 加图和删图

加图：把新照片放进原目录，重新运行 `pnpm compress-albums`。

删图：直接删除对应 WebP 文件。构建时会重新扫描，不需要维护照片列表。

排序：同一个相册内按文件路径稳定排序。需要固定顺序时使用数字前缀：

```text
01-west-lake.webp
02-night-street.webp
03-railway-station.webp
```

## 图床兼容

`imgbedFolder` 字段仍然保留，但只作为回退：

- `localFolder` 中存在照片时，只展示本地照片和 `photos` 补充列表。
- 本地照片为空、且配置了图床地址与只读 Token 时，才读取 `imgbedFolder`。
- 不再使用图床时，可以不配置 `PUBLIC_IMAGEBED_URL` 和 `PUBLIC_IMAGEBED_API_TOKEN`。

## 发布

完成本地预览后提交到博客主仓并推送 `main`。GitHub Actions 会重新构建，照片随 GitHub Pages 一起发布。

不要在 `src/content/` 下创建 `.gitignore`；该目录是嵌套仓库，规则只能按 `CLAUDE.md` 第 23 节处理。
