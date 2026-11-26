---
version: "v6.32.0"
date: 2026-11-26
time: "10:26"
type: feature
description: 首页新增欢迎弹窗，按访问时段问候并显示访客的 IP 归属地（可到区县）
---

## 改了什么

首页右下角多了一个欢迎弹窗：先按当前时间打招呼（夜深了 / 早上好 / 上午好 / 中午好 / 下午好 / 晚上好），再用访客的网络出口 IP 查出归属地，写成「来自 中国湖北省襄阳市谷城县，很高兴遇见你。」

- 归属地由浏览器直连第三方接口取得（`https://v2.xxapi.cn/api/ip`），背后是国内 IP 库，精度到区县；**本站不接收、不存储访客 IP**，查完只用于这一次文案
- 同一次会话只弹一次，换页再回首页不会重复打扰；7 秒后自动收起，右上角可手动关闭
- 接口超时（3.5 秒）、被拦截或改结构时，自动退回「很高兴在这里遇见你。」，不影响页面其他部分
- 桌面固定在右下角，手机上抬到 5rem 并铺满宽度；暗色、暖纸、减少动效三种情况都单独适配过

## 关键文件

- `src/components/features/HomeWelcomeToast.astro` —— 弹窗本体，自定义元素 + Astro scoped 样式
- `src/config/visitorLocationConfig.ts` —— 接口地址、超时、延迟、自动收起时长、会话键，全部集中在这里
- `src/pages/[...page].astro` —— 只在首页挂载

## 想改的话

- 改文案：组件里 `GREETING_STEPS`（时段问候）与 `FALLBACK_MESSAGE`（兜底句子）
- 换接口：改 `visitorLocationConfig.url`，返回值只要带 `data.address` / `address` / `city` 任一字段就能用
- 关掉：`visitorLocationConfig.enabled` 设为 `false`，首页不再输出这个组件
