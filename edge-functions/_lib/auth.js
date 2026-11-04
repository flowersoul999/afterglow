/**
 * 边缘函数共享工具：Cookie 读写、令牌信封加密、JSON 响应、GitHub 请求头。
 *
 * 这不是路由文件（没有导出 onRequest），放在 `_lib/` 只是为了避免和 `api/`
 * 下的真实端点混在一起。
 *
 * 运行时是 V8 边缘（ES2023 + Web API）：**没有** Node 内置模块、没有 npm 包、
 * 没有 `Response.json()`，所以 base64 走 btoa/atob、加解密走 Web Crypto。
 */

/** 登录态 Cookie。HttpOnly，页面里的脚本读不到它 */
export const COOKIE_TOKEN = "jojo_editor";
/** OAuth 中途态 Cookie，只在「点登录 → 从 GitHub 回来」这几十秒内存活 */
export const COOKIE_STATE = "jojo_oauth_state";

/** 仓库坐标 */
export const REPO_OWNER = "flowersoul999";
export const REPO_NAME = "afterglow";
export const DEFAULT_BRANCH = "main";

/** 只有这个人能登录，其它 GitHub 账号授权后一律拒绝 */
export const ALLOWED_LOGIN = "flowersoul999";

/**
 * 只申请 `public_repo`：这个仓库是公开的，够 push 就行。
 * 不申请 `repo`，免得自动拿到该账号全部私有仓库的读写权。
 */
export const OAUTH_SCOPE = "public_repo";

/* ------------------------------------------------------------------ 配置 */

/**
 * 读环境变量（EdgeOne Pages 控制台的「环境变量」里配）。
 *
 * `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`：GitHub OAuth App 的那一对。
 * `SITE_ORIGIN`：站点正式域名，用来拼 `redirect_uri`，必须和 OAuth App 里
 *   填的 Callback URL 完全一致，否则 GitHub 会直接报 redirect_uri_mismatch。
 * `AUTH_SECRET`：可选。不配时用 client_secret 派生 Cookie 加密密钥 ——
 *   少一个必填项就少一处配错的机会。
 */
export function readConfig(env) {
	const clientId =
		typeof env.GITHUB_CLIENT_ID === "string" ? env.GITHUB_CLIENT_ID.trim() : "";
	const clientSecret =
		typeof env.GITHUB_CLIENT_SECRET === "string"
			? env.GITHUB_CLIENT_SECRET.trim()
			: "";
	const siteOrigin = String(env.SITE_ORIGIN || "https://jojocode.cn").replace(
		/\/+$/,
		"",
	);
	const secret = String(env.AUTH_SECRET || clientSecret);

	return {
		clientId,
		clientSecret,
		siteOrigin,
		secret,
		configured: clientId !== "" && clientSecret !== "" && secret !== "",
		/** GitHub OAuth App 里必须一字不差地填这个地址 */
		redirectUri: `${siteOrigin}/api/auth/callback`,
	};
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
 * Cookie 里装的是 GitHub token，虽然 HttpOnly 挡得住脚本，但 Cookie 本身
 * 在浏览器里是明文可见的（用户自己 / 插件 / 抓包）。所以先 AES-GCM 封一层，
 * 密钥由 secret 经 SHA-256 派生 —— 拿不到 secret 就解不开，也改不了。
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

/** 明文 → base64url(iv ‖ 密文)；iv 每次随机，同样的输入不会得到同样的输出 */
export async function seal(secret, plain) {
	if (!secret) throw new Error("缺少 Cookie 加密密钥");
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

/** `seal` 的逆操作；密钥换过或 Cookie 被改过都会在这里抛错 */
export async function unseal(secret, token) {
	if (!secret || !token) throw new Error("没有可解密的内容");
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
export function randomState() {
	return toBase64Url(crypto.getRandomValues(new Uint8Array(16)));
}

/* ---------------------------------------------------------------- Cookie */

export function readCookie(request, name) {
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
 * Lax 允许带上 Cookie；换成 Strict 就会丢 state，回来永远对不上。
 */
export function serializeCookie(name, value, options = {}) {
	const parts = [`${name}=${value}`, `Path=${options.path || "/"}`];
	if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
	parts.push("HttpOnly", "SameSite=Lax");
	if (options.secure !== false) parts.push("Secure");
	return parts.join("; ");
}

/** 读登录态；没登录、密钥对不上、Cookie 被篡改，一律返回 null */
export async function readSession(request, config) {
	const raw = readCookie(request, COOKIE_TOKEN);
	if (!raw || !config.secret) return null;
	try {
		const data = JSON.parse(await unseal(config.secret, raw));
		if (!data || typeof data.token !== "string" || data.token === "")
			return null;
		return data;
	} catch {
		return null;
	}
}

/* ---------------------------------------------------------------- 响应 */

export function json(data, status = 200, extraHeaders = {}) {
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
export function redirect(location, cookies = []) {
	const response = new Response(null, {
		status: 302,
		headers: { Location: location, "Cache-Control": "no-store" },
	});
	for (const cookie of cookies) response.headers.append("Set-Cookie", cookie);
	return response;
}

/** 站内跳转拼参数（`returnTo` 可能自带 query，不能直接字符串相加） */
export function siteUrl(origin, path, params = {}) {
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
 * 挡的是 `//evil.com` 这种「协议相对 URL」——浏览器会当成外域，等于开放重定向。
 */
export function safeReturnTo(value) {
	if (typeof value !== "string" || value === "") return "/";
	if (!value.startsWith("/") || value.startsWith("//")) return "/";
	return value;
}

/* ------------------------------------------------------------ GitHub */

export function githubHeaders(token) {
	return {
		Authorization: `Bearer ${token}`,
		Accept: "application/vnd.github+json",
		"X-GitHub-Api-Version": "2022-11-28",
		"User-Agent": "jojo-blog-editor",
	};
}

/** 路径里有中文（`src/content/动态/…`），必须逐段编码，否则 `/` 会被转义成 %2F */
export function encodePath(path) {
	return path
		.split("/")
		.map((segment) => encodeURIComponent(segment))
		.join("/");
}
