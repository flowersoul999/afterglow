---
version: "v6.27.2"
date: 2026-11-25
time: "16:25"
type: fix
description: 按住 Tab 呼出轮盘时，焦点不再跟着在背后页面里乱跳
---

## 按住 Tab，页面不动了

轮盘是「按住 Tab 弹出、松手跳转」的交互，但之前的实现只拦住了**第一次**按下。
人手的按键不是按一下就抬起 —— 按住不放时，系统会以每秒几十次的频率持续派发
`keydown`（`event.repeat === true`），每一次都是一个独立的「Tab 默认动作」。

而代码里有一行 `if (e.repeat) return;` 排在 `preventDefault()` 之前，意思是
「重复的按键事件，我不管了」。于是轮盘确实弹出来了，但浏览器还是在背后
一个一个地移动焦点：导航栏 logo → 主页按钮 → 导航 → 文章……

用 CDP 模拟真实长按能稳定复现：

```text
首次按下       → 轮盘弹出，焦点 = BODY
第 1 次 repeat → A.navbar-logo
第 2 次 repeat → BUTTON.navbar-logo-text "jojostar"
第 3 次 repeat → A.btn-plain "主页"
第 4 次 repeat → A.btn-plain "导航"
第 5 次 repeat → BUTTON.btn-plain "文章"
```

松手时焦点已经跑到某个按钮上，紧接着敲回车就会误触。

## 修法

不再用「轮盘是否打开」当判断依据，改成记「Tab 这一下是否还按着」——
`tabDown`（`TabRadialMenu.svelte:72`）。判断分支全部挪到 `preventDefault` 之后：

- 手还按着 → 后续每一次 `keydown` 都吞掉，不管是不是 repeat；
- 顺带修掉一个同源问题：轮盘弹出后按 Esc 取消，此时 `open` 已是 `false`，
  但手还按着 Tab，后面的 repeat 同样会漏 —— 现在也被 `tabDown` 挡住了；
- `keyup` 的默认动作在个别浏览器里也会移焦点，一并吞掉。

`tabDown` 是个需要显式清理的状态，所以两处兜底：

| 时机 | 为什么必须清 |
|---|---|
| `window blur` | 切标签页 / 切窗口时 `keyup` 永远不会派发过来，不清掉会永久吞掉 Tab（轮盘还开着也一并关掉） |
| `astro:page-load` | SPA 换页后，上一次按下的 Tab 早在别的页面里松开了 |

## 保留的放行

- **输入框 / 文本域 / 可编辑区**里 Tab 仍然是原生的「下一个字段」（搜索框、评论框照样能填）；
- **Shift+Tab** 与带 Ctrl / Alt / Cmd 的组合键照旧不接管。

## 验证

`pnpm dev` + Playwright（CDP `Input.dispatchKeyEvent` 带 `autoRepeat: true`）跑了两轮：

| 场景 | 修之前 | 修之后 |
|---|---|---|
| 长按 Tab（6 次 repeat） | 焦点跳到 logo / 导航按钮 | 始终停在 `BODY`，轮盘保持打开 |
| 输入框内按 Tab | 切到下一个 input | 切到下一个 input（未变） |
| Shift+Tab | 放行 | 放行（未变） |
| Esc 取消后继续按住 | 焦点继续跳 | 焦点不动，松手后可重新呼出 |

`pnpm check` 0 error、`biome ci` 通过。

改动文件：`src/components/features/TabRadialMenu.svelte`（`onKeyDown` / `onKeyUp` / `onWindowBlur`）。
