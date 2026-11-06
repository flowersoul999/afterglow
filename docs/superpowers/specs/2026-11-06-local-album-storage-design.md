# 本地静态相册存储设计

## 目标

相册照片直接存放在博客仓库，由 GitHub Pages 与站点现有 CDN 分发，不再强依赖 CloudFlare ImgBed、R2、付款方式或浏览器可见 Token。

## 目录与内容契约

- 图片根目录：`public/assets/images/albums/`。
- 每个相册使用英文小写 kebab-case 子目录，例如 `travel/`、`daily-life/`。
- 相册 frontmatter 新增 `localFolder`，值是相对图片根目录的子路径。
- 图片文件使用英文小写、连字符命名，正式内容统一为 WebP；扫描器兼容 AVIF、GIF、JPEG、PNG 与 WebP，便于迁移。
- 禁止目录穿越、绝对路径和根目录外读取。

示例：

```yaml
---
title: 杭州旅行
date: 2026-11-06
localFolder: travel
---
```

对应目录：

```text
public/assets/images/albums/travel/
```

## 数据流

1. Astro 构建相册页时读取相册集合。
2. 服务端扫描 `localFolder`，递归收集图片并生成 `/assets/images/albums/...` URL。
3. frontmatter 的 `photos` 仍可补充显式图片。
4. 浏览器直接拿到本地照片列表，不再请求图床 API。
5. 当某个相册没有本地照片但仍配置 `imgbedFolder` 时，保留原图床加载作为回退。

## 页面行为

- 本地照片存在时，不要求 `PUBLIC_IMAGEBED_URL` 或 `PUBLIC_IMAGEBED_API_TOKEN`。
- 本地与显式 `photos` 合并去重；本地优先。
- 相册、搜索、日期、地点、灯箱与移动端手势行为保持不变。
- 所有相册均无照片时显示普通空状态，不展示图床配置错误。

## 图片处理

- `pnpm compress-images` 纳入 `public/assets/images/albums/`，递归转换 JPG/PNG 等格式为 WebP。
- 建议最长边不超过 1920 像素、质量约 80；首期沿用现有压缩器质量策略，不新增多尺寸衍生图，避免扩大改动面。
- 原始手机照片在成功转为 WebP 后删除，避免 Git 历史和 Pages 产物快速膨胀。

## 错误处理

- 配置不存在的本地目录：构建不中断，视为空相册并输出警告。
- 非图片文件和隐藏文件：忽略。
- 非法目录路径：立即抛错，阻止读取相册根目录之外的文件。
- 图床回退失败：只忽略对应远端相册，不影响本地照片展示。

## 验证

- Node 内置测试验证递归扫描、稳定排序、URL 编码、扩展名过滤和目录穿越防护。
- `pnpm check`、`pnpm type-check`、Biome、生产构建全绿。
- 浏览器验证无图空状态、本地照片墙、筛选和灯箱。
