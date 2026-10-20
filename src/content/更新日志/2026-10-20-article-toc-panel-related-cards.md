---
version: "v1.65.0"
date: 2026-10-20
time: "23:30"
type: feature
description: 文章页右侧目录面板整体换成参考站实现，新增相关文章视图与站点统计卡
---

## 右侧目录面板换成参考站版本

站长要求 1:1 复刻参考博客 `my-blog` 的文章阅读页右侧组件（含动画、样式与性能表现），
面板由旧版「纯目录 + 思维导图」升级为：

- **目录 ↔ 相关文章双视图**：滚到许可协议卡底边之后，目录整体淡出、相关文章卡淡入；
  向上回滚带 24px 迟滞，两层同位叠放，只做可反向接续的透明度过渡
- **阅读位置指示器**：纸飞机沿虚线竖轨滑动（弹簧跟随 + 转向用更硬的第二套弹簧），
  竖轨随折叠动画逐帧重画
- **底部操作区**：打赏二维码气泡（取 `sponsorConfig` 里 enabled 且填了 qrCode 的项）+ 系统分享/复制链接
- **站点统计卡**：运行天数 / 最近更新 / 累计字数三句轮播，背景是首页 hero 图的模糊层
- **思维导图弹窗**：可缩放、可拖拽平移、可全屏，节点与分支线全部由控制器生成

## 文件改动

- 新增 `src/components/layout/ArticleTocPanel.astro`、`src/utils/article-toc-panel-controller.ts`（~2100 行）、`src/utils/article-toc-tree.ts`、`src/styles/components/article-toc-panel.css`
- 新增 `src/components/misc/RelatedPostCards.astro`、`src/utils/related-posts.ts`、`src/styles/components/related-post-cards.css`、`src/utils/cover-image.ts`、`src/types/cover-image.ts`
- `MainGridLayout` 用 `ArticleTocPanel` 替换 `SidebarTOC`，新增 `relatedCards` prop，页脚容器补 `data-site-footer` 标记
- `[...slug]` 一次性算好相关文章卡片并透传，底部 `RelatedPosts` 改为卡片形态（宽屏由面板接管、整体隐藏）
- 删除已停用的 `src/components/widget/SidebarTOC.astro`、`src/utils/article-toc.ts`、`src/styles/features/article-toc-panel.css`，`WidgetComponentType` 摘掉 `sidebarToc`

> 旧样式文件必须一起删：它和新面板共用 `.article-toc-panel*` 选择器，
> 留着会被打进同一页并**覆盖**新样式（表现为整块灰底卡片、工具栏内边距变大、
> 目录行距变松），和参考站对比时极易误判成"样式没抄对"。

## 按线上版对齐的两处细节

- 相关文章视图标题改用 `relatedPosts` 文案「相关文章」（原先是本站旧文案「相关阅读」）
- 工具栏 `padding-bottom` 0.25rem、目录区 `padding` 0.25rem 0，面板容器背景透明——
  目录区直接落在页面底色上，只有操作区和统计卡是独立的圆角卡片

## 相对参考站的三处适配

- 门槛 `96rem → 101rem`、`left` 基准 `28.25rem → 31.5rem`：本站正文卡宽 63rem（参考站 56.5rem）
- 参考站的 `--card-surface` / `--card-border` / `--article-surface-bg` / `--radius-large`（0.75rem）在本站缺定义，就地补在面板样式里，不动全局 token
- 不接 LQIP：参考站的渐变占位依赖 `scripts/generate-lqips.ts` 产出的 `lqips.json`，本站没有这套设施，`lqipStyle` 恒为空
- 相关文章的分类一律走 `getCategoryFromId(entry.id)`（本站 posts 集合没有 `category` frontmatter）
