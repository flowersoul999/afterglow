/**
 * 私有仓库通道 —— 「我的状态」专用
 *
 * 与 github-client.ts 的区别只有一处：这里的读写不落在博客主仓，而是落在
 * 一个独立的**私有仓库**（默认 flowersoul999/afterglow-private）。所以：
 *
 * 1. **不进构建链路**：状态数据不发文章、不进 sitemap，改动也就不会触发
 *    GitHub Actions —— 保存后立刻能看到，不用等那 1~3 分钟。
 * 2. **不用 OAuth token**：`public_repo` scope 碰不到私有仓库。Worker 用一枚
 *    只授这个仓库 Contents 权限的 fine-grained PAT（`PRIVATE_TOKEN`）代取。
 * 3. **图片也走 Worker**：私有仓库的图片拿不到公开直链，`<img>` 只能指向
 *    `/api/private/raw?path=...`，靠同源 Cookie 鉴权（见 `statusPhotoUrl`）。
 *
 * 路径一律相对仓库根，形如 `status/assets/2026-11/1763...-a1b2c3.webp`。
 */

import { EditorApiError, readError } from "./github-client";

/** Worker 上的私有通道前缀（见 cloudflare-worker/index.js） */
const PRIVATE_BASE = "/api/private";

/** 私有仓库里状态数据的根目录，与 Worker 的 PRIVATE_PREFIX 对齐 */
export const STATUS_ROOT = "status";

export interface PrivateFile {
	path: string;
	sha: string;
	text: string;
}

export interface PrivateEntry {
	name: string;
	path: string;
	type: "file" | "dir";
	sha: string;
	size: number;
}

/**
 * 图片的可用 URL。
 *
 * 刻意不回仓库路径而是拼一个接口地址：私有仓库的图片没有公开直链，
 * 任何绕过 Worker 的写法都会 404。文件名带时间戳 + 随机串且内容不变，
 * Worker 那边给了 `immutable` 长缓存，同一张图只会过网一次。
 */
export function statusPhotoUrl(path: string): string {
	return `${PRIVATE_BASE}/raw?path=${encodeURIComponent(path)}`;
}

/** 列一层目录。目录不存在时返回空数组 —— 「还没记录过任何一天」是常态 */
export async function listPrivateDir(path: string): Promise<PrivateEntry[]> {
	const query = new URLSearchParams({ path });
	const response = await fetch(`${PRIVATE_BASE}/tree?${query.toString()}`, {
		credentials: "same-origin",
		cache: "no-store",
	});

	if (!response.ok) {
		throw new EditorApiError(await readError(response), response.status);
	}

	const data = (await response.json()) as { entries?: PrivateEntry[] };
	return data.entries ?? [];
}

/** 读文件；不存在时返回 null（新建那天的记录走这条） */
export async function readPrivateFile(
	path: string,
): Promise<PrivateFile | null> {
	const query = new URLSearchParams({ path });
	const response = await fetch(`${PRIVATE_BASE}/file?${query.toString()}`, {
		credentials: "same-origin",
		cache: "no-store",
	});

	if (!response.ok) {
		throw new EditorApiError(await readError(response), response.status);
	}

	const data = (await response.json()) as { file?: PrivateFile | null };
	return data.file ?? null;
}

/** 写文本文件。返回新 sha，供「刚新建完接着改」用（缺 sha 会被当成新建而报 422） */
export async function writePrivateFile(options: {
	path: string;
	text: string;
	message: string;
	sha?: string;
}): Promise<string> {
	const response = await fetch(`${PRIVATE_BASE}/file`, {
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

/**
 * 写二进制（照片）。
 *
 * `base64` 可以带 `data:image/...;base64,` 前缀，服务端会剥掉。注意它和
 * writePrivateFile 是两条路：文本接口会把内容当 UTF-8 重编一次 base64，
 * 图片走那条必然裂图。
 */
export async function writePrivateBlob(options: {
	path: string;
	base64: string;
	message: string;
}): Promise<string> {
	const response = await fetch(`${PRIVATE_BASE}/blob`, {
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

/** 删文件。GitHub 的删除接口强制要求 sha */
export async function deletePrivateFile(options: {
	path: string;
	sha: string;
	message: string;
}): Promise<void> {
	const response = await fetch(`${PRIVATE_BASE}/file`, {
		method: "DELETE",
		credentials: "same-origin",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(options),
	});

	if (!response.ok) {
		throw new EditorApiError(await readError(response), response.status);
	}
}
