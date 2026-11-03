/**
 * 站长在线编辑 —— GitHub Contents API 的最小客户端
 *
 * 站点是纯静态的，内容都躺在仓库里。所谓「在线改内容」，本质是改仓库文件 +
 * 让 EdgeOne Pages 重新构建，所以**改动不会立刻上线**，构建跑完（1~3 分钟）
 * 才可见。这个限制由站点架构决定，前端只能如实提示，不能假装实时。
 *
 * 本模块只做四件事：校验令牌、读文件（连 sha）、写文件、删文件。
 * 令牌由 editor-store 保管，这里不碰任何存储，方便日后换成服务端代理。
 */

const API_BASE = "https://api.github.com";

/** 仓库坐标：内容就提交到这里，EdgeOne Pages 监听的也是它 */
export const REPO_OWNER: string = "flowersoul999";
export const REPO_NAME: string = "afterglow";

/** 内容根目录：所有集合都在 src/content/<中文目录>/ 下 */
export const CONTENT_ROOT: string = "src/content/";

export interface EditorIdentity {
	login: string;
	name: string;
	avatar: string;
	defaultBranch: string;
}

export interface RepoFile {
	path: string;
	sha: string;
	text: string;
}

export interface WriteOptions {
	path: string;
	text: string;
	message: string;
	branch: string;
	/** 更新已有文件时必须带上，缺了会被 GitHub 当成「新建」而报 422 */
	sha?: string;
}

/** 带 HTTP 状态码的错误，调用方据此区分「令牌失效」「文件被改动」等情况 */
export class EditorApiError extends Error {
	public readonly status: number;

	constructor(message: string, status: number) {
		super(message);
		this.name = "EditorApiError";
		this.status = status;
	}
}

/** 路径里带中文，必须逐段编码，否则 `/` 会被转义成 %2F 导致 404 */
function encodePath(path: string): string {
	return path
		.split("/")
		.map((segment) => encodeURIComponent(segment))
		.join("/");
}

function authHeaders(token: string): Record<string, string> {
	return {
		Authorization: `Bearer ${token}`,
		Accept: "application/vnd.github+json",
		"X-GitHub-Api-Version": "2022-11-28",
	};
}

/** GitHub 返回的 base64 是 UTF-8 字节流，atob 只认 latin1，中文要再过一层 */
function base64ToText(base64: string): string {
	const binary = atob(base64.replace(/\s/g, ""));
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i += 1) {
		bytes[i] = binary.charCodeAt(i);
	}
	return new TextDecoder().decode(bytes);
}

function textToBase64(text: string): string {
	const bytes = new TextEncoder().encode(text);
	let binary = "";
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary);
}

async function readError(response: Response): Promise<string> {
	try {
		const data = (await response.json()) as { message?: string };
		return data.message ?? `HTTP ${response.status}`;
	} catch {
		return `HTTP ${response.status}`;
	}
}

/**
 * 校验令牌并取回站长身份。
 *
 * 用 `GET /repos/:owner/:repo` 而不是 `/user` 是有意的：它同时能告诉我们
 * 令牌对**这个仓库**有没有写权限（permissions.push），顺带拿到默认分支名。
 */
export async function verifyToken(token: string): Promise<EditorIdentity> {
	const response = await fetch(`${API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}`, {
		headers: authHeaders(token),
	});

	if (!response.ok) {
		throw new EditorApiError(await readError(response), response.status);
	}

	const repo = (await response.json()) as {
		default_branch?: string;
		permissions?: { push?: boolean };
	};

	if (repo.permissions && repo.permissions.push !== true) {
		throw new EditorApiError("令牌对这个仓库没有写权限", 403);
	}

	// 仓库接口不带用户信息，再补一次 /user（失败不致命，只是头像缺省）
	let login = REPO_OWNER;
	let name = REPO_OWNER;
	let avatar = "";
	try {
		const userResponse = await fetch(`${API_BASE}/user`, {
			headers: authHeaders(token),
		});
		if (userResponse.ok) {
			const user = (await userResponse.json()) as {
				login?: string;
				name?: string;
				avatar_url?: string;
			};
			login = user.login ?? login;
			name = user.name ?? login;
			avatar = user.avatar_url ?? "";
		}
	} catch {
		// 头像拿不到不影响编辑，静默降级
	}

	return { login, name, avatar, defaultBranch: repo.default_branch ?? "main" };
}

/** 读文件；不存在时返回 null（用来区分「新建」和「改」） */
export async function readFile(
	token: string,
	path: string,
	branch: string,
): Promise<RepoFile | null> {
	const response = await fetch(
		`${API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${encodePath(path)}?ref=${encodeURIComponent(branch)}`,
		{ headers: authHeaders(token) },
	);

	if (response.status === 404) return null;
	if (!response.ok) {
		throw new EditorApiError(await readError(response), response.status);
	}

	const data = (await response.json()) as {
		content?: string;
		sha?: string;
		encoding?: string;
	};

	return {
		path,
		sha: data.sha ?? "",
		text:
			data.encoding === "base64" && data.content
				? base64ToText(data.content)
				: "",
	};
}

/** 写文件。返回新内容的 sha，供后续操作（比如连改两次）使用 */
export async function writeFile(
	token: string,
	options: WriteOptions,
): Promise<string> {
	const response = await fetch(
		`${API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${encodePath(options.path)}`,
		{
			method: "PUT",
			headers: {
				...authHeaders(token),
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				message: options.message,
				content: textToBase64(options.text),
				branch: options.branch,
				...(options.sha ? { sha: options.sha } : {}),
			}),
		},
	);

	if (!response.ok) {
		throw new EditorApiError(await readError(response), response.status);
	}

	const data = (await response.json()) as { content?: { sha?: string } };
	return data.content?.sha ?? "";
}

/** 删文件。GitHub 的删除接口强制要求 sha，传错会给 409 */
export async function deleteFile(
	token: string,
	options: { path: string; message: string; branch: string; sha: string },
): Promise<void> {
	const response = await fetch(
		`${API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${encodePath(options.path)}`,
		{
			method: "DELETE",
			headers: {
				...authHeaders(token),
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				message: options.message,
				sha: options.sha,
				branch: options.branch,
			}),
		},
	);

	if (!response.ok) {
		throw new EditorApiError(await readError(response), response.status);
	}
}
