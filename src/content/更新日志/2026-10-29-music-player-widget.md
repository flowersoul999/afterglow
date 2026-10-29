---
version: "v6.8.0"
date: 2026-10-29
time: "20:35"
type: feature
description: 左下角新增可拖拽的唱片播放器，替换原右下角悬浮坞里的音乐抽屉
---

## 左下角唱片播放器

从参考站搬来的一套三态音乐组件，落在**页面左下角**，桌面上全程可用：

- **唱片态（disc）**：未播放时只是一枚 80px 的圆碟，安静待在左下角，不挡内容。
- **胶囊态（pill）**：播放中自动缩成「唱片 + 一行歌词」的窄条，歌词超宽会横向跑马灯。
- **展开态（bar）**：点唱片展开成完整控制条 —— 曲名、歌手、可拖动进度条、播放模式切换、歌词开关、上一首/播放/下一首、歌单、音量。
- **歌单 / 歌词面板**：点歌单按钮，同一张卡片向上长出面板（**列表 / 歌词** 双 tab），信息层随之上移，不会出现两张分离的卡片。歌词按当前播放位置自动高亮并居中滚动。
- **可拖拽**：组件任意非交互区域按住即可拖到视口任意位置，松手后记住坐标（`localStorage: music-player-pos`），下次打开还在原地；换形态或开合面板时会自动夹回视口内。
- **移动端不显示**（≤768px），小屏交回底部导航。

## 原来的音乐入口已撤

- 右下角悬浮坞里的「音乐」按钮和抽屉面板已移除，全站只保留左下角这一个播放器，不再有两套 UI 抢位置。
- 开关统一到 `src/config/musicConfig.ts` 的 `showInNavbar`（名称沿用旧字段）：设为 `false` 则整个组件不渲染。

## 技术要点

- **不重复造引擎**：播放内核仍是 `MusicManager` 暴露的 `window.__fireflyMusic` 单例，新组件只负责三态形态机、展开卡、拖拽和列表渲染，与「3D 音乐可视化」共用同一份播放状态（`fm:*` 事件广播）。
- **挂载在 Swup 容器外**：`src/layouts/Layout.astro` 的 `<slot />` 之后，SPA 切页时 DOM 不被替换，播放不中断；用 `window.__musicPlayerWidgetReady` 单例守卫防止重复初始化（实测切页后仍只有一个实例、无监听叠加）。
- **类名隔离**：根节点用 `data-mp-widget` 定位而不是 `music-player-widget` —— 旧的 `MusicPlayer.astro`（音乐页小组件）占着后者，用类名会抓错元素。
- **懒加载**：点唱片或播放键才触发 `init()` 拉歌单，不点不请求 `/music-playlist.json`。
- 样式 `src/styles/features/music-player.css` 由组件自己 import（CLAUDE.md §4.3），新增令牌 `--music-surface`（`src/styles/tokens/colors.css`）负责音量条填充与滑块描边的实心色。

## 注意

播放列表当前为空：`src/config/musicConfig.ts` 是 `mode: "local"`，歌单由 `src/content/影视/music/` 的 content collection 生成（`/music-playlist.json`），该目录暂无条目。想立刻有歌可以改用 `mode: "meting"` + 网易云歌单 ID。
