/**
 * 首页欢迎弹窗的访客地域查询（IP 归属地）。
 *
 * 本站是 GitHub Pages 纯静态托管，没有服务端，所以是**浏览器直连第三方接口**：
 * 请求由访客浏览器发出，接口读到的就是访客自己的出口 IP；本站既不接收也不存储 IP。
 *
 * 精度：接口背后是国内 IP 库，可到区县（例：「中国湖北省襄阳市谷城县」）。
 * 它提供的是「运营商登记的归属地」，不是 GPS —— 手机流量常在省会漂移，
 * 开代理/VPN 会显示代理所在地，属正常现象。
 *
 * 该接口已开 CORS（Access-Control-Allow-Origin: *），浏览器可直接请求。
 * 没有 SLA：接口挂掉或改路径时，弹窗退回通用文案，不影响页面其余部分。
 */
export const visitorLocationConfig = {
	// 关掉后首页不再输出弹窗组件
	enabled: true,
	// 归属地接口；返回 {"code":200,"data":{"address":"中国湖北省襄阳市谷城县",...}}
	url: "https://v2.xxapi.cn/api/ip",
	// 请求超时（毫秒），超时按「查不到」处理
	timeoutMs: 3500,
	// sessionStorage 键：同一次会话只弹一次，关闭浏览器标签后重置
	sessionKey: "jojostar_welcome_seen_v1",
	// 首屏稳定后再弹出，避免和首页入场动画抢注意力
	delayMs: 900,
	// 自动收起时间（毫秒）
	visibleMs: 7000,
} as const;
