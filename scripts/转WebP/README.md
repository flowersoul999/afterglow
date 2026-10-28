# 图片批量转 WebP 脚本

## 功能

- 将 jpg / png / jpeg / avif / gif / bmp / tiff 转为 WebP 格式
- 自动压缩至适合网站的大小（最大宽度 1920px，质量 80%）
- 重命名为 `1.webp`、`2.webp`、`3.webp` …（从已有最大编号继续）
- 已符合规范的 WebP 文件（≤500KB）**跳过不处理，保留原名**

## 用法

```bash
# 在项目根目录执行
node scripts/convert-to-webp/convert-to-webp.mjs <图片文件夹路径>

# 示例
node scripts/convert-to-webp/convert-to-webp.mjs scripts/convert-to-webp/图片
node scripts/convert-to-webp/convert-to-webp.mjs src/assets/images/desktop-bg
```

## 转换规则

| 原始格式 | 处理方式 |
|---|---|
| jpg / png / jpeg / avif / gif / bmp / tiff | 转为 WebP，重命名为数字 |
| webp（≤500KB） | 跳过，保留原名 |
| webp（>500KB） | 重新压缩，重命名为数字 |

## 转换参数

| 参数 | 值 |
|---|---|
| 最大宽度 | 1920px（等比缩放，不放大） |
| 质量 | 80%（1-100） |
| 格式 | WebP |
| 大小阈值 | 500KB（超过会重新压缩） |

## 添加新图片

直接把图片丢进文件夹，重新跑脚本，脚本会自动从已有编号后面继续编号。

```bash
node scripts/convert-to-webp/convert-to-webp.mjs scripts/convert-to-webp/图片
```

## 示例输出

```
📁 找到 5 张图片

⏭️  cover.webp (234KB) — 已符合规范，保留
✅  photo.jpg → 1.webp  (1.2MB → 189KB, -84%)
✅  avatar.png → 2.webp  (856KB → 96KB, -89%)
✅  banner.avif → 3.webp  (412KB → 178KB, -57%)
✅  old.gif → 4.webp  (3.1MB → 245KB, -92%)

📊 完成！
   保留原文件: 1 个
   转换为 WebP: 4 个
   共计: 5 个
```