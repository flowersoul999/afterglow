# Afterglow

个人博客，Static Site 生成，无后端。

## 技术栈

- Astro 7 + Svelte 5 + TypeScript
- Tailwind CSS v4（无配置文件，样式统一从 `src/styles/main.css` 进入）
- Pagefind 全文搜索，构建时生成索引

## 本地开发

```bash
pnpm install       # 包管理器限定 pnpm 9.14（preinstall 强制）
pnpm dev           # 开发服务器 http://localhost:4321
pnpm build         # 构建到 dist/（图标生成 -> astro build -> pagefind 索引）
pnpm preview       # 预览构建产物
```

Node >= 22。

## 质量校验

```bash
pnpm check         # astro check（类型 + 内容集合 schema）
pnpm type-check    # tsc --noEmit --isolatedDeclarations
pnpm lint          # biome check --write ./src
pnpm format        # biome format --write ./src
```

## 环境变量

复制 `.env.example` 为 `.env` 后按需填写。缺失不会导致构建失败，只会让对应功能静默降级（评论、统计、图床上传等）。

## 目录速览

```
src/
  components/    按功能域分组（layout / features / widget / comment ...）
  config/        站点配置，index.ts 做 barrel 导出
  content/       Astro Content Collections（文章 / 页面 / 动态 / 相册 ...）
  pages/         路由
  styles/        main.css 为唯一入口
  utils/         工具与控制器
scripts/         中文命名脚本目录 + cli.js
public/          静态资源
```

## 许可

见 [LICENSE](./LICENSE)。
