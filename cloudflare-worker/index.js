/**
 * 站长登录 + GitHub Contents 代理 —— Cloudflare Worker
 *
 * 为什么需要它：站点托管在 GitHub Pages，是**纯静态**的，没有任何地方能跑代码。
 * 而 GitHub OAuth 换 access_token 需要 client_secret，且 GitHub 的 token 端点
 * 不支持跨域 —— 所以这一步只能放在一个真正的服务端。这里用 Cloudflare Worker
 * 补上这一块，**只接管 /api/***，站点本身仍由 GitHub Pages 托管，互不干扰。
 *
 * 部署方式（控制台粘贴，不需要 CLI）：
 *   1. Cloudflare 控制台 → Workers & Pages → Create → Worker，随便起个名字
 *   2. 把本文件全文粘进在线编辑器 → Deploy
 *   3. Settings → Variables and Secrets 加两个 **Secret**：
 *        GITHUB_CLIENT_ID       GitHub OAuth App 的 Client ID
 *        GITHUB_CLIENT_SECRET   同上 Client Secret（点 Encrypt 存成 secret）
 *   4. Settings → Triggers → Routes，加 **两条**：
 *        jojocode.cn/api/auth/*
 *        jojocode.cn/api/github/*
 *
 * ⚠️ 千万不要写成 `jojocode.cn/api/*`。站点自己还有三个静态 API
 *    （/api/calendar.json、/api/home-stats.json、/api/knowledge-graph.json，
 *    首页统计和日历都靠它们），那条 Route 会把它们一起吞掉，首页直接空白。
 * ⚠️ 更不要写成 `jojocode.cn/*`，那会把整个站点变成 404。
 *
 * 接口（与 src/utils/editor/github-client.ts 一一对应）：
 *   GET    /api/auth/login      → 302 到 GitHub 授权页
 *   GET    /api/auth/callback   → 换 token、验站长、下发 HttpOnly Cookie
 *   GET    /api/auth/me         → 当前登录态（未登录 401）
 *   POST   /api/auth/logout     → 清 Cookie
 *   GET    /api/github/file     → 读文件（不存在时 file: null）
 *   PUT    /api/github/file     → 写 / 新建文件
 *   DELETE /api/github/file     → 删文件
 *   POST   /api/github/batch    → 多文件合成一个原子提交
 *
 * 私有通道（「我的状态」专用，见 src/utils/editor/private-client.ts）：
 *   GET    /api/private/tree    → 列一层目录
 *   GET    /api/private/file    → 读文件（不存在时 file: null）
 *   PUT    /api/private/file    → 写 / 新建文件
 *   DELETE /api/private/file    → 删文件
 *   PUT    /api/private/blob    → 写二进制（图片）
 *   GET    /api/private/raw     → 直接返回图片字节（给 <img src> 用）
 *
 * 私有通道走独立的**私有仓库**，用 PRIVATE_TOKEN（fine-grained PAT）读写，
 * 不复用 OAuth token —— 因为 `public_repo` scope 碰不到私有仓库，
 * 而把 scope 提到 `repo` 等于把账号下所有私有仓库的读写权都交出去。
 */

/* ------------------------------------------------------------------ 常量 */

/** 登录态 Cookie，HttpOnly —— 页面脚本读不到它 */
const COOKIE_TOKEN = "jojo_editor";
/** OAuth 中途态 Cookie，只在「点登录 → 从 GitHub 回来」这几十秒内存活 */
const COOKIE_STATE = "jojo_oauth_state";

const REPO_OWNER = "flowersoul999";
const REPO_NAME = "afterglow";
const DEFAULT_BRANCH = "main";

/**
 * 私有仓库坐标：「我的状态」的照片和数据都在这里，不进公开仓库。
 * 三项都能用同名环境变量覆盖，换仓库时不必改代码。
 */
const DEFAULT_PRIVATE_OWNER = "flowersoul999";
const DEFAULT_PRIVATE_REPO = "afterglow-private";
/**
 * 私有通道的根目录。路径护栏按它卡死 —— 这个仓库将来若放别的东西
 * （比如日记），也不能让状态接口越界去读。
 */
const PRIVATE_PREFIX = "status/";

/** 只有这个人能登录；想换人改这里，或者给 Worker 加一个 OWNER_LOGIN 变量 */
const DEFAULT_OWNER_LOGIN = "flowersoul999";

/**
 * 只申请 `public_repo`：这个仓库是公开的，够 push 就行。
 * 不申请 `repo`，免得自动拿到该账号全部私有仓库的读写权。
 */
const OAUTH_SCOPE = "public_repo";

const GITHUB_API = "https://api.github.com";
/** 内容根目录：所有集合都在 src/content/<中文目录>/ 下 */
const CONTENT_PREFIX = "src/content/";

const TOKEN_MAX_AGE = 60 * 60 * 24 * 30; // 30 天
const STATE_MAX_AGE = 60 * 10; // 10 分钟够走完一次授权

/* ------------------------------------------------------------------ 入口 */

export default {
	async fetch(request, env) {
		const url = new URL(request.url);
		const path = url.pathname;

		// 防呆：Route 配宽了会把不归本 Worker 管的请求也送进来。尤其是站点自己的
		// /api/calendar.json 之类静态端点 —— 被吞掉的话首页统计和日历会静默变空，
		// 很难查。所以这里明确拒掉，并直接告诉对方该改成哪两条 Route。
		const owned =
			path.startsWith("/api/auth/") ||
			path.startsWith("/api/github/") ||
			path.startsWith("/api/private/");
		if (!owned) {
			return new Response(
				`这个 Worker 只接管 /api/auth/*、/api/github/* 和 /api/private/*，收到的是 ${path}\n` +
					"请检查 Cloudflare 的 Route：应该是 jojocode.cn/api/auth/*、jojocode.cn/api/github/* 和 jojocode.cn/api/private/*；\n" +
					"不要用 jojocode.cn/api/*（会吞掉站点自己的 /api/*.json），更不要用 jojocode.cn/*",
				{
					status: 404,
					headers: { "Content-Type": "text/plain; charset=utf-8" },
				},
			);
		}

		if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET)
			return notConfigured();

		const method = request.method;

		if (path === "/api/auth/login" && method === "GET")
			return login(request, env);
		if (path === "/api/auth/callback" && method === "GET")
			return callback(request, env);
		if (path === "/api/auth/me" && method === "GET") return me(request, env);
		if (path === "/api/auth/logout" && method === "POST") return logout();

		if (path === "/api/github/file") {
			const auth = await requireOwner(request, env);
			if (auth.error) return auth.error;
			if (method === "GET") return readFile(request, auth.session.token);
			if (method === "PUT") return writeFile(request, auth.session.token);
			if (method === "DELETE") return deleteFile(request, auth.session.token);
			return json({ ok: false, message: "不支持的请求方法" }, 405);
		}

		// 图片等二进制文件：`/file` 走 textToBase64，图片进去必然损坏，
		// 所以单开一条只收 base64 原串的通道（说说编辑器上传图用）。
		if (path === "/api/github/blob" && method === "PUT") {
			const auth = await requireOwner(request, env);
			if (auth.error) return auth.error;
			return writeBlob(request, auth.session.token);
		}

		if (path === "/api/github/batch") {
			const auth = await requireOwner(request, env);
			if (auth.error) return auth.error;
			if (method === "POST") return writeBatch(request, auth.session.token);
			return json({ ok: false, message: "不支持的请求方法" }, 405);
		}

		// 列目录：后台的条目列表靠它。只返回一层，子目录由前端按需再拉 ——
		// 内容目录结构是「集合/分类/文件」，深度固定，逐层拉比整棵 Git Tree 便宜。
		if (path === "/api/github/tree" && method === "GET") {
			const auth = await requireOwner(request, env);
			if (auth.error) return auth.error;
			return listDir(request, auth.session.token);
		}

		// 私有通道：读写私有仓库里的 status/ 目录（「我的状态」）。
		if (path.startsWith("/api/private/")) {
			const auth = await privateAuth(request, env);
			if (auth.error) return auth.error;
			const repo = privateRepo(env);

			if (path === "/api/private/file") {
				if (method === "GET") return privateReadFile(request, repo, auth.token);
				if (method === "PUT") return privateWriteFile(request, repo, auth.token);
				if (method === "DELETE")
					return privateDeleteFile(request, repo, auth.token);
				return json({ ok: false, message: "不支持的请求方法" }, 405);
			}

			if (path === "/api/private/blob") {
				if (method === "PUT") return privateWriteBlob(request, repo, auth.token);
				return json({ ok: false, message: "不支持的请求方法" }, 405);
			}

			if (path === "/api/private/tree") {
				if (method === "GET") return privateListDir(request, repo, auth.token);
				return json({ ok: false, message: "不支持的请求方法" }, 405);
			}

			// 图片直出：<img src="/api/private/raw?path=..."> 浏览器会自动带 Cookie
			if (path === "/api/private/raw") {
				if (method === "GET") return privateRaw(request, repo, auth.token);
				return json({ ok: false, message: "不支持的请求方法" }, 405);
			}

			return json({ ok: false, message: "未知接口" }, 404);
		}

		return json({ ok: false, message: "未知接口" }, 404);
	},
};

/* ------------------------------------------------------------------ 配置 */

/**
 * `SITE_ORIGIN` 可不配：默认取当前请求的 origin，线上就是 https://jojocode.cn。
 * 只有在「Worker 挂在别的域名、但回调要回主站」时才需要显式指定。
 */
function siteOrigin(request, env) {
	const configured =
		typeof env.SITE_ORIGIN === "string" ? env.SITE_ORIGIN.trim() : "";
	if (configured) return configured.replace(/\/+$/, "");
	return new URL(request.url).origin;
}

function cookieSecret(env) {
	// 没有单独的 AUTH_SECRET 时用 client_secret 派生 —— 少一个必填项就少一处配错的机会
	const extra = typeof env.AUTH_SECRET === "string" ? env.AUTH_SECRET : "";
	return `${env.GITHUB_CLIENT_SECRET}:${extra}`;
}

function ownerLogin(env) {
	const configured =
		typeof env.OWNER_LOGIN === "string" ? env.OWNER_LOGIN.trim() : "";
	return configured || DEFAULT_OWNER_LOGIN;
}

/* ---------------------------------------------------------------- base64 */

function toBase64Url(bytes) {
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary)
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
}

function fromBase64Url(text) {
	const normalized = text.replace(/-/g, "+").replace(/_/g, "/");
	const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
	const binary = atob(padded);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
	return bytes;
}

/* ------------------------------------------------------------ 信封加密 */

/**
 * Cookie 里装的是 GitHub token。HttpOnly 挡得住脚本，但 Cookie 本身在浏览器里
 * 是可见的（用户自己 / 插件 / 抓包），所以先 AES-GCM 封一层：拿不到 secret
 * 既解不开、也改不了。
 */
async function keyFrom(secret) {
	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(secret),
	);
	return crypto.subtle.importKey("raw", digest, "AES-GCM", false, [
		"encrypt",
		"decrypt",
	]);
}

/** 明文 → base64url(iv ‖ 密文)；iv 每次随机，同样输入不会得到同样输出 */
async function seal(secret, plain) {
	const key = await keyFrom(secret);
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const cipher = await crypto.subtle.encrypt(
		{ name: "AES-GCM", iv },
		key,
		new TextEncoder().encode(plain),
	);
	const packed = new Uint8Array(iv.length + cipher.byteLength);
	packed.set(iv, 0);
	packed.set(new Uint8Array(cipher), iv.length);
	return toBase64Url(packed);
}

/** `seal` 的逆操作；密钥换过或 Cookie 被改过都会抛错 */
async function unseal(secret, token) {
	const raw = fromBase64Url(token);
	if (raw.length <= 12) throw new Error("Cookie 内容不完整");
	const key = await keyFrom(secret);
	const plain = await crypto.subtle.decrypt(
		{ name: "AES-GCM", iv: raw.subarray(0, 12) },
		key,
		raw.subarray(12),
	);
	return new TextDecoder().decode(plain);
}

/** OAuth state 用一次就作废，随机 16 字节足够 */
function randomState() {
	return toBase64Url(crypto.getRandomValues(new Uint8Array(16)));
}

/* ---------------------------------------------------------------- Cookie */

function readCookie(request, name) {
	const header = request.headers.get("Cookie") || "";
	for (const part of header.split(";")) {
		const index = part.indexOf("=");
		if (index < 0) continue;
		if (part.slice(0, index).trim() === name)
			return part.slice(index + 1).trim();
	}
	return "";
}

/**
 * `SameSite=Lax` 是必须的：从 GitHub 授权完跳回来是一次顶级 GET 导航，
 * Lax 允许带 Cookie；换成 Strict 就会丢 state，回来永远对不上。
 */
function serializeCookie(name, value, options = {}) {
	const parts = [`${name}=${value}`, `Path=${options.path || "/"}`];
	if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
	parts.push("HttpOnly", "SameSite=Lax");
	if (options.secure !== false) parts.push("Secure");
	return parts.join("; ");
}

/** 读登录态；没登录、密钥对不上、Cookie 被篡改，一律 null */
async function readSession(request, env) {
	const raw = readCookie(request, COOKIE_TOKEN);
	if (!raw) return null;
	try {
		const data = JSON.parse(await unseal(cookieSecret(env), raw));
		if (!data || typeof data.token !== "string" || data.token === "")
			return null;
		return data;
	} catch {
		return null;
	}
}

/**
 * 读登录态 + 确认是站长。
 *
 * 2026-11-26 起登录对所有人开放（普通访客也能用 GitHub 身份留言），所以
 * 内容仓库这几条通道不能再看「有没有登录」，必须再看「是不是站长」——
 * 否则任何登录用户都能读写博客仓库。
 */
async function requireOwner(request, env) {
	const session = await readSession(request, env);
	if (!session)
		return {
			error: json({ ok: false, message: "未登录或登录已过期" }, 401),
		};
	if (!isOwner(session.login, env))
		return {
			error: json(
				{ ok: false, message: "内容管理只有站长能操作" },
				403,
			),
		};
	return { session };
}

/* ---------------------------------------------------------------- 响应 */

function json(data, status = 200, extraHeaders = {}) {
	return new Response(JSON.stringify(data), {
		status,
		headers: {
			"Content-Type": "application/json; charset=utf-8",
			"Cache-Control": "no-store",
			...extraHeaders,
		},
	});
}

/** 302 跳转；`cookies` 里每一项都会追加成独立的 Set-Cookie */
function redirect(location, cookies = []) {
	const response = new Response(null, {
		status: 302,
		headers: { Location: location, "Cache-Control": "no-store" },
	});
	for (const cookie of cookies) response.headers.append("Set-Cookie", cookie);
	return response;
}

/** 站内跳转拼参数（`returnTo` 可能自带 query，不能直接字符串相加） */
function siteUrl(origin, path, params = {}) {
	const target = new URL(path || "/", origin);
	for (const [key, value] of Object.entries(params)) {
		if (value !== undefined && value !== null && value !== "") {
			target.searchParams.set(key, String(value));
		}
	}
	return target.toString();
}

/**
 * 只允许跳回站内路径。
 * 挡的是 `//evil.com` 这种「协议相对 URL」—— 浏览器会当成外域，等于开放重定向。
 */
function safeReturnTo(value) {
	if (typeof value !== "string" || value === "") return "/";
	if (!value.startsWith("/") || value.startsWith("//")) return "/";
	return value;
}

/* ---------------------------------------------------------------- 登录 */

async function login(request, env) {
	const origin = siteOrigin(request, env);
	const url = new URL(request.url);
	const returnTo = safeReturnTo(url.searchParams.get("return") ?? "/");
	const state = randomState();
	// state 和「登录完回哪一页」一起封进 Cookie，回调时比对，顺便把 returnTo 带回来
	const pending = await seal(
		cookieSecret(env),
		JSON.stringify({ state, returnTo }),
	);

	const authorize = new URL("https://github.com/login/oauth/authorize");
	authorize.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
	authorize.searchParams.set("redirect_uri", `${origin}/api/auth/callback`);
	authorize.searchParams.set("scope", OAUTH_SCOPE);
	authorize.searchParams.set("state", state);
	authorize.searchParams.set("allow_signup", "false");

	return redirect(authorize.toString(), [
		serializeCookie(COOKIE_STATE, pending, { maxAge: STATE_MAX_AGE }),
	]);
}

/* ---------------------------------------------------------------- 回调 */

async function callback(request, env) {
	const origin = siteOrigin(request, env);
	const url = new URL(request.url);
	const secret = cookieSecret(env);

	// 用户在 GitHub 点了「取消」，回跳时带的是 error 而不是 code
	if (url.searchParams.get("error")) return failure(origin, "denied");

	const code = url.searchParams.get("code") ?? "";
	const state = url.searchParams.get("state") ?? "";
	if (!code || !state) return failure(origin, "state_missing");

	const rawPending = readCookie(request, COOKIE_STATE);
	if (!rawPending) return failure(origin, "state_missing");

	let pending;
	try {
		pending = JSON.parse(await unseal(secret, rawPending));
	} catch {
		// Cookie 过期、密钥换过、被人改过都会走到这里
		return failure(origin, "state_invalid");
	}
	const returnTo = safeReturnTo(pending?.returnTo ?? "/");
	if (!pending || pending.state !== state)
		return failure(origin, "state_invalid", returnTo);

	// 换 access_token。client_secret 只在这一行出现，绝不回传给浏览器
	let token = "";
	try {
		const exchange = await fetch(
			"https://github.com/login/oauth/access_token",
			{
				method: "POST",
				headers: {
					Accept: "application/json",
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					client_id: env.GITHUB_CLIENT_ID,
					client_secret: env.GITHUB_CLIENT_SECRET,
					code,
					redirect_uri: `${origin}/api/auth/callback`,
				}),
			},
		);
		if (exchange.ok) {
			const data = await exchange.json();
			if (typeof data.access_token === "string") token = data.access_token;
		}
	} catch {
		return failure(origin, "exchange_failed", returnTo);
	}
	if (!token) return failure(origin, "exchange_failed", returnTo);

	// 是不是站长，由 GitHub 自己的账号名说了算（前端说的不算）
	let user;
	try {
		const response = await fetch(`${GITHUB_API}/user`, {
			headers: githubHeaders(token),
		});
		if (!response.ok) return failure(origin, "profile_failed", returnTo);
		user = await response.json();
	} catch {
		return failure(origin, "profile_failed", returnTo);
	}

	// 登录对所有人开放（留言板要用 GitHub 身份），但**站长身份由这里判定**：
	// 写进 session 的 isOwner 才是前端显示「后台」的依据，写仓库时还会再校验一次。
	const session = await seal(
		secret,
		JSON.stringify({
			token,
			login: user.login,
			name: user.name || user.login,
			avatar: user.avatar_url || "",
			isOwner: isOwner(user?.login, env),
		}),
	);

	return redirect(siteUrl(origin, returnTo, { auth: "ok" }), [
		serializeCookie(COOKIE_TOKEN, session, { maxAge: TOKEN_MAX_AGE }),
		serializeCookie(COOKIE_STATE, "", { maxAge: 0 }),
	]);
}

/* -------------------------------------------------------------- 登录态 */

async function me(request, env) {
	const session = await readSession(request, env);
	if (!session) return json({ ok: false }, 401);
	return json({
		ok: true,
		login: session.login,
		name: session.name,
		avatar: session.avatar,
		branch: DEFAULT_BRANCH,
		// 旧 Cookie 里没这个字段，用 login 现算一遍兜底；换人只需改 OWNER_LOGIN
		isOwner: isOwner(session.login, env),
	});
}

/* ---------------------------------------------------------------- 登出 */

async function logout() {
	return json({ ok: true }, 200, {
		"Set-Cookie": serializeCookie(COOKIE_TOKEN, "", { maxAge: 0 }),
	});
}

/* ------------------------------------------------------- GitHub 文件代理 */

async function readFile(request, token) {
	const query = new URL(request.url).searchParams;
	const path = query.get("path") ?? "";
	const branch = query.get("ref") || DEFAULT_BRANCH;

	const invalid = assertPath(path);
	if (invalid) return invalid;

	const response = await fetch(
		`${GITHUB_API}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${encodePath(path)}?ref=${encodeURIComponent(branch)}`,
		{ headers: githubHeaders(token) },
	);

	// 404 是正常情形：调用方据此区分「新建」和「改」
	if (response.status === 404) return json({ ok: true, file: null });
	if (!response.ok) return upstreamError(response);

	const data = await response.json();
	return json({
		ok: true,
		file: {
			path,
			sha: data.sha ?? "",
			text:
				data.encoding === "base64" && data.content
					? base64ToText(data.content)
					: "",
		},
	});
}

/**
 * 列一层目录。
 *
 * 返回 `{ entries: [{ name, path, type: "file" | "dir", sha, size }] }`，
 * 前端按名字过滤 `.md` 再递归拉子目录 —— 内容结构是「集合/分类/文件」，
 * 层级固定且浅，逐层拉比整棵 Git Tree（含图片、dist）便宜得多。
 */
async function listDir(request, token) {
	const query = new URL(request.url).searchParams;
	const path = query.get("path") ?? "";
	const branch = query.get("ref") || DEFAULT_BRANCH;

	const invalid = assertPath(path);
	if (invalid) return invalid;

	const response = await fetch(
		`${GITHUB_API}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${encodePath(path)}?ref=${encodeURIComponent(branch)}`,
		{ headers: githubHeaders(token) },
	);

	// 目录不存在 = 空集合，不是错误
	if (response.status === 404) return json({ ok: true, entries: [] });
	if (!response.ok) return upstreamError(response);

	const data = await response.json();
	if (!Array.isArray(data)) {
		return json({ ok: false, message: `${path} 是文件，不是目录` }, 400);
	}

	return json({
		ok: true,
		entries: data.map((entry) => ({
			name: entry.name,
			path: entry.path,
			type: entry.type === "dir" ? "dir" : "file",
			sha: entry.sha ?? "",
			size: entry.size ?? 0,
		})),
	});
}

async function writeFile(request, token) {
	const body = await readJson(request);
	if (!body) return json({ ok: false, message: "请求体不是合法 JSON" }, 400);

	const path = typeof body.path === "string" ? body.path : "";
	const invalid = assertPath(path);
	if (invalid) return invalid;

	const response = await fetch(
		`${GITHUB_API}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${encodePath(path)}`,
		{
			method: "PUT",
			headers: { ...githubHeaders(token), "Content-Type": "application/json" },
			body: JSON.stringify({
				message:
					typeof body.message === "string" && body.message
						? body.message
						: "chore(content): 站内编辑",
				content: textToBase64(typeof body.text === "string" ? body.text : ""),
				branch:
					typeof body.branch === "string" && body.branch
						? body.branch
						: DEFAULT_BRANCH,
				// 更新已有文件必须带 sha，缺了会被当成「新建」而报 422
				...(typeof body.sha === "string" && body.sha ? { sha: body.sha } : {}),
			}),
		},
	);

	if (!response.ok) return upstreamError(response);

	const data = await response.json();
	return json({ ok: true, sha: data.content?.sha ?? "" });
}

/**
 * 写二进制文件（图片）。
 *
 * 与 `/file` 的唯一区别：**不做 textToBase64**。把图片的 base64 当 UTF-8 再编
 * 一次，字节必然损坏，网页上就是一张裂图。所以这里收到的 base64 原样交给 GitHub。
 */
async function writeBlob(request, token) {
	const body = await readJson(request);
	if (!body) return json({ ok: false, message: "请求体不是合法 JSON" }, 400);

	const path = typeof body.path === "string" ? body.path : "";
	const invalid = assertPath(path);
	if (invalid) return invalid;

	const base64 =
		typeof body.base64 === "string"
			? body.base64.replace(/^data:[^,]*,/, "").replace(/\s/g, "")
			: "";
	if (!base64) return json({ ok: false, message: "缺少 base64 内容" }, 400);

	// 由 base64 长度反推字节数，超过 8MB 直接拒：博客配图没必要这么大，
	// 早点拦下比等 GitHub 超时便宜。
	if (Math.floor((base64.length * 3) / 4) > 8 * 1024 * 1024) {
		return json({ ok: false, message: "图片超过 8MB，请先压缩" }, 413);
	}

	const response = await fetch(
		`${GITHUB_API}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${encodePath(path)}`,
		{
			method: "PUT",
			headers: { ...githubHeaders(token), "Content-Type": "application/json" },
			body: JSON.stringify({
				message:
					typeof body.message === "string" && body.message
						? body.message
						: "chore(content): 上传图片",
				content: base64,
				branch:
					typeof body.branch === "string" && body.branch
						? body.branch
						: DEFAULT_BRANCH,
			}),
		},
	);

	if (!response.ok) return upstreamError(response);

	const data = await response.json();
	return json({ ok: true, sha: data.content?.sha ?? "" });
}

/** 删文件。GitHub 的删除接口强制要求 sha，传错会给 409 */
async function deleteFile(request, token) {
	const body = await readJson(request);
	if (!body) return json({ ok: false, message: "请求体不是合法 JSON" }, 400);

	const path = typeof body.path === "string" ? body.path : "";
	const invalid = assertPath(path);
	if (invalid) return invalid;

	if (typeof body.sha !== "string" || body.sha === "") {
		return json({ ok: false, message: "删除文件必须带上 sha" }, 400);
	}

	const response = await fetch(
		`${GITHUB_API}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${encodePath(path)}`,
		{
			method: "DELETE",
			headers: { ...githubHeaders(token), "Content-Type": "application/json" },
			body: JSON.stringify({
				message:
					typeof body.message === "string" && body.message
						? body.message
						: "chore(content): 站内删除",
				sha: body.sha,
				branch:
					typeof body.branch === "string" && body.branch
						? body.branch
						: DEFAULT_BRANCH,
			}),
		},
	);

	if (!response.ok) return upstreamError(response);

	return json({ ok: true });
}

/* ------------------------------------------------- 私有仓库通道（我的状态） */

/**
 * 私有通道的鉴权：登录态 + 站长身份 + PAT 三关。
 *
 * 为什么不复用 OAuth token：`public_repo` scope 读不到私有仓库；把它提到
 * `repo` 就等于把账号下全部私有仓库的读写权都塞进一个 Cookie。这里改用
 * 单独一枚 fine-grained PAT（只授这一个仓库的 Contents 读写），放在 Worker
 * Secret 里，泄漏面小得多，而且不影响现有登录链路。
 */
async function privateAuth(request, env) {
	const session = await readSession(request, env);
	if (!session)
		return { error: json({ ok: false, message: "未登录或登录已过期" }, 401) };
	if (!isOwner(session.login, env))
		return { error: json({ ok: false, message: "只有站长能访问私有内容" }, 403) };
	if (!env.PRIVATE_TOKEN)
		return {
			error: json(
				{
					ok: false,
					message:
						"私有仓库还没配 PRIVATE_TOKEN：请在 Worker 的 Variables and Secrets 里加这个 Secret",
				},
				501,
			),
		};
	return { token: env.PRIVATE_TOKEN };
}

/** 私有仓库坐标，环境变量优先，未配则用默认值 */
function privateRepo(env) {
	const pick = (value, fallback) =>
		typeof value === "string" && value.trim() ? value.trim() : fallback;
	return {
		owner: pick(env.PRIVATE_REPO_OWNER, DEFAULT_PRIVATE_OWNER),
		name: pick(env.PRIVATE_REPO_NAME, DEFAULT_PRIVATE_REPO),
		branch: pick(env.PRIVATE_BRANCH, DEFAULT_BRANCH),
	};
}

/**
 * 路径护栏：只放行 status/ 下的路径。
 *
 * 与公开通道的 assertPath 同理，但更严 —— 这个仓库以后可能放别的东西
 * （日记、账单），状态接口不该有能力越界去读。`status` 本身要允许，
 * 否则列不了根目录。
 */
function assertPrivatePath(path) {
	if (!path) return json({ ok: false, message: "缺少 path 参数" }, 400);
	if (path.includes("..")) return json({ ok: false, message: "path 不合法" }, 400);
	const normalized = path.replace(/\/+$/, "");
	if (normalized !== "status" && !normalized.startsWith(PRIVATE_PREFIX)) {
		return json(
			{ ok: false, message: `私有通道只能访问 ${PRIVATE_PREFIX} 下的文件` },
			403,
		);
	}
	return null;
}

function privateContentsUrl(repo, path) {
	return `${GITHUB_API}/repos/${repo.owner}/${repo.name}/contents/${encodePath(path)}`;
}

async function privateReadFile(request, repo, token) {
	const query = new URL(request.url).searchParams;
	const path = query.get("path") ?? "";

	const invalid = assertPrivatePath(path);
	if (invalid) return invalid;

	const response = await fetch(
		`${privateContentsUrl(repo, path)}?ref=${encodeURIComponent(repo.branch)}`,
		{ headers: githubHeaders(token) },
	);

	// 404 是正常情形：调用方据此区分「新建」和「改」
	if (response.status === 404) return json({ ok: true, file: null });
	if (!response.ok) return upstreamError(response);

	const data = await response.json();
	return json({
		ok: true,
		file: {
			path,
			sha: data.sha ?? "",
			text:
				data.encoding === "base64" && data.content
					? base64ToText(data.content)
					: "",
		},
	});
}

async function privateListDir(request, repo, token) {
	const query = new URL(request.url).searchParams;
	const path = query.get("path") ?? "";

	const invalid = assertPrivatePath(path);
	if (invalid) return invalid;

	const response = await fetch(
		`${privateContentsUrl(repo, path)}?ref=${encodeURIComponent(repo.branch)}`,
		{ headers: githubHeaders(token) },
	);

	// 目录不存在 = 还没记录过任何一天，不是错误
	if (response.status === 404) return json({ ok: true, entries: [] });
	if (!response.ok) return upstreamError(response);

	const data = await response.json();
	if (!Array.isArray(data)) {
		return json({ ok: false, message: `${path} 是文件，不是目录` }, 400);
	}

	return json({
		ok: true,
		entries: data.map((entry) => ({
			name: entry.name,
			path: entry.path,
			type: entry.type === "dir" ? "dir" : "file",
			sha: entry.sha ?? "",
			size: entry.size ?? 0,
		})),
	});
}

async function privateWriteFile(request, repo, token) {
	const body = await readJson(request);
	if (!body) return json({ ok: false, message: "请求体不是合法 JSON" }, 400);

	const path = typeof body.path === "string" ? body.path : "";
	const invalid = assertPrivatePath(path);
	if (invalid) return invalid;

	const response = await fetch(privateContentsUrl(repo, path), {
		method: "PUT",
		headers: { ...githubHeaders(token), "Content-Type": "application/json" },
		body: JSON.stringify({
			message:
				typeof body.message === "string" && body.message
					? body.message
					: "chore(status): 更新状态记录",
			content: textToBase64(typeof body.text === "string" ? body.text : ""),
			branch:
				typeof body.branch === "string" && body.branch
					? body.branch
					: repo.branch,
			// 更新已有文件必须带 sha，缺了会被当成「新建」而报 422
			...(typeof body.sha === "string" && body.sha ? { sha: body.sha } : {}),
		}),
	});

	if (!response.ok) return upstreamError(response);

	const data = await response.json();
	return json({ ok: true, sha: data.content?.sha ?? "" });
}

/** 写二进制，和公开通道同理：base64 原样透传，不做 UTF-8 重编码 */
async function privateWriteBlob(request, repo, token) {
	const body = await readJson(request);
	if (!body) return json({ ok: false, message: "请求体不是合法 JSON" }, 400);

	const path = typeof body.path === "string" ? body.path : "";
	const invalid = assertPrivatePath(path);
	if (invalid) return invalid;

	const base64 =
		typeof body.base64 === "string"
			? body.base64.replace(/^data:[^,]*,/, "").replace(/\s/g, "")
			: "";
	if (!base64) return json({ ok: false, message: "缺少 base64 内容" }, 400);

	if (Math.floor((base64.length * 3) / 4) > 8 * 1024 * 1024) {
		return json({ ok: false, message: "图片超过 8MB，请先压缩" }, 413);
	}

	const response = await fetch(privateContentsUrl(repo, path), {
		method: "PUT",
		headers: { ...githubHeaders(token), "Content-Type": "application/json" },
		body: JSON.stringify({
			message:
				typeof body.message === "string" && body.message
					? body.message
					: "chore(status): 上传照片",
			content: base64,
			branch:
				typeof body.branch === "string" && body.branch
					? body.branch
					: repo.branch,
		}),
	});

	if (!response.ok) return upstreamError(response);

	const data = await response.json();
	return json({ ok: true, sha: data.content?.sha ?? "" });
}

async function privateDeleteFile(request, repo, token) {
	const body = await readJson(request);
	if (!body) return json({ ok: false, message: "请求体不是合法 JSON" }, 400);

	const path = typeof body.path === "string" ? body.path : "";
	const invalid = assertPrivatePath(path);
	if (invalid) return invalid;

	if (typeof body.sha !== "string" || body.sha === "") {
		return json({ ok: false, message: "删除文件必须带上 sha" }, 400);
	}

	const response = await fetch(privateContentsUrl(repo, path), {
		method: "DELETE",
		headers: { ...githubHeaders(token), "Content-Type": "application/json" },
		body: JSON.stringify({
			message:
				typeof body.message === "string" && body.message
					? body.message
					: "chore(status): 删除记录",
			sha: body.sha,
			branch:
				typeof body.branch === "string" && body.branch
					? body.branch
					: repo.branch,
		}),
	});

	if (!response.ok) return upstreamError(response);

	return json({ ok: true });
}

/**
 * 图片直出。
 *
 * 私有仓库的图片不能直接甩 raw.githubusercontent.com 链接（那需要 token，
 * 而且会把 PAT 暴露在 URL 里）。所以由 Worker 代取一次，把字节原样回给
 * 浏览器 —— `<img src="/api/private/raw?path=...">` 是同源请求，Cookie 会
 * 自动带上，鉴权链路和读接口完全一致。
 *
 * 文件名带时间戳 + 随机串，内容永不改变，所以敢用 `immutable` 长缓存：
 * 一张图只在第一次进后台时过网，之后全走浏览器缓存。
 */
async function privateRaw(request, repo, token) {
	const query = new URL(request.url).searchParams;
	const path = query.get("path") ?? "";

	const invalid = assertPrivatePath(path);
	if (invalid) return invalid;

	const response = await fetch(
		`${privateContentsUrl(repo, path)}?ref=${encodeURIComponent(repo.branch)}`,
		// GitHub 的原始字节要用 raw 媒体类型拿；contents API 默认返回 base64，
		// 而且超过 1MB 的文件干脆不给 content。
		{ headers: { ...githubHeaders(token), Accept: "application/vnd.github.raw" } },
	);

	if (response.status === 404) return json({ ok: false, message: "图片不存在" }, 404);
	if (!response.ok) return upstreamError(response);

	return new Response(response.body, {
		status: 200,
		headers: {
			"Content-Type": response.headers.get("Content-Type") || "application/octet-stream",
			"Cache-Control": "private, max-age=31536000, immutable",
			"X-Content-Type-Options": "nosniff",
		},
	});
}

/* ------------------------------------------------------- GitHub 批量提交 */

const BATCH_LIMIT = 30;
const BATCH_TOTAL_BYTES = 5 * 1024 * 1024;

function withPathSuffix(path, attempt) {
	if (attempt <= 1) return path;
	return path.replace(/(\.mdx?)$/i, `-${attempt}$1`);
}

/**
 * 给仓库已有路径和本批次重名统一避让，保持输入顺序。
 *
 * `mode: "update"` 的条目例外：它的语义就是覆盖同路径文件，加后缀反而会
 * 在仓库里多留下一份重复内容，所以原样返回（但仍占位，后面的新建条目不
 * 会再抢这个路径）。
 */
export function resolveBatchPaths(items, existingPaths) {
	const occupied = new Set(existingPaths);
	return items.map((item) => {
		if (item.mode === "update") {
			occupied.add(item.path);
			return item;
		}
		let attempt = 1;
		let path = item.path;
		while (occupied.has(path)) {
			attempt += 1;
			path = withPathSuffix(item.path, attempt);
		}
		occupied.add(path);
		return { ...item, path };
	});
}

class GitHubBatchError extends Error {
	constructor(message, status, stage) {
		super(message);
		this.name = "GitHubBatchError";
		this.status = status;
		this.stage = stage;
	}
}

async function githubJson(
	fetchImpl,
	url,
	token,
	options = {},
	stage = "github",
) {
	const response = await fetchImpl(url, {
		...options,
		headers: {
			...githubHeaders(token),
			...(options.body ? { "Content-Type": "application/json" } : {}),
			...(options.headers || {}),
		},
	});
	if (!response.ok) {
		let message = `GitHub 返回 HTTP ${response.status}`;
		try {
			const data = await response.json();
			if (typeof data?.message === "string") message = data.message;
		} catch {
			// 保留默认消息
		}
		throw new GitHubBatchError(message, response.status, stage);
	}
	return response.json();
}

function gitRefPath(branch) {
	return branch.split("/").map(encodeURIComponent).join("/");
}

/**
 * 使用 Git Data API 创建多个 blob、一个 tree、一个 commit，最后只更新一次 ref。
 * ref 更新发生并成功之后，整批内容才对分支可见。
 */
export async function commitBatchFiles({
	token,
	branch,
	message,
	items,
	fetchImpl = fetch,
}) {
	const repoApi = `${GITHUB_API}/repos/${REPO_OWNER}/${REPO_NAME}`;
	let lastError = null;

	for (let attempt = 0; attempt < 2; attempt += 1) {
		try {
			const ref = await githubJson(
				fetchImpl,
				`${repoApi}/git/ref/heads/${gitRefPath(branch)}`,
				token,
				{},
				"ref-read",
			);
			const parentSha = ref.object?.sha;
			if (!parentSha) {
				throw new GitHubBatchError("目标分支没有可用提交", 409, "ref-read");
			}

			const parent = await githubJson(
				fetchImpl,
				`${repoApi}/git/commits/${encodeURIComponent(parentSha)}`,
				token,
				{},
				"commit-read",
			);
			const baseTreeSha = parent.tree?.sha;
			if (!baseTreeSha) {
				throw new GitHubBatchError(
					"目标提交没有可用文件树",
					409,
					"commit-read",
				);
			}

			const baseTree = await githubJson(
				fetchImpl,
				`${repoApi}/git/trees/${encodeURIComponent(baseTreeSha)}?recursive=1`,
				token,
				{},
				"tree-read",
			);
			if (baseTree.truncated) {
				throw new GitHubBatchError(
					"仓库文件树过大且返回不完整，已停止批量提交",
					409,
					"tree-read",
				);
			}

			const existingPaths = new Set(
				Array.isArray(baseTree.tree)
					? baseTree.tree
							.map((entry) => entry?.path)
							.filter((path) => typeof path === "string")
					: [],
			);
			const resolved = resolveBatchPaths(items, existingPaths);
			const blobs = await Promise.all(
				resolved.map((item) =>
					githubJson(
						fetchImpl,
						`${repoApi}/git/blobs`,
						token,
						{
							method: "POST",
							body: JSON.stringify({
								content: item.text,
								encoding: "utf-8",
							}),
						},
						"blob-create",
					),
				),
			);

			const tree = await githubJson(
				fetchImpl,
				`${repoApi}/git/trees`,
				token,
				{
					method: "POST",
					body: JSON.stringify({
						base_tree: baseTreeSha,
						tree: resolved.map((item, index) => ({
							path: item.path,
							mode: "100644",
							type: "blob",
							sha: blobs[index].sha,
						})),
					}),
				},
				"tree-create",
			);

			const commit = await githubJson(
				fetchImpl,
				`${repoApi}/git/commits`,
				token,
				{
					method: "POST",
					body: JSON.stringify({
						message,
						tree: tree.sha,
						parents: [parentSha],
					}),
				},
				"commit-create",
			);

			await githubJson(
				fetchImpl,
				`${repoApi}/git/refs/heads/${gitRefPath(branch)}`,
				token,
				{
					method: "PATCH",
					body: JSON.stringify({ sha: commit.sha, force: false }),
				},
				"ref-update",
			);

			return {
				commitSha: commit.sha,
				items: resolved.map((item, index) => ({
					...item,
					sha: blobs[index].sha,
				})),
			};
		} catch (error) {
			lastError = error;
			const canRetry =
				error instanceof GitHubBatchError &&
				error.stage === "ref-update" &&
				(error.status === 409 || error.status === 422) &&
				attempt === 0;
			if (!canRetry) throw error;
		}
	}

	throw lastError ?? new Error("批量提交失败");
}

function validateBatchItems(items) {
	if (!Array.isArray(items) || items.length === 0) {
		return { error: "待提交内容不能为空" };
	}
	if (items.length > BATCH_LIMIT) {
		return { error: `每批最多提交 ${BATCH_LIMIT} 条内容` };
	}

	let totalBytes = 0;
	const normalized = [];
	for (const [index, item] of items.entries()) {
		const path = typeof item?.path === "string" ? item.path : "";
		if (
			!path.startsWith(CONTENT_PREFIX) ||
			path.includes("..") ||
			!/\.md$/i.test(path)
		) {
			return { error: `第 ${index + 1} 条内容路径不合法` };
		}
		if (typeof item.text !== "string") {
			return { error: `第 ${index + 1} 条内容缺少 Markdown` };
		}
		// 只认这两种，拼错/多传都退回 create；update 会跳过撞名后缀
		const mode = item.mode === "update" ? "update" : "create";
		totalBytes += new TextEncoder().encode(item.text).byteLength;
		normalized.push({
			path,
			text: item.text,
			mode,
			collectionId:
				typeof item.collectionId === "string" ? item.collectionId : "",
			label: typeof item.label === "string" ? item.label : "",
		});
	}
	if (totalBytes > BATCH_TOTAL_BYTES) {
		return { error: "本批内容超过 5MB，请拆成两批提交" };
	}
	return { items: normalized };
}

async function writeBatch(request, token) {
	const body = await readJson(request);
	if (!body) return json({ ok: false, message: "请求体不是合法 JSON" }, 400);

	const checked = validateBatchItems(body.items);
	if (checked.error) return json({ ok: false, message: checked.error }, 400);

	const branch =
		typeof body.branch === "string" && body.branch
			? body.branch
			: DEFAULT_BRANCH;
	const message =
		typeof body.message === "string" && body.message
			? body.message
			: `chore(content): 批量提交 ${checked.items.length} 条内容`;

	try {
		const result = await commitBatchFiles({
			token,
			branch,
			message,
			items: checked.items,
		});
		return json({ ok: true, ...result });
	} catch (error) {
		if (error instanceof GitHubBatchError) {
			return json({ ok: false, message: error.message }, error.status || 500);
		}
		return json({ ok: false, message: "批量提交失败，请稍后重试" }, 500);
	}
}

/* ---------------------------------------------------------------- 辅助 */

function isOwner(login, env) {
	if (typeof login !== "string") return false;
	return login.toLowerCase() === ownerLogin(env).toLowerCase();
}

/** 路径护栏：只放行内容目录，挡掉 `..` 之类的逃逸 */
function assertPath(path) {
	if (!path) return json({ ok: false, message: "缺少 path 参数" }, 400);
	if (path.includes(".."))
		return json({ ok: false, message: "path 不合法" }, 400);
	if (!path.startsWith(CONTENT_PREFIX)) {
		return json(
			{ ok: false, message: `只能编辑 ${CONTENT_PREFIX} 下的文件` },
			403,
		);
	}
	return null;
}

async function readJson(request) {
	try {
		return await request.json();
	} catch {
		return null;
	}
}

/** 把 GitHub 的状态码和消息原样透传，前端好按 409 / 422 分别处理 */
async function upstreamError(response) {
	let message = `GitHub 返回 HTTP ${response.status}`;
	try {
		const data = await response.json();
		if (data && typeof data.message === "string") message = data.message;
	} catch {
		// 非 JSON 响应（比如网关错误页），保留默认文案
	}
	return json({ ok: false, message }, response.status);
}

function githubHeaders(token) {
	return {
		Authorization: `Bearer ${token}`,
		Accept: "application/vnd.github+json",
		"X-GitHub-Api-Version": "2022-11-28",
		"User-Agent": "jojo-blog-editor",
	};
}

/** 路径里有中文（`src/content/动态/…`），必须逐段编码，否则 `/` 会被转义成 %2F */
function encodePath(path) {
	return path.split("/").map(encodeURIComponent).join("/");
}

/** GitHub 返回的 base64 是 UTF-8 字节流，atob 只认 latin1，中文要再过一层 */
function base64ToText(base64) {
	const binary = atob(base64.replace(/\s/g, ""));
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
	return new TextDecoder().decode(bytes);
}

function textToBase64(text) {
	const bytes = new TextEncoder().encode(text);
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary);
}

function failure(origin, reason, returnTo = "/") {
	return redirect(siteUrl(origin, returnTo, { auth: "error", reason }), [
		serializeCookie(COOKIE_STATE, "", { maxAge: 0 }),
	]);
}

/** 环境变量没配齐：返回 501，前端据此显示「还没配 GitHub OAuth」而不是白屏 */
function notConfigured() {
	return json(
		{
			ok: false,
			message:
				"还没配 GitHub OAuth：请在 Worker 的 Variables and Secrets 里填 GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET",
		},
		501,
	);
}
