---
version: "v1.63.0"
date: 2026-10-20
time: "22:05"
type: feature
description: Obsidian 插件 Image Manager 适配移动端（v2.4.0）：手机可上传笔记图片、下载网图，封面图功能仅桌面端
---

## Image Manager 插件能在手机上用了

Image Manager（`plug-in/Obsidian/obsidian-image-manager/`）升到 **v2.4.0**，现在 iOS / Android 的 Obsidian 能正常加载并使用了。

### 手机上加载失败的原因

插件的打包产物里有三行模块顶层的 `require("fs")` / `require("path")` / `require("child_process")`——来自 main.ts 的顶层 `import * as fs from "fs"`。esbuild 会把静态 import 编译成模块顶层 require，而移动端的 WebView 没有 Node 运行时，插件一加载就 `Failed to load plugin`，跟功能是否用到完全无关。

### 改法

- `fs` / `path` / `child_process` 改为首次使用时惰性获取，并且先用 `Platform.isDesktopApp` 短路——移动端根本走不到 `require` 那一行
- 封面图相关命令（要读库外文件、调系统回收站、读插件目录里的 WebP wasm）在移动端不注册，设置页也不显示那一组项
- 移动端新增左侧栏两个图标入口（上传当前笔记 / 下载网图），并给笔记文件补了右键（手机上是长按）菜单项
- 移动端**不删除本地图片**：手机没有系统回收站，`vault.trash` 会落到用户的删除策略上（可能永久删除），所以一律保留
- 图床登录响应头改为大小写不敏感读取（移动端原生 HTTP 返回的键名不一定小写），设置页说明文字在窄屏自动换行

改完用两个沙箱各跑了一遍加载冒烟测试：模拟无 Node 的移动端能正常 `onload` 且只注册 3 条命令，桌面端仍注册 4 条（含封面图）且未多出 ribbon 图标。

### 顺带解决的安装问题

WebP 编码器的 wasm 以前是插件目录里的独立文件，而 BRAT / 手动安装只认 `main.js`、`manifest.json`、`styles.css` 三个文件，会漏掉 wasm。现在用 esbuild 的 binary loader 把两个 wasm 内嵌进 `main.js`（约 1 MB），三个文件装完就能用完整的封面图功能。

插件也开源了：<https://github.com/tianshihao2003/obsidian-image-manager>，release 上挂着这三个文件。手机上装 BRAT 后填 `tianshihao2003/obsidian-image-manager` 即可一键安装，以后跟着 release 更新。
