/**
 * Waline 国内访问反代 —— Cloudflare Worker
 *
 * 为什么需要它：Waline 部署在 Vercel，服务地址是 `*.vercel.app`。这个域名在国内
 * 被 DNS 污染 + TCP 阻断（实测解析到 Facebook 的 IP，强行指向 Vercel 真实 IP 也
 * 连不通），所以浏览器直连必然失败，留言板、文章评论、浏览量全废。
 *
 * 解法不是搬服务，而是在已经通的链路上多接一个子域名：`jojocode.cn` 本来就托管
 * 在 Cloudflare（A 记录是 CF 的 IP），给 Worker 绑 `waline.jojocode.cn` 之后，
 * **回源请求由 Cloudflare 机房发起**，不在访客的机器上发 —— 墙拦不住。
 *
 * 部署方式（控制台粘贴，不需要 CLI）：
 *   1. Cloudflare 控制台 → Workers & Pages → Create → Worker，起名 `waline-proxy`
 *   2. 把本文件全文粘进在线编辑器 → Deploy
 *   3. Settings → Domains & Routes → Add → **Custom domain** → 填 `waline.jojocode.cn`
 *      （CF 会自动建好 DNS 记录，**不要**自己加 CNAME 指向 cname.vercel-dns.com）
 *   4. 验证：curl https://waline.jojocode.cn/__health  → 应为 `waline-proxy ok`
 *   5. 最后把博客仓库的 Secret `PUBLIC_WALINE_SERVER` 改成 https://waline.jojocode.cn，
 *      重新部署一次（这个值是构建时注入的，不重新构建不生效）
 *
 * ⚠️ 不要给这个 Worker 再加 `jojocode.cn/api/*` 之类的 Route，那是站长登录 Worker
 *    （cloudflare-worker/index.js）的地盘，两个功能各用各的 Worker、各绑各的域名。
 *
 * 完整方案对比与踩坑记录见 docs/deploy-waline-cn-access.md。
 */

const UPSTREAM = "https://jojostar-waline.vercel.app";

export default {
	async fetch(request) {
		const url = new URL(request.url);
		const origin = request.headers.get("Origin") ?? "";

		// 健康检查：不下发到上游，用来确认"代理本身通了"而不是"上游挂了"
		if (url.pathname === "/__health") {
			return new Response("waline-proxy ok", {
				headers: { "content-type": "text/plain; charset=utf-8" },
			});
		}

		// 预检直接答掉：上游返回的 CORS 头是按 vercel.app 算的，不能直接透给浏览器
		if (request.method === "OPTIONS") {
			return new Response(null, { status: 204, headers: cors(origin, request) });
		}

		const target = new URL(url.pathname + url.search, UPSTREAM);
		const headers = new Headers(request.headers);
		headers.delete("host");

		let upstream;
		try {
			upstream = await fetch(target, {
				method: request.method,
				headers,
				body:
					request.method === "GET" || request.method === "HEAD"
						? undefined
						: request.body,
				// 不要跟随重定向：跟了会把访客带出代理域名
				redirect: "manual",
			});
		} catch {
			// 上游真的挂了也要给结构化 JSON，前端才能走"服务不可用"而不是白屏
			return json({ errno: -1, errmsg: "Waline 上游不可达" }, 502, origin, request);
		}

		const out = new Headers();
		for (const [key, value] of upstream.headers) {
			const name = key.toLowerCase();
			// 传输层头必须丢掉：Workers 拿到的是已经解压的 body，保留会二次解码失败
			if (name === "content-encoding" || name === "content-length") continue;
			if (name === "transfer-encoding" || name === "connection") continue;
			// CORS 与 Cookie 自己重写
			if (name.startsWith("access-control-")) continue;
			if (name === "set-cookie") continue;
			out.set(key, value);
		}
		// set-cookie 是多值头，getSetCookie() 逐条取，否则会被压成一条
		for (const cookie of upstream.headers.getSetCookie?.() ?? []) {
			out.append("set-cookie", cookie);
		}
		for (const [key, value] of Object.entries(cors(origin, request))) {
			out.set(key, value);
		}

		// 上游若返回重定向（OAuth 之类），把 vercel.app 换回代理域名
		const location = out.get("location");
		if (location?.startsWith(UPSTREAM)) {
			out.set("location", url.origin + location.slice(UPSTREAM.length));
		}

		// 204 / 304 / HEAD 的 body 必须为 null，否则 new Response() 会抛错
		const noBody =
			request.method === "HEAD" ||
			upstream.status === 204 ||
			upstream.status === 304;

		return new Response(noBody ? null : upstream.body, {
			status: upstream.status,
			statusText: upstream.statusText,
			headers: out,
		});
	},
};

function cors(origin, request) {
	const headers = {
		"Access-Control-Allow-Origin": origin || "*",
		"Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
		"Access-Control-Allow-Headers":
			request.headers.get("Access-Control-Request-Headers") ?? "Content-Type",
		"Access-Control-Max-Age": "86400",
		Vary: "Origin",
	};
	if (origin) headers["Access-Control-Allow-Credentials"] = "true";
	return headers;
}

function json(body, status, origin, request) {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			"Content-Type": "application/json; charset=utf-8",
			...cors(origin, request),
		},
	});
}
