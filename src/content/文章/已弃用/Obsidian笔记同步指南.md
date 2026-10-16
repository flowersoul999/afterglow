---
title: Obsidian 笔记同步指南
published: 2026-04-21
description: 如何使用 Obsidian 笔记同步工具将笔记同步到博客
tags:
  - 使用文档
descriptionSource: manual
---


本文档介绍如何使用博客内置的同步工具，将 Obsidian 笔记库中的内容同步到博客的 `content` 文件夹。

## 概述

同步工具是一个 Node.js 脚本，位于 `scripts/sync.js`。它可以：

- 将 Obsidian 笔记库中的笔记同步到博客的 `content` 文件夹
- 支持多种同步策略（跳过、增量、强制覆盖）
- 自动处理笔记中的图片资源
- 支持按类型选择性同步
- 交互式菜单操作，简单易用

## 工作原理

```
Obsidian 笔记库                          博客项目
┌─────────────────────┐                ┌─────────────────────┐
│ posts/              │                │ src/content/        │
│   └── 技术笔记/      │  ── 同步 ──>   │   └── posts/        │
│       └── Java.md   │                │       └── 技术笔记/ │
│ moments/            │                │           └── Java.md
│   └── 2026-04-21.md │               │ moments/            │
│ bangumi/            │                │   └── 2026-04-21.md │
│   └── anime/        │                │ bangumi/            │
│       └── 巨人.md   │                │   └── anime/        │
│       └── 巨人.md   │                    └── 巨人.md        │
│ life/               │                │ life/               │
│   └── health/       │                │   └── health/       │
│       └── workout/  │                │       └── workout/  │
│           └── ...   │                │           └── ...   │
└─────────────────────┘                └─────────────────────┘
```

## 目录结构

同步脚本位于 `scripts` 目录下：

```
scripts/
├── sync.js              # 同步主脚本
├── sync.config.js       # 配置文件（包含你的实际配置）
├── sync.config.example.js  # 配置模板（用于参考）
├── sync.sh             # Linux/macOS Shell 脚本
├── sync.ps1            # Windows PowerShell 脚本
```

## 快速开始

### 1. 配置 Obsidian 路径

编辑 `scripts/sync.config.js` 文件，修改 `obsidianVaultPath` 为你的 Obsidian 笔记库路径：

```javascript
export default {
  // Obsidian 笔记库路径（必须修改！）
  // Windows 示例: 'E:/Obsidian/Vault'
  // macOS/Linux 示例: '/Users/username/Obsidian/Vault'
  obsidianVaultPath: 'B:/GitHub/dumplingandcake_warehouse/网络笔记',

  // 博客项目 content 文件夹路径（通常不需要修改）
  projectContentPath: path.resolve(__dirname, '../src/content'),
  // ...
};
```

### 2. 运行同步

```bash
# 进入 scripts 目录
cd scripts

# 运行同步脚本
node sync.js
```

运行后会显示交互式菜单，引导你完成同步操作。

### 3. 交互式菜单

```
🚀 Obsidian 笔记同步工具

==================================================

请选择同步策略:

  1. 跳过已存在 - 只复制新文件，已存在的跳过
  2. 增量同步 - 源文件较新时才更新
  3. 强制覆盖 - 覆盖所有文件

请输入选项 (1-3):
```

选择策略后，再选择要同步的内容类型：

```
请选择要同步的内容类型:

  1. 同步文章
  2. 同步动态
  3. 同步记录
  4. 同步生活
  5. 同步相册
  6. 同步弹幕
  7. 同步导航
  8. 同步全部
  9. 返回上级
```

---

## 命令行参数

除了交互模式，还支持命令行参数直接执行：

### 基本用法

```bash
# 交互模式（默认 skip 策略）
node sync.js

# 增量同步
node sync.js --strategy incremental

# 强制同步
node sync.js --force

# 仅同步文章
node sync.js --type 文章

# 仅同步动态
node sync.js --type 动态

# 同步多个类型
node sync.js --type 文章 --type 动态

# 同步全部
node sync.js --all
```

### 参数说明

| 参数 | 说明 | 示例 |
|------|------|------|
| `-s, --strategy <策略>` | 同步策略 | `skip` / `incremental` / `force` |
| `-t, --type <类型>` | 指定同步类型 | `文章` / `动态` / `记录` 等 |
| `-a, --all` | 同步全部类型 | - |
| `-f, --force` | 强制覆盖 | 等同于 `--strategy force` |
| `-h, --help` | 显示帮助 | - |

### 同步类型

支持的类型对应配置中的 `type` 字段：

| 类型 | 说明 | Obsidian 文件夹 |
|------|------|----------------|
| `文章` | 博客文章 | `posts/` |
| `动态` | 日常动态 | `moments/` |
| `记录` | 番组记录 | `bangumi/` |
| `生活` | 生活记录 | `life/` |
| `相册` | 相册 | `album/` |
| `弹幕` | 弹幕留言 | `danmu/` |
| `导航` | 网站导航 | `daohang/` |

---

## 同步策略

### skip（默认）

跳过已存在的文件，只复制新文件。

```
适用场景：
- 首次同步
- 只添加新内容，不想修改已有内容
```

### incremental（增量同步）

仅当源文件较新时才更新目标文件。

```
适用场景：
- 在多台设备上编辑，需要合并更改
- 希望自动保持同步状态
```

### force（强制覆盖）

无条件覆盖所有文件。

```
适用场景：
- 想用 Obsidian 版本完全替换博客版本
- 调试时需要重置同步状态
```

---

## 配置文件详解

`sync.config.js` 完整配置说明：

```javascript
export default {
  // ========================================
  // 主要配置
  // ========================================

  // Obsidian 笔记库路径
  obsidianVaultPath: 'B:/GitHub/dumplingandcake_warehouse/网络笔记',

  // 博客项目 content 路径（通常不需要修改）
  projectContentPath: path.resolve(__dirname, '../src/content'),

  // 是否输出详细信息
  verbose: true,

  // 默认同步策略
  syncStrategy: 'skip',

  // ========================================
  // 映射规则
  // ========================================
  mappings: [
    {
      type: '文章',
      obsidianFolder: 'posts',
      targetFolder: 'posts',
      datePrefix: false,        // 是否添加日期前缀
    },
    {
      type: '动态',
      obsidianFolder: 'moments',
      targetFolder: 'moments',
      datePrefix: true,         // moments 需要日期前缀
      dateField: 'published',   // frontmatter 中的日期字段
      dateFormat: 'YYYY-MM-DD',
    },
    // ... 其他类型
  ],
};
```

### mapping 配置说明

| 字段 | 说明 |
|------|------|
| `type` | 类型名称（用于命令行识别） |
| `obsidianFolder` | Obsidian 中对应的文件夹名称 |
| `targetFolder` | 博客 content 中对应的文件夹 |
| `datePrefix` | 是否自动添加日期前缀 |
| `dateField` | frontmatter 中的日期字段名 |
| `dateFormat` | 日期格式 |

---

## 图片资源处理

同步工具会自动处理笔记中引用的图片资源：

1. **同级 assets 文件夹**：如果笔记所在目录有 `assets` 文件夹，会自动同步到博客对应的 `assets` 目录
2. **保持相对路径**：笔记中的图片引用路径保持不变
3. **支持多种格式**：jpg、png、gif、webp 等

```
Obsidian 结构：
posts/
└── 我的文章/
    ├── 我的文章.md      ← 笔记正文
    └── assets/          ← 笔记图片
        ├── img1.png
        └── img2.jpg

同步后博客结构：
src/content/posts/
└── 我的文章/
    ├── 我的文章.md
    └── assets/
        ├── img1.png
        └── img2.jpg
```

---

## 使用场景

### 场景 1：日常写作

1. 在 Obsidian 中写文章
2. 完成编辑后运行 `node sync.js`
3. 选择「同步文章」或「同步全部」
4. 在博客项目中 `npm run dev` 预览效果

### 场景 2：多设备同步

1. 在公司电脑上编辑笔记
2. 通过 Git 同步 Obsidian vault 到云端
3. 在家里电脑拉取最新笔记
4. 运行同步脚本更新博客

### 场景 3：批量更新

```bash
# 批量同步多个类型
node sync.js --type 文章 --type 动态

# 强制同步全部（用于重置）
node sync.js --all --force
```

---

## 常见问题

### Q: 同步后图片不显示？

检查以下几点：
1. 图片是否在笔记同级的 `assets` 文件夹中
2. 笔记中的图片引用路径是否正确（相对于笔记文件）
3. 图片格式是否被博客支持

### Q: 如何排除某些文件不同步？

目前脚本会自动同步文件夹中的所有文件。如需排除，可以：
1. 将不需要同步的文件放在 Obsidian 的 `.obsidian` 文件夹（会被自动跳过）
2. 或在同步后手动删除不需要的文件

### Q: 同步冲突怎么办？

如果同一文件在多处被修改，建议：
1. 使用增量同步策略
2. 先备份重要文件
3. 手动解决冲突后重新同步

### Q: 如何修改同步的文件夹映射？

编辑 `sync.config.js` 中的 `mappings` 数组，添加或修改映射规则。

### Q: 提示 "Obsidian vault 路径不存在"？

检查 `sync.config.js` 中的 `obsidianVaultPath` 配置：
- Windows 路径使用正斜杠：`E:/Obsidian/Vault`
- 路径是否存在且正确

---

## 平台脚本

除了直接运行 Node 脚本，还提供了各平台的快捷脚本：

### Windows (PowerShell)

```powershell
# 运行同步
.\sync.ps1

# 带参数运行
.\sync.ps1 -Type "文章" -Strategy "incremental"
```

### Linux/macOS (Shell)

```bash
# 添加执行权限
chmod +x sync.sh

# 运行同步
./sync.sh

# 带参数运行
./sync.sh --type 文章 --strategy incremental
```

---

## 与坚果云等云服务配合

可以将 Obsidian vault 同步到坚果云等云存储服务，实现多设备同步：

```
┌─────────────────────────────────────────────────────────┐
│                     坚果云同步                           │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐              │
│  │   PC    │◄──►│  云端   │◄──►│   手机   │              │
│  └────┬────┘    └─────────┘    └─────────┘              │
│       │                                                   │
│       │  sync.js                                          │
│       ▼                                                   │
│  ┌─────────────────────────────────────┐                 │
│  │           Astro 博客                 │                 │
│  │        src/content/                 │                 │
│  └─────────────────────────────────────┘                 │
└─────────────────────────────────────────────────────────┘
```

### 推荐工作流程

1. **在 Obsidian 中写作**：享受 Obsidian 的编辑体验
2. **云端同步笔记**：通过坚果云等保持多设备同步
3. **运行同步脚本**：将笔记同步到博客 content
4. **部署博客**：发布到 GitHub Pages 或其他平台

---

## 更新日志

- **2026-04-21**: 初始版本

---

*如有问题或建议，欢迎反馈！*
