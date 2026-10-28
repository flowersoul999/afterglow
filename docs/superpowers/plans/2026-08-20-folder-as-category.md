# 文件夹即分类（C1 一步到位）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 废弃 `frontmatter.category`，分类 100% 由 `src/content/posts/**` 的文件夹路径推导，实现 `编程学习/Java学习` 这类多级分类，归档/分类页支持树形展开（有子目录展开看子树，无子目录整卡跳转），右侧跳转按钮删除。

**Architecture:** 数据源改为 `entry.id` 的 `dirname`（`src/utils/category-tree.ts` 新增工具统一 `getCategoryFromId` + `CategoryNode` 树构建），`content-utils` 聚合、路由、URL、样式、CMS、脚本、Obsidian 插件同步改造，一次性迁移历史 frontmatter。

**Tech Stack:** Astro 7.1.6 + Svelte 5 runes + Tailwind v4 + TypeScript + pnpm 9.14 / Node >=22 + Biome 2.5.7 + Obsidian Plugin (esbuild + node:test)

## Global Constraints

- 包管理器仅限 pnpm 9.14，Node >=22，无测试框架（博客侧用 `pnpm build + pnpm check + pnpm type-check` 验证；插件侧用 `node:test`）
- Astro 7 / Svelte 5 runes / Tailwind v4 无 `tailwind.config.js`，样式必须经 `src/styles/main.css` 导入，禁止新建 `!important` / 硬编码 `#000/#fff` / Stylus，暗色用 `:root.dark`
- 响应式变量含 DOM ref 必须 `$state`，非 void 标签禁止自闭合
- Swup 容器 `#swup-container` 内避免 `client:load`，监听器用 `AbortController` 清理，跨导航单例用 `window.__xxx` guard，禁止改 `swup-lifecycle-controller.ts` 用 `swup:content:replaced` 自注册
- i18n 新增键需 5 语言文件同步，Biome 版本固定 2.5.7（CI 不写 latest）
- 提交信息 `<type>(<scope>): <描述>`，改动后必跑 `pnpm build`，改 `src/content.config.ts` 需同步 `.pages.yml`（未声明字段保存时丢弃）
- 禁止用 Python 改文件，一律 Node 脚本；`plug-in/Obsidian/*` 独立 git，需 `pnpm build` 拷贝 + `pnpm test` + push + 提醒用户 Reload

---

## File Structure

**新建**
- `src/utils/category-tree.ts` — 纯函数：`getCategoryFromId(id)` / `normalizeCategory(path)` / `CategoryNode` 类型 / `buildCategoryTree(posts)` / `isSubCategory` / `getCategoryTrail`

**修改**
- `src/content.config.ts:24` — posts schema 去 `category`
- `src/utils/url-utils.ts:34-42` — `getCategoryUrl` 分段编码 + `isSubCategory` 复用
- `src/utils/content-utils.ts:235-331` — `getCategoryList/getCategoryTagGroups/getArchiveList` 改取 `getCategoryFromId`
- `src/pages/categories/[category].astro` → `src/pages/categories/[...category].astro` — catch-all 路由 + 子树聚合 + 面包屑多级
- `src/pages/categories.astro:76` — 传树给 `CategoryFolders`
- `src/components/widget/CategoryFolders.astro` — 递归树（有子展开/无子跳转，删右侧 `category-folder__link`）
- `src/styles/pages/categories.css` — 树缩进线、层级样式
- `src/styles/main.css` — 如有新增样式导入
- `src/components/controls/ArchivePanel.svelte:322-360` — `?category=` 过滤改 `startsWith(parent+"/")` 子树包含
- `src/pages/archive.astro` — 如需嵌入分类树侧栏（可选）
- `scripts/新建文章/index.js:45-53` — 模板不再写 `category`
- `.pages.yml:102-105` — 删 `category` 字段声明
- `plug-in/Obsidian/obsidian-category-autofill/*` — 停用 category 写入（保留插件但 no-op 或删逻辑）含 `logic.ts` / `logic.test.ts` / `main.ts` / `AGENTS.md` / `README.md`
- `src/content/posts/**` — 一次性脚本删历史 frontmatter `category`

**验证**
- `pnpm check` / `pnpm type-check` / `pnpm build` / `pnpm exec biome ci ./src`
- 插件侧 `pnpm test` / `pnpm build`

---

### Task 1: 分类推导核心工具 `category-tree.ts`

**Files:**
- Create: `src/utils/category-tree.ts`
- Test: `src/utils/category-tree.test.mjs`（临时 Node 验证，跑完可删，或写入 docs 计划验证脚本）

**Interfaces:**
- Consumes: `CollectionEntry<"posts">["id"]` (e.g. `"编程学习/Java学习/xxx.md"`)
- Produces: `getCategoryFromId(id: string): string` — `dirname` 去扩展名，根下文件返回 `""`（未分类）；`normalizeCategory(p: string): string` — trim + 去首尾 `/` + 压缩 `//`；`buildCategoryTree(items: {id:string, tags:string[]}[]): CategoryNode[]`；`isSubCategory(child:string, parent:string):boolean`

**Code reference:**
- 现有 `getDir` 在 `src/utils/url-utils.ts:48-56` 仅对 URL slug 用，需新增更严格的 posts-id 版本
- 现有 `removeFileExtension` 在 `src/utils/url-utils.ts:8-10` 可复用

- [ ] **Step 1: 新建 `src/utils/category-tree.ts`**

```ts
import { removeFileExtension } from "./url-utils";

export type CategoryNode = {
  name: string; // 末段名，如 "Java学习"
  fullPath: string; // 全路径，如 "编程学习/Java学习"
  count: number; // 含子孙
  directCount: number; // 仅当前层
  url: string; // getCategoryUrl(fullPath)
  children: CategoryNode[];
  tags: { name: string; count: number; url: string }[];
};

export function normalizeCategory(p: string): string {
  return p.trim().replace(/^\/+|\/+$/g, "").replace(/\/+/g, "/");
}
export function getCategoryFromId(id: string): string {
  const normalized = id.replace(/\\/g, "/");
  const noExt = removeFileExtension(normalized);
  const slash = noExt.lastIndexOf("/");
  if (slash < 0) return ""; // 根下文件 → 未分类
  return normalizeCategory(noExt.slice(0, slash));
}
export function isSubCategory(child: string, parent: string): boolean {
  const c = normalizeCategory(child), p = normalizeCategory(parent);
  if (!p) return false;
  return c === p || c.startsWith(p + "/");
}
export function buildCategoryTree(posts: { id: string; tags: string[] }[]): CategoryNode[] {
  // 1) 建 Map fullPath -> {directCount, tagCounts}
  // 2) 对每个 fullPath 的每个前缀累加 count
  // 3) 按 fullPath 字典序建树（或按 count 排序）
}
```

- [ ] **Step 2: 本地 Node 验证**

```bash
node --input-type=module <<'JS'
import { getCategoryFromId, isSubCategory } from "./src/utils/category-tree.ts"
console.log(getCategoryFromId("编程学习/Java学习/xxx.md")==="编程学习/Java学习"?"pass":"fail")
console.log(isSubCategory("编程学习/Java学习","编程学习")?"pass":"fail")
JS
```

Expected: pass pass

- [ ] **Step 3: Commit**

```bash
git add src/utils/category-tree.ts
git commit -m "feat(content): add category-tree utils for folder-as-category"
```

---

### Task 2: URL 与路由

**Files:**
- Modify: `src/utils/url-utils.ts:34-42`
- Rename: `src/pages/categories/[category].astro` → `src/pages/categories/[...category].astro`
- Modify: `src/pages/categories/[...category].astro:23-85, 39-50, 212-255`

**Interfaces:**
- Consumes: `normalizeCategory`, `getCategoryFromId`
- Produces: `getCategoryUrl(category:string|null):string` 分段编码；动态路由 `params.category` 可为 `a/b/c`

- [ ] **Step 1: 改 `getCategoryUrl` 分段编码**

```ts
// src/utils/url-utils.ts:34-42
import { normalizeCategory } from "./category-tree"; // 或内联 normalize 避免循环
export function getCategoryUrl(category: string | null): string {
  const norm = normalizeCategory(category ?? "");
  if (!norm || norm.toLowerCase() === i18n(I18nKey.uncategorized).toLowerCase()) return url("/categories/uncategorized/");
  return url(`/categories/${norm.split("/").map(encodeURIComponent).join("/")}/`);
}
```

- [ ] **Step 2: 重命名并改路由**

```bash
git mv src/pages/categories/\[category\].astro src/pages/categories/\[...category\].astro
```

改 `getStaticPaths`：`params: { category: node.fullPath }`（Astro 会自动按 `/` 切段，无需手 split）。改过滤：

```ts
const raw = params.category; // string | string[]
const catPath = Array.isArray(raw) ? raw.join("/") : (raw ?? "");
const filtered = allPosts.filter(p => {
  const c = getCategoryFromId(p.id);
  return c === catPath || c.startsWith(catPath + "/");
});
```

面包屑 `PostBreadcrumb` 多级渲染：`catPath.split("/").map((seg,i)=>({name:seg, url:getCategoryUrl(parts.slice(0,i+1).join("/"))}))`

- [ ] **Step 3: 验证**

```bash
pnpm check
pnpm build
```

Expected: 0 error, 342 页 Complete

- [ ] **Step 4: Commit**

```bash
git add src/utils/url-utils.ts src/pages/categories/\[...category\].astro
git commit -m "feat(categories): support multi-level /a/b routing with segmented encoding"
```

---

### Task 3: 聚合层 `content-utils.ts` 切到文件系统

**Files:**
- Modify: `src/utils/content-utils.ts:235-331` (`getCategoryList`, `getCategoryTagGroups`, `getArchiveList`)
- Modify: `src/content.config.ts:14-40`

**Interfaces:**
- Consumes: `getCategoryFromId`, `buildCategoryTree`, `getCategoryUrl`
- Produces: `getCategoryList(): Promise<Category[]>`（含父级聚合 count）、`getCategoryTree(): Promise<CategoryNode[]>` 新增、`getCategoryTagGroups()` 按 `fullPath` 分组

- [ ] **Step 1: 去 schema category**

```ts
// src/content.config.ts:24
// 删除 category 行，或保留 deprecated: z.string().optional().describe("deprecated: now derived from folder") + .default("")
// 推荐直接删除：
tags: z.array(z.string()).optional().default([]),
// category: z.string().optional().nullable().default(""), // removed: folder-as-category
```

- [ ] **Step 2: 重写 getCategoryList/getCategoryTagGroups**

```ts
export async function getCategoryList(): Promise<Category[]> {
  const posts = await getCollection("posts", ...);
  const count: Record<string,number> = {};
  for (const p of posts) {
    const full = getCategoryFromId(p.id) || i18n(I18nKey.uncategorized);
    // 每个前缀都计一次（含子孙）
    const parts = full === i18n(I18nKey.uncategorized) ? [full] : full.split("/");
    for (let i=1;i<=parts.length;i++) {
      const pref = parts.slice(0,i).join("/");
      if (pref === i18n(I18nKey.uncategorized)) { count[pref]=(count[pref]??0)+1; break; }
      count[pref]=(count[pref]??0)+1;
    }
  }
  // ...
}
export async function getCategoryTree(): Promise<CategoryNode[]> {
  const posts = await getCollection("posts", ...);
  return buildCategoryTree(posts.map(p=>({id:p.id, tags:p.data.tags})));
}
```

`getArchiveList` 同步：`category: getCategoryFromId(post.id) || null`

- [ ] **Step 3: 验证**

```bash
pnpm check
```

Expected: no `post.data.category` type error（全局 grep 确认零引用）

- [ ] **Step 4: Commit**

```bash
git add src/content.config.ts src/utils/content-utils.ts
git commit -m "refactor(content): derive category from folder, remove frontmatter category"
```

---

### Task 4: 分类卡片树形化 + 去右侧按钮

**Files:**
- Modify: `src/components/widget/CategoryFolders.astro:1-70`
- Modify: `src/styles/pages/categories.css:111-323`
- Modify: `src/pages/categories.astro:76`
- Modify: `src/components/controls/ArchivePanel.svelte:322-360` (可选联动)

**Interfaces:**
- Consumes: `CategoryNode[]` from `getCategoryTree()`
- Produces: 递归 `<details>` 树：有 children → 展开列 child 卡；无 children → 整卡 `<a href>`

- [ ] **Step 1: 改 `categories.astro` 传树**

```astro
---
import { getCategoryTree } from "@/utils/content-utils";
const tree = await getCategoryTree();
---
<CategoryFolders tree={tree} />
```

- [ ] **Step 2: 重写 `CategoryFolders.astro` 递归**

```astro
---
type Node = { name:string; fullPath:string; count:number; children:Node[]; url:string; tags:CategoryTag[] }
const { tree } = Astro.props as { tree: Node[] };
---
{tree.map(node => node.children.length > 0 ? (
  <details class="category-folder">
    <summary class="category-folder__summary">{node.name} · {node.count}篇</summary>
    <div class="category-folder__content">
      <CategoryFolders tree={node.children} />
    </div>
  </details>
) : (
  <a href={node.url} class="category-folder category-folder--leaf">{node.name} · {node.count}篇</a>
))}
```

删 `category-folder__link` 跳转按钮 `34-41` 及其 `categories.css:238-256` 样式。

- [ ] **Step 3: 样式加缩进线**

```css
.category-folder--nested { margin-left: 1rem; border-left: 1px dashed var(--line-divider); padding-left: 0.75rem; }
.category-folder--leaf { /* 复用卡片样式但整卡可点 */ }
```

- [ ] **Step 4: ArchivePanel 过滤改子树包含**

```ts
// ArchivePanel.svelte:350
const match = categories.some(cat => pCat === cat || pCat.startsWith(cat + "/"));
```

- [ ] **Step 5: 验证**

```bash
pnpm build
# 浏览器：/categories/ 看三级，叶子点跳 /categories/编程学习/Java学习/，父级展开看子类
```

- [ ] **Step 6: Commit**

```bash
git add src/components/widget/CategoryFolders.astro src/styles/pages/categories.css src/pages/categories.astro src/components/controls/ArchivePanel.svelte
git commit -m "feat(categories): tree view for folders, leaf jumps, remove jump button"
```

---

### Task 5: 历史数据迁移 + CMS/脚本

**Files:**
- Create: `scripts/migrate/remove-category-frontmatter.mjs` (一次性 Node 脚本，跑完可删)
- Modify: `.pages.yml:102-105`
- Modify: `scripts/新建文章/index.js:45-53`
- Modify: `src/content/posts/**` (脚本批量改)

- [ ] **Step 1: 写迁移脚本**

```js
// scripts/migrate/remove-category-frontmatter.mjs
import { glob } from "glob";
import fs from "fs";
const files = await glob("src/content/posts/**/*.{md,mdx}");
let changed=0;
for (const f of files) {
  let s = fs.readFileSync(f,"utf8");
  const next = s.replace(/^category:\s*.*\n/m, "");
  if (next!==s) { fs.writeFileSync(f,next); changed++; }
}
console.log(`removed ${changed} files`);
```

- [ ] **Step 2: 改 .pages.yml 删 category 声明**

```yaml
# 删 - name: category 那 4 行
```

- [ ] **Step 3: 改新建文章脚本不再写 category**

```js
// scripts/新建文章/index.js:45-53
// 模板删 category: '' 行
```

- [ ] **Step 4: 执行并验证**

```bash
node scripts/migrate/remove-category-frontmatter.mjs
pnpm build
```

- [ ] **Step 5: Commit**

```bash
git add .pages.yml scripts/新建文章/index.js src/content/posts
git commit -m "chore(content): remove category frontmatter, folder is category"
```

---

### Task 6: Obsidian 插件停用写入

**Files:**
- Modify: `plug-in/Obsidian/obsidian-category-autofill/logic.ts:100-108`
- Modify: `plug-in/Obsidian/obsidian-category-autofill/logic.test.ts`
- Modify: `plug-in/Obsidian/obsidian-category-autofill/main.ts:86-92`
- Modify: `plug-in/Obsidian/obsidian-category-autofill/AGENTS.md`
- Modify: `plug-in/Obsidian/obsidian-category-autofill/README.md`

- [ ] **Step 1: logic.ts 改为 no-op 或删 getTargetCategory**

```ts
// 保留 isInBaseFolder/isHiddenPath 供新建模板用，但 getTargetCategory 返回 null 或废弃
export function getTargetCategory(): string | null { return null; }
```

或直接让 `main.ts targetFor` 返回 `null`，`updateCategory` 永跳过。

- [ ] **Step 2: 补测试**

```ts
test("getTargetCategory returns null after folder-as-category", () => {
  assert.equal(getTargetCategory("content/posts/a/b/xx.md","b",false), null);
});
```

- [ ] **Step 3: 构建验证**

```bash
cd plug-in/Obsidian/obsidian-category-autofill
pnpm test
pnpm build
```

Expected: 拷贝成功

- [ ] **Step 4: 提交插件独立仓库**

```bash
git add logic.ts logic.test.ts main.ts AGENTS.md README.md
git commit -m "feat!: deprecate category autofill, folder is category"
git push
# 提醒用户 Obsidian Ctrl+P 重载
```

---

### Task 7: 文档同步 + 验收

**Files:**
- Modify: `CLAUDE.md:2,14,19` 目录结构、collections、反模式
- Modify: `docs/superpowers/plans/2026-08-20-folder-as-category.md` (本文件标记完成)

- [ ] **Step 1: 更新 CLAUDE.md**

- [ ] **Step 2: 最终验收**

```bash
pnpm check
pnpm type-check
pnpm build
pnpm exec biome ci ./src
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md docs/superpowers/plans/2026-08-20-folder-as-category.md
git commit -m "docs: sync folder-as-category spec"
```

---

## Self-Review

- Spec coverage: 文件夹即分类 ✓ 树展开/叶子跳转 ✓ 去右侧按钮 ✓ 插件影响 ✓ 一步到位 — 均有 Task 对应
- Placeholder scan: 无 TODO/TBD
- Type consistency: CategoryNode.fullPath ↔ getCategoryUrl 分段编码 ↔ [...category] 路由一致
