/**
 * 站长在线编辑 —— GitHub Contents API 的浏览器侧封装
 *
 * 站点是纯静态的，内容都躺在仓库里。所谓「在线改内容」，本质是改仓库文件 +
 * 让 GitHub Actions 重新构建 GitHub Pages，所以**改动不会立刻上线**，构建跑完
 * 才可见。这个限制由站点架构决定，前端只能如实提示，不能假装实时。
 *
 * 本模块只做四件事：取登录态、读文件（连 sha）、写文件、删文件。
 *
 * 注意它**不再直接打 api.github.com**：GitHub 的 token 端点不支持跨域、
 * 换 token 又需要 client_secret，所以登录和写操作都经由 Cloudflare Worker
 * 中转，token 存在 HttpOnly Cookie 里，页面脚本根本读不到。
 */

/** Cloudflare Worker 代理前缀（见 cloudflare-worker/index.js） */
const GITHUB_PROXY = "/api/github";
const AUTH_BASE = "/api/auth";

/** 仓库坐标：内容就提交到这里，GitHub Actions 会据此构建 Pages */
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

/** 目录枚举结果：一层 */
export interface RepoEntry {
	name: string;
	path: string;
	type: "file" | "dir";
	sha: string;
	size: number;
}

export interface WriteOptions {
	path: string;
	text: string;
	message: string;
	branch: string;
	/** 更新已有文件时必须带上，缺了会被 GitHub 当成「新建」而报 422 */
	sha?: string;
}

export interface BatchWriteItem {
	path: string;
	text: string;
	collectionId: string;
	label: string;
}

export interface BatchWriteResultItem extends Omit<BatchWriteItem, "text"> {
	sha: string;
}

export interface BatchWriteResult {
	commitSha: string;
	items: BatchWriteResultItem[];
}

/**
 * 带 HTTP 状态码的错误，调用方据此区分「登录失效」「文件被改动」「服务没部署」。
 *
 * - 401：Cookie 过期或被清掉，重新登录即可
 * - 404：Worker 路由或接口版本不匹配，优先检查是否部署了最新 `cloudflare-worker/index.js`
 * - 501：边缘函数在，但环境变量没配齐
 */
export class EditorApiError extends Error {
	public readonly status: number;

	constructor(message: string, status: number) {
		super(message);
		this.name = "EditorApiError";
		this.status = status;
	}
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
 * 取当前登录态。
 * 未登录会抛 401 —— 那是常态，调用方静默处理即可，别弹错误。
 */
export async function fetchSession(): Promise<EditorIdentity> {
	const response = await fetch(`${AUTH_BASE}/me`, {
		credentials: "same-origin",
		cache: "no-store",
	});

	if (!response.ok) {
		throw new EditorApiError(await readError(response), response.status);
	}

	const data = (await response.json()) as {
		login?: string;
		name?: string;
		avatar?: string;
		branch?: string;
	};

	return {
		login: data.login ?? REPO_OWNER,
		name: data.name ?? data.login ?? REPO_OWNER,
		avatar: data.avatar ?? "",
		defaultBranch: data.branch ?? "main",
	};
}

/**
 * 探测登录接口在不在，顺便把「为什么不能登录」说清楚。
 *
 * 直接 `location.href = "/api/auth/login"` 在函数没部署时会跳到 404 页面，
 * 用户看到的是空白页，排查成本极高。所以先探一次：正常情况服务端会 302
 * （`redirect: "manual"` 下变成 opaqueredirect，status 为 0），异常则
 * 能读到具体的状态码。
 */
export async function probeLoginService(): Promise<{
	ok: boolean;
	message: string;
}> {
	try {
		const response = await fetch(`${AUTH_BASE}/login`, {
			redirect: "manual",
			cache: "no-store",
			credentials: "same-origin",
		});

		if (response.status === 0 || response.type === "opaqueredirect") {
			return { ok: true, message: "" };
		}
		if (response.status === 404) {
			// 文案要短：弹窗就 26rem 宽，太长会折成三行把下面的说明挤乱。
			// 完整的排查步骤在 docs/deploy-edgeone-pages.md 第二节之 5。
			return { ok: false, message: "登录服务未部署：/api/auth 返回 404" };
		}
		if (response.status === 501) {
			return { ok: false, message: await readError(response) };
		}
		return { ok: false, message: `登录服务返回 HTTP ${response.status}` };
	} catch {
		return { ok: false, message: "连不上登录服务，检查网络后重试" };
	}
}

/** 跳到 GitHub 授权页（整页导航，不返回） */
export function gotoLogin(returnTo: string): void {
	const target = new URL(`${AUTH_BASE}/login`, window.location.origin);
	target.searchParams.set("return", returnTo);
	window.location.href = target.toString();
}

/** 退出登录：让服务端把 HttpOnly Cookie 清掉（前端自己是删不掉的） */
export async function logoutSession(): Promise<void> {
	await fetch(`${AUTH_BASE}/logout`, {
		method: "POST",
		credentials: "same-origin",
		cache: "no-store",
	});
}

/** 列一层目录。目录不存在时返回空数组（新集合还没建文件是常态） */
export async function listDir(
	path: string,
	branch: string,
): Promise<RepoEntry[]> {
	const query = new URLSearchParams({ path, ref: branch });
	const response = await fetch(`${GITHUB_PROXY}/tree?${query.toString()}`, {
		credentials: "same-origin",
		cache: "no-store",
	});

	if (!response.ok) {
		throw new EditorApiError(await readError(response), response.status);
	}

	const data = (await response.json()) as { entries?: RepoEntry[] };
	return data.entries ?? [];
}

/** 读文件；不存在时返回 null（用来区分「新建」和「改」） */
export async function readFile(
	path: string,
	branch: string,
): Promise<RepoFile | null> {
	const query = new URLSearchParams({ path, ref: branch });
	const response = await fetch(`${GITHUB_PROXY}/file?${query.toString()}`, {
		credentials: "same-origin",
		cache: "no-store",
	});

	if (!response.ok) {
		throw new EditorApiError(await readError(response), response.status);
	}

	const data = (await response.json()) as { file?: RepoFile | null };
	return data.file ?? null;
}

/** 写文件。返回新内容的 sha，供后续操作（比如连改两次）使用 */
export async function writeFile(options: WriteOptions): Promise<string> {
	const response = await fetch(`${GITHUB_PROXY}/file`, {
		method: "PUT",
		credentials: "same-origin",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(options),
	});

	if (!response.ok) {
		throw new EditorApiError(await readError(response), response.status);
	}

	const data = (await response.json()) as { sha?: string };
	return data.sha ?? "";
}

/** 把多条新内容合成一个 Git 提交。 */
export async function writeBatch(options: {
	items: BatchWriteItem[];
	message: string;
	branch: string;
}): Promise<BatchWriteResult> {
	const response = await fetch(`${GITHUB_PROXY}/batch`, {
		method: "POST",
		credentials: "same-origin",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(options),
	});

	if (!response.ok) {
		throw new EditorApiError(await readError(response), response.status);
	}

	const data = (await response.json()) as Partial<BatchWriteResult>;
	return {
		commitSha: data.commitSha ?? "",
		items: Array.isArray(data.items) ? data.items : [],
	};
}

/** 删文件。GitHub 的删除接口强制要求 sha，传错会给 409 */
export async function deleteFile(options: {
	path: string;
	message: string;
	branch: string;
	sha: string;
}): Promise<void> {
	const response = await fetch(`${GITHUB_PROXY}/file`, {
		method: "DELETE",
		credentials: "same-origin",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(options),
	});

	if (!response.ok) {
		throw new EditorApiError(await readError(response), response.status);
	}
}
