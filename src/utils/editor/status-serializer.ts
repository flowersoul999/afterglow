/**
 * 「我的状态」记录的读写转换
 *
 * 一天一条：`status/2026-11-24.json`，住在**私有仓库**里，不进博客构建。
 * 结构刻意做薄 —— 这一版只要照片，所以只有 date 和 photos 两个键：
 *
 * ```json
 * {
 * 	"date": "2026-11-24",
 * 	"photos": ["assets/2026-11/1763999999999-a1b2c3.webp"]
 * }
 * ```
 *
 * `photos` 里存的是**相对 `status/` 的路径**，不是 `/api/...` 也不是绝对
 * 路径 —— 换仓库、换域名、以后想公开某一天，这个值都不用改。
 *
 * 和 album-serializer 一样守住一条铁律：不认识的键原样留着。以后要加
 * 体重、备注这类字段，加在 json 里不会因为编辑器还没做输入框就被吃掉。
 */

import { STATUS_ROOT } from "./private-client";

export interface StatusRecord {
	/** `YYYY-MM-DD`，同时也是文件名 */
	date: string;
	/** 相对 `status/` 的照片路径，按拍摄顺序 */
	photos: string[];
	/** 本编辑器不认识的顶层键，原样保留 */
	extra: Record<string, unknown>;
}

const KNOWN_KEYS = new Set(["date", "photos"]);

/** 状态文件的仓库路径 */
export function statusPath(date: string): string {
	return `${STATUS_ROOT}/${date}.json`;
}

/** 照片相对路径 → 私有仓库里的完整路径（喂给 statusPhotoUrl） */
export function statusFullPath(relative: string): string {
	return `${STATUS_ROOT}/${relative.replace(/^\/+/, "")}`;
}

/**
 * 本地时区的 `YYYY-MM-DD`。
 *
 * 不能用 `toISOString().slice(0, 10)`：那是 UTC，中国时区晚上 8 点之后
 * 会算成第二天，睡前拍的照片就会被记到明天。
 */
export function dayKey(date: Date = new Date()): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

/** 从文件名提日期：`2026-11-24.json` → `2026-11-24`；不合规返回空串 */
export function statusDateFromName(name: string): string {
	const matched = name.match(/^(\d{4}-\d{2}-\d{2})\.json$/);
	return matched?.[1] ?? "";
}

/**
 * 缩略图的命名约定：`xxx.webp` → `xxx-thumb.webp`，与原图**同目录**。
 *
 * 不把缩略图路径写进 json 是刻意的 —— 多一个字段就要多一套「某张图没有
 * 缩略图怎么办」的分支。约定由上传器产、由展示端推导，json 保持干净。
 * gif / svg 不生成缩略图，直接返回原路径。
 */
export function thumbOf(relative: string): string {
	if (!/\.(webp|jpe?g|png)$/i.test(relative)) return relative;
	return relative.replace(/\.([a-z0-9]+)$/i, "-thumb.$1");
}

export function emptyStatus(date: string): StatusRecord {
	return { date, photos: [], extra: {} };
}

/** json 原文 → 记录。解析失败时抛出，由界面显示成人话 */
export function parseStatus(raw: string, fallbackDate: string): StatusRecord {
	let data: Record<string, unknown>;
	try {
		const parsed: unknown = JSON.parse(raw);
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
			throw new Error("不是一个对象");
		}
		data = parsed as Record<string, unknown>;
	} catch (error) {
		throw new Error(
			`状态记录不是合法的 JSON：${error instanceof Error ? error.message : String(error)}`,
		);
	}

	const record: StatusRecord = {
		date:
			typeof data.date === "string" && data.date.trim()
				? data.date.trim().slice(0, 10)
				: fallbackDate,
		photos: Array.isArray(data.photos)
			? data.photos.filter(
					(item): item is string => typeof item === "string" && item !== "",
				)
			: [],
		extra: {},
	};

	for (const key of Object.keys(data)) {
		if (!KNOWN_KEYS.has(key)) record.extra[key] = data[key];
	}

	return record;
}

/** 记录 → json 原文。字段顺序固定，缩进沿用仓库里的 tab */
export function serializeStatus(record: StatusRecord): string {
	const payload: Record<string, unknown> = {
		date: record.date,
		photos: record.photos,
	};
	Object.assign(payload, record.extra);
	return `${JSON.stringify(payload, null, "\t")}\n`;
}
