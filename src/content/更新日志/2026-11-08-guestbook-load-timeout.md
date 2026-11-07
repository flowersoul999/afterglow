---
version: "v6.21.1"
date: 2026-11-08
time: "00:02"
type: fix
description: 留言板连不上 Waline 时不再永久停在骨架屏，改为 15 秒超时并给出明确提示
---

## 留言板加载不再无限卡住

Waline 服务挂在 `*.vercel.app` 上，国内直连时 DNS 被污染、TCP 连接被静默丢包。`fetch` 本身没有超时，请求会一直 pending，页面就永久停在骨架屏上——既不出内容也不报错，看起来就是「一直卡住打不开」。文章评论和浏览量统计同源，受影响范围一样。

- **每次请求 15 秒超时**：新增 `createRequestGuard`，把「超时」和「外部取消」两个 `AbortSignal` 合成一个，并能区分是哪一种。超时抛「连接留言服务超时，请检查网络后重试」；主动取消（切换页面、离线）仍然静默返回，不会闪错误。
- **首屏失败立刻放弃，不再对半拆页**：原来的失败重试会把页区间一直对半拆到 pageSize=1，一次连不上最多放大成 127 次串行请求，把「等几秒」拖成「等几分钟」。现在只有「已经成功取到过数据」时才拆页——那时才是个别页 500，拆页才有意义；整轮请求也加了 8 次上限。
- **本地化文案不再被吞**：新增 `GuestbookLocalizedError`，`getGuestbookErrorMessage` 遇到它直接透传。此前 `throw new Error(i18n(...))` 会被通用正则改写成「留言服务暂时不可用」，连「Waline 服务地址未配置」这种明确配置错误都看不出来。

相关文件：`src/components/features/GuestbookChat.svelte`、`src/utils/guestbook-chat.ts`、`src/i18n/i18nKey.ts`、`src/i18n/languages/zh_CN.ts`

> 注意：这只是把「无限卡住」变成「15 秒后明确报错」。要让留言板真正可用，还需要把 Waline 从被墙的 `*.vercel.app` 换到国内可达的地址。
