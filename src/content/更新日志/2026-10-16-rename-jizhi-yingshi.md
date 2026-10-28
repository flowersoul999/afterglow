---
version: "v1.61.2"
date: 2026-10-16
time: "20:20"
type: improvement
description: 地点→足迹、追番→影视目录改名，墓碑移入友链目录，并清掉上次汉化漏掉的 4 处英文路径
---

## 目录整理

- `src/content/地点` → **`足迹`**（`places` 集合 base 同步；条目 id 相对 base，URL `/life/places/` 不变）
- `src/content/追番` → **`影视`**（`bangumi` 集合 base 同步）
- `src/content/墓碑` → **`友链/墓碑`**（tombstones base 改为 `./src/content/友链/墓碑`）
  - ⚠️ 友链集合的 glob 必须加排除：`["**/*.md", "!墓碑/**"]`。否则 `友链/墓碑/` 下的文件会被
    `friends` 集合一并收进来 —— 墓碑只有 title/avatar/note，既会重复计数也可能触发 zod 校验失败
  - `src/pages/friends.astro` 的墓碑目录 fs 路径、`.pages.yml` 的 CMS path 同步
  - 三个友链脚本（截图/状态检测/回填字段）用的都是 `readdirSync` 非递归，子目录不影响
- `src/content/页面/projects.md` 删除：该文件无任何引用（`/projects/` 用的是 daohang 集合），
  同目录的 about.mdx / friends.md / guestbook.md 三篇都在用，保留

## 顺手修掉上次汉化漏掉的 4 处英文路径

这些是用逗号分段拼的路径（`os.path.join("src", "content", "bangumi"…)`），
上次按 `content/posts` 这类整串匹配时逃过了扫描，导致脚本早已写错目录：

- `scripts/下载影视/index.py`：`src/content/bangumi/anime` → `影视/anime`
- `scripts/下载音乐/fetch-lrc.py`、`batch-download.py`：`src/content/bangumi/music` → `影视/music`
- `scripts/添加导航/index.js`：`src/content/daohang` → `导航`

AstrBot BlogWriter 同步 16 处路径（足迹/影视）并重新打包 v1.0.59 后，站点侧与插件侧路径一致。

> 验证：`pnpm check` 0 error；`pnpm build` 通过（410 页）；三类告警均为 0；
> 友链 50 个文件 → 50 张卡片（墓碑未混入），墓碑 4 条正常渲染；BlogWriter 139 测试全绿。
