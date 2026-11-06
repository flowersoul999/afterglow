---
version: "v6.17.1"
date: 2026-11-06
type: improvement
description: 文章右侧目录同步参考站最新版，并修复切换文章后重复注册事件
---

## 文章目录同步与稳定性优化

- 宽屏文章页继续提供树形目录、自动折叠、全部展开、思维导图、阅读进度和纸飞机指示器。
- 保留赞助、分享、站点统计和相关文章切换，并适配本站更宽的正文区域与深浅色主题。
- 目录运行时改为跨 Swup 导航的单例，连续切换文章时不再重复注册初始化和分享监听器。
- 用户取消系统分享时不再意外复制链接；浏览器不支持系统分享时仍会自动复制当前文章地址。
- 相关实现：`src/components/layout/ArticleTocPanel.astro`、`src/utils/article-toc-panel-controller.ts`、`src/styles/components/article-toc-panel.css`。
