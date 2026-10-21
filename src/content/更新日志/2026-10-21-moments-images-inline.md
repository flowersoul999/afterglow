---
version: "v1.64.8"
date: 2026-10-21
time: "14:24"
type: improvement
description: 动态图片改写到正文里，现在在 Obsidian 打开动态 md 也能直接看到图
---

## 动态图片从属性搬到正文

**之前**：动态的图片写在 frontmatter 的 `images:` 数组里，md 正文只有一行文字。这样在 Obsidian 里打开文件时，属性面板只躺着一串 URL，正文区域什么都看不到。

**现在**：图片以标准 Markdown 语法写进正文，一行一张：

```markdown
---
published: 2026-10-20 12:06:46
tags:
  - 日常
---

用了半年了才知道…

![](https://img.tsh520.cn/file/blog/moments/xxx.jpg)
```

- **网页端外观完全没变**：九宫格（1/2/4 张两列、其余三列、最多 9 张 +N）、视频区、Fancybox 灯箱照旧。渲染时会把正文里的图片抽出来统一排九宫格，所以图片写在正文哪个位置都可以。
- **存量 66 条动态已一次性迁移**（共 156 张图 / 1 个视频），逐条比对过迁移前后的正文与图片顺序，完全一致。迁移脚本在 `scripts/动态图片迁入正文/index.mjs`，支持 `--dry-run` 与重复执行。
- **视频也迁进正文**：写了 `.mp4` 等扩展名的会被识别成视频区，不进九宫格。
- **新旧写法都认**：frontmatter 的 `images` 字段继续兼容（迁移期），两种来源会合并去重；等彻底不用了再下线——后台 PagesCMS 里那个字段现已标注「已废弃」。
- 侧栏「最近更新」的动态缩略图、归档页的动态标题、动态页搜索框，都改成从正文取图 / 取纯文本，不会再出现 `https://...` 混进摘要里。

**相关文件**：`src/utils/moment-media.ts`（提取与清洗）、`src/plugins/remark-strip-moment-images.mjs`（避免 `<Content />` 把图重复渲染一遍）、`src/components/moments/MomentCard.astro:85`、AstrBot 插件 `build_moment_md`（新发的动态直接写正文格式）。

**约定**：动态正文里的图片请写**空 alt**（`![](url)`）。写了 alt 会被 `rehype-figure` 包成 figure + 图注，卡片里就多出一行字。
