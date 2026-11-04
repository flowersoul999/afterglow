/**
 * GitHub OAuth 登录接口（EdgeOne Pages 边缘函数）
 *
 *   GET  /api/auth/login     生成 state → 302 到 GitHub 授权页
 *   GET  /api/auth/callback  拿 code 换 token → 校验站长 → 下发 HttpOnly Cookie
 *   GET  /api/auth/me        当前登录态（未登录 401）
 *   POST /api/auth/logout    清 Cookie
 *
 * 为什么必须有服务端：GitHub 的 token 端点不支持跨域，且换 token 需要
 * `client_secret`。secret 只能待在服务端，所以纯静态站必须借边缘函数中转。
 * 换回来的 token 塞进 HttpOnly Cookie，前端 JS 永远拿不到它。
 *
 * 运行时限制：CPU 200ms（不含 I/O）、请求体 1MB、无 Node API。
 */
import {
	ALLOWED_LOGIN,
	COOKIE_STATE,
	COOKIE_TOKEN,
	DEFAULT_BRANCH,
	githubHeaders,
	json,
	OAUTH_SCOPE,
	randomState,
	readConfig,
	readCookie,
	readSession,
	redirect,
	safeReturnTo,
	seal,
	serializeCookie,
	siteUrl,
	unseal,
} from "../../_lib/auth.js";

/** 登录态保持 30 天；GitHub token 不过期，Cookie 过期即视为登出 */
const TOKEN_MAX_AGE = 60 * 60 * 24 * 30;
/** state 只要撑过一次授权往返，给 10 分钟 */
const STATE_MAX_AGE = 60 * 10;

export default async function onRequest(context) {
	const action = context.params.action;
	if (action === "login") return login(context);
	if (action === "callback") return callback(context);
	if (action === "me") return me(context);
	if (action === "logout") return logout(context);
	return json({ ok: false, message: "未知的认证接口" }, 404);
}

/* ------------------------------------------------------------------ 登录 */

async function login(context) {
	const config = readConfig(context.env);
	if (!config.configured) return notConfigured();

	const url = new URL(context.request.url);
	const returnTo = safeReturnTo(url.searchParams.get("return") ?? "/");
	const state = randomState();
	// state 和「登录完回哪一页」一起封进 Cookie，回调时比对，顺便把 returnTo 带回来
	const pending = await seal(
		config.secret,
		JSON.stringify({ state, returnTo }),
	);

	const authorize = new URL("https://github.com/login/oauth/authorize");
	authorize.searchParams.set("client_id", config.clientId);
	authorize.searchParams.set("redirect_uri", config.redirectUri);
	authorize.searchParams.set("scope", OAUTH_SCOPE);
	authorize.searchParams.set("state", state);
	authorize.searchParams.set("allow_signup", "false");

	return redirect(authorize.toString(), [
		serializeCookie(COOKIE_STATE, pending, { maxAge: STATE_MAX_AGE }),
	]);
}

/* ---------------------------------------------------------------- 回调 */

async function callback(context) {
	const config = readConfig(context.env);
	if (!config.configured) return notConfigured();

	const url = new URL(context.request.url);

	// 用户在 GitHub 点了「取消」，回跳时带的是 error 而不是 code
	if (url.searchParams.get("error")) return failure(config, "denied");

	const code = url.searchParams.get("code") ?? "";
	const state = url.searchParams.get("state") ?? "";
	if (!code || !state) return failure(config, "state_missing");

	const rawPending = readCookie(context.request, COOKIE_STATE);
	if (!rawPending) return failure(config, "state_missing");

	let pending;
	try {
		pending = JSON.parse(await unseal(config.secret, rawPending));
	} catch {
		// Cookie 过期、密钥换过、被人改过都会走到这里
		return failure(config, "state_invalid");
	}
	const returnTo = safeReturnTo(pending?.returnTo ?? "/");
	if (!pending || pending.state !== state)
		return failure(config, "state_invalid", returnTo);

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
					client_id: config.clientId,
					client_secret: config.clientSecret,
					code,
					redirect_uri: config.redirectUri,
				}),
			},
		);
		if (exchange.ok) {
			const data = await exchange.json();
			if (typeof data.access_token === "string") token = data.access_token;
		}
	} catch {
		return failure(config, "exchange_failed", returnTo);
	}
	if (!token) return failure(config, "exchange_failed", returnTo);

	// 是不是站长，由 GitHub 自己的账号名说了算（前端说的不算）
	let user;
	try {
		const response = await fetch("https://api.github.com/user", {
			headers: githubHeaders(token),
		});
		if (!response.ok) return failure(config, "profile_failed", returnTo);
		user = await response.json();
	} catch {
		return failure(config, "profile_failed", returnTo);
	}

	if (!isOwner(user?.login)) {
		// 别人登录也要给个明确交代，别让人以为「点了没反应」
		return failure(config, "not_owner", returnTo);
	}

	// 身份一起封进 Cookie：/api/auth/me 就不用每次再打一轮 GitHub API
	const session = await seal(
		config.secret,
		JSON.stringify({
			token,
			login: user.login ?? ALLOWED_LOGIN,
			name: user.name || user.login || ALLOWED_LOGIN,
			avatar: user.avatar_url || "",
		}),
	);

	return redirect(siteUrl(config.siteOrigin, returnTo, { auth: "ok" }), [
		serializeCookie(COOKIE_TOKEN, session, { maxAge: TOKEN_MAX_AGE }),
		serializeCookie(COOKIE_STATE, "", { maxAge: 0 }),
	]);
}

/* ------------------------------------------------------------ 登录态 */

async function me(context) {
	const config = readConfig(context.env);
	const session = await readSession(context.request, config);
	if (!session) return json({ ok: false }, 401);

	return json({
		ok: true,
		login: session.login,
		name: session.name,
		avatar: session.avatar,
		branch: DEFAULT_BRANCH,
	});
}

/* ------------------------------------------------------------ 登出 */

async function logout() {
	return json({ ok: true }, 200, {
		"Set-Cookie": serializeCookie(COOKIE_TOKEN, "", { maxAge: 0 }),
	});
}

/* ------------------------------------------------------------ 辅助 */

function isOwner(login) {
	if (typeof login !== "string") return false;
	return login.toLowerCase() === ALLOWED_LOGIN.toLowerCase();
}

function failure(config, reason, returnTo = "/") {
	return redirect(
		siteUrl(config.siteOrigin, returnTo, { auth: "error", reason }),
		[serializeCookie(COOKIE_STATE, "", { maxAge: 0 })],
	);
}

/** 环境变量没配齐：返回 501，前端据此显示「站长还没配置 OAuth」而不是白屏 */
function notConfigured() {
	return json(
		{
			ok: false,
			message:
				"还没配 GitHub OAuth：请在 EdgeOne 环境变量填 GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET",
		},
		501,
	);
}
