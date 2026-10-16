---
title: 用 GitHub Gist 做博客数据存储
published: 2026-06-12
tags:
  - GitHub
  - Gist
  - 博客
description: 介绍如何利用 GitHub Gist 作为静态博客的轻量级数据存储方案。
---

## 什么是 GitHub Gist？

GitHub Gist 是 GitHub 提供的一个轻量级代码和文本分享服务。每个 Gist 本质上是一个 Git 仓库，可以包含一个或多个文件，支持版本控制、克隆和 Fork。

Gist 分为两种类型：

- **Public Gist**：公开可见，任何人都能搜索和访问
- **Secret Gist**：不会出现在搜索结果中，但知道 URL 的人仍可访问

> 注意：Secret Gist 并不是真正的"私有"，它只是不被搜索引擎索引。如果你需要真正的私有存储，请使用 Private 仓库。

Gist 非常适合存储小规模的结构化数据，比如 JSON 格式的配置、笔记、日志等。而且它完全免费，没有存储空间限制（单文件建议 1MB 以内），API 调用频率限制为每小时 5000 次（认证后）。

## 为什么选择 Gist 做存储？

作为一个静态博客（Astro），我没有传统的服务器和数据库。但我需要存储一些动态内容：

1. **说说**（类似朋友圈/微博）— 随时发布短文和图片
2. **笔记**（类似日记本）— 记录每日所思所想

这些内容需要频繁更新，但我不希望每次都修改代码仓库、重新部署。

对比了几种方案：

| 方案 | 成本 | 复杂度 | 适合场景 |
|------|------|--------|----------|
| 自建数据库 | 服务器费用 | 高 | 大型项目 |
| Supabase/Firebase | 免费 tier 有限 | 中 | 需要实时数据库 |
| Cloudflare KV | 免费 tier 够用 | 中 | 需要边缘存储 |
| **GitHub Gist** | **完全免费** | **低** | **小规模结构化数据** |

最终选择了 Gist，因为：

- 完全免费，无任何限制
- 与 GitHub 生态无缝集成
- 支持版本历史，天然备份
- API 简单易用
- 无需注册新服务

## 说说数据结构

每条说说存储为 JSON 数组中的一个对象：

```json
[
  {
    "id": "ext-1718000000",
    "content": "今天的天气真好 ☀️",
    "published": "2026-06-12T10:00:00Z",
    "images": ["https://example.com/photo.jpg"],
    "tags": ["日常", "开心"],
    "location": "河南-郑州",
    "pinned": false
  }
]
```

所有说说存在一个 Gist 的单个 JSON 文件中。

## 前端读取方式

前端页面通过客户端 JavaScript 从 Gist 读取数据：

```javascript
// 使用 Raw URL（不需要 API 认证，Secret Gist 也能访问）
fetch("https://gist.githubusercontent.com/raw/" + gistId)
  .then(r => r.json())
  .then(moments => {
    // 渲染说说列表
  });
```

关键点：使用 `gist.githubusercontent.com/raw/` 而不是 GitHub API，这样即使 Gist 是 Secret 的，前端也能匿名读取。

## 数据流架构

```
┌─────────────┐     ┌─────────────┐
│  Gist 内容   │────→│  前端页面    │
│  (JSON数据)  │     │  (展示数据)  │
└─────────────┘     └─────────────┘
```

## 注意事项

1. **Gist 默认公开**：创建时选 Secret Gist，但知道 URL 的人仍可访问
2. **单文件大小限制**：建议 1MB 以内
3. **API 频率限制**：5000 次/小时，个人博客完全够用
4. **图片不存 Gist**：图片使用外部 CDN，Gist 只存 Markdown 文本和图片 URL
5. **备份**：Gist 本质是 Git 仓库，有完整版本历史

## 总结

GitHub Gist 作为一个免费、可靠的轻量级存储服务，非常适合作为静态博客的动态内容存储。通过使用 Raw URL 读取数据，我们实现了：

- 零服务器成本
- 零额外依赖
- 简单的数据读取
- 完整的版本历史

如果你也有一个静态博客，想要存储一些动态内容，不妨试试这个方案。
