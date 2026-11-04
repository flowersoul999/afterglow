/**
 * GitHub Contents API 代理（EdgeOne Pages 边缘函数）
 *
 *   GET    /api/github/file?path=…&ref=…   读文件（不存在时 `file: null`）
 *   PUT    /api/github/file                写文件 / 新建文件
 *   DELETE /api/github/file                删文件
 *
 * 为什么不让前端直接打 api.github.com：token 存在 HttpOnly Cookie 里，
 * 页面脚本读不到 —— 这是有意的。所有写操作都从这里过一道，顺带能做两件
 * 前端做不了的事：
 *   1. 强制只能改 `src/content/` 下的文件（拿不到 token 的人也能猜到 URL，
 *      但不能借这个代理改 workflow、改代码）；
 *   2. 请求体里塞 token 不会出现在浏览器控制台 / 网络面板里。
 */
import {
	DEFAULT_BRANCH,
	encodePath,
	githubHeaders,
	json,
	REPO_NAME,
	REPO_OWNER,
	readConfig,
	readSession,
} from "../../_lib/auth.js";

const API_BASE = "https://api.github.com";
/** 内容根目录：所有集合都在 src/content/<中文目录>/ 下 */
const CONTENT_PREFIX = "src/content/";

export default async function onRequest(context) {
	const config = readConfig(context.env);
	const session = await readSession(context.request, config);
	if (!session) return json({ ok: false, message: "未登录或登录已过期" }, 401);

	if (context.params.action !== "file") {
		return json({ ok: false, message: "未知接口" }, 404);
	}

	switch (context.request.method) {
		case "GET":
			return readFile(context, session.token);
		case "PUT":
			return writeFile(context, session.token);
		case "DELETE":
			return deleteFile(context, session.token);
		default:
			return json({ ok: false, message: "不支持的请求方法" }, 405);
	}
}

/* ------------------------------------------------------------------ 读 */

async function readFile(context, token) {
	const query = new URL(context.request.url).searchParams;
	const path = query.get("path") ?? "";
	const branch = query.get("ref") || DEFAULT_BRANCH;

	const invalid = assertPath(path);
	if (invalid) return invalid;

	const response = await fetch(
		`${API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${encodePath(path)}?ref=${encodeURIComponent(branch)}`,
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

/* ------------------------------------------------------------------ 写 */

async function writeFile(context, token) {
	const body = await readJson(context.request);
	if (!body) return json({ ok: false, message: "请求体不是合法 JSON" }, 400);

	const path = typeof body.path === "string" ? body.path : "";
	const invalid = assertPath(path);
	if (invalid) return invalid;

	const response = await fetch(
		`${API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${encodePath(path)}`,
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

/* ------------------------------------------------------------------ 删 */

async function deleteFile(context, token) {
	const body = await readJson(context.request);
	if (!body) return json({ ok: false, message: "请求体不是合法 JSON" }, 400);

	const path = typeof body.path === "string" ? body.path : "";
	const invalid = assertPath(path);
	if (invalid) return invalid;

	if (typeof body.sha !== "string" || body.sha === "") {
		return json({ ok: false, message: "删除文件必须带上 sha" }, 400);
	}

	const response = await fetch(
		`${API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${encodePath(path)}`,
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

/* ------------------------------------------------------------ 辅助 */

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
