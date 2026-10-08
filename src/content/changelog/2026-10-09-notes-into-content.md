---
version: "v1.59.4"
date: 2026-10-09
time: "00:16"
type: improvement
description: 私人笔记并入 src/content（Obsidian 库根改为 content），构建与 git 均不受影响
---

## 笔记目录并入 content，库根改为 content

- 站长决定不再用 Syncthing 三目录方案，改为**把 Obsidian 库根直接设为 `src/content`**：
  `src/notes`（41 个文件 / 80KB）整体移动到 `src/content/notes`，这样非笔记文件（组件、配置、`.obsidian` 等）
  根本不在库里，省掉所有排除规则。
- **构建不受影响**：`src/content.config.ts` 里每个集合都写了明确的 `base`（各扫自己的子目录），
  `content/notes/**` 不属于任何集合 → 不会被当成内容条目。实测 `pnpm build` 通过（exit 0）。
- **git 排除已同步**：`.gitignore` 的 `src/notes` 改为 `src/content/notes`（私人笔记仍不进仓库，
  `git status` 里不出现任何 notes 文件）。
- 文档同步：`CLAUDE.md` §2 目录树、§5.17 同步范围、`docs/note-sync-setup.md` 的路径说明都已更新。

> 验证：pnpm build 通过；git status 中无 content/notes 条目；笔记结构完整（41 个文件）。
