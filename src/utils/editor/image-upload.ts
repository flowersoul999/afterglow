/**
 * 说说图片上传
 *
 * 图片最终落在仓库 `src/content/动态/assets/diary/`，正文里写成
 * `![](assets/diary/xxx.webp)` —— 这是 2026-10 迁移后的既有约定，
 * MomentCard 和 moments.astro 的 `parseImages` 都按这个前缀去找资源。
 *
 * 为什么压成 webp：仓库里已经有 `assets/diary/1787915818797-4cmeaq.webp`
 * 这种命名，说明作者本来就吃 webp。手机直出 4~6MB 的 jpg 直接进 git，
 * 几百条之后仓库就废了，所以在浏览器里先缩到长边 1920 再上传。
 *
 * 动图（gif）和矢量图（svg）不重绘：canvas 只会拿到第一帧或糊掉。
 */

import { ALBUM_ASSET_ROOT } from "./album-serializer";
import { writeBlob } from "./github-client";
import { MOMENT_DIR } from "./moment-serializer";
import { STATUS_ROOT, writePrivateBlob } from "./private-client";
import { dayKey, thumbOf } from "./status-serializer";

/** 图片目录（相对仓库根），与 MOMENT_DIR 同源 */
const ASSET_DIR: string = `${MOMENT_DIR}assets/`;
/** 正文里引用的相对前缀：`assets/diary/xxx.webp` */
const PUBLIC_PREFIX = "assets/diary/";

/** 长边上限，超过就等比缩 */
const MAX_EDGE = 1920;
/** webp 质量，0.86 在肉眼无损和体积之间比较稳 */
const QUALITY = 0.86;
/** 与 Worker 的 8MB 上限对齐，提前拦一次省一个失败的请求 */
const MAX_BYTES = 8 * 1024 * 1024;

/** 状态照片：长边 1600 已足够看清体态变化，单张约 150~250KB */
const STATUS_MAX_EDGE = 1600;
const STATUS_QUALITY = 0.82;
/** 时间轴缩略图：滚进视口才加载，单张 20~40KB，一天一组也就百来 KB */
const THUMB_MAX_EDGE = 480;
const THUMB_QUALITY = 0.72;

function extensionOf(name: string, type: string): string {
	const matched = name.match(/\.([a-z0-9]+)$/i);
	if (matched?.[1]) return matched[1].toLowerCase();
	const sub = type.split("/")[1] ?? "";
	return /^[a-z0-9]+$/i.test(sub) ? sub.toLowerCase() : "png";
}

function randomSuffix(): string {
	// 与仓库里既有的 `1787915818797-4cmeaq` 同风格：时间戳 + 随机小串
	return Math.random().toString(36).slice(2, 8);
}

/** 重绘成 webp；失败或不需要处理时退回原文件 */
async function shrinkTo(
	file: File,
	maxEdge: number,
	quality: number,
): Promise<{ blob: Blob; ext: string }> {
	const passthrough = { blob: file, ext: extensionOf(file.name, file.type) };
	if (file.type === "image/gif" || file.type === "image/svg+xml")
		return passthrough;

	try {
		const bitmap = await createImageBitmap(file);
		const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
		const width = Math.max(1, Math.round(bitmap.width * scale));
		const height = Math.max(1, Math.round(bitmap.height * scale));

		const canvas = document.createElement("canvas");
		canvas.width = width;
		canvas.height = height;
		const context = canvas.getContext("2d");
		if (!context) throw new Error("画布不可用");
		context.drawImage(bitmap, 0, 0, width, height);
		bitmap.close();

		const blob = await new Promise<Blob | null>((resolve) => {
			canvas.toBlob(resolve, "image/webp", quality);
		});
		if (!blob) throw new Error("转换失败");
		return { blob, ext: "webp" };
	} catch {
		// Safari 老版本没有 createImageBitmap、或者浏览器禁了 canvas，
		// 这时候宁可传原图也不要让上传整个失败
		return passthrough;
	}
}

async function shrink(file: File): Promise<{ blob: Blob; ext: string }> {
	return shrinkTo(file, MAX_EDGE, QUALITY);
}

function toBase64(blob: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result ?? ""));
		reader.onerror = () => reject(new Error("读取图片失败"));
		reader.readAsDataURL(blob);
	});
}

/**
 * 上传一张图片，返回正文里要写的相对路径。
 *
 * 抛错时由调用方（抽屉 / 后台）统一显示在表单里 —— 一张图失败不该中断整条
 * 内容，所以调用方是逐张 catch 的。
 */
export async function uploadMomentImage(
	file: File,
	branch: string,
): Promise<string> {
	return uploadBodyImage(file, branch, MOMENT_IMAGE_TARGET);
}

/** 正文图片区的上传目标，与 `src/config/admin-collections.ts` 的 mediaInBody 同形 */
export interface BodyImageTarget {
	/** 上传落点：相对仓库根、结尾带斜杠 */
	dir: string;
	/** 正文里引用的相对前缀：相对 md 所在目录、结尾带斜杠 */
	refPrefix: string;
}

/** 说说图片的落点，2026-10 迁移后一直没变 */
const MOMENT_IMAGE_TARGET: BodyImageTarget = {
	dir: `${ASSET_DIR}diary/`,
	refPrefix: PUBLIC_PREFIX,
};

/**
 * 通用的「正文配图」上传：压缩成 webp 写进指定目录，返回正文里该写的相对路径。
 *
 * 抽屉和后台共用这一份 —— 两边的差别只有落点，压缩、大小限制、命名风格不该
 * 各写一遍，否则迟早一边改成 1920 另一边还是原图。
 */
export async function uploadBodyImage(
	file: File,
	branch: string,
	target: BodyImageTarget,
): Promise<string> {
	if (!file.type.startsWith("image/")) {
		throw new Error(`${file.name} 不是图片`);
	}
	if (file.size > MAX_BYTES) {
		throw new Error(`${file.name} 超过 8MB，请先压缩`);
	}

	const { blob, ext } = await shrink(file);
	const name = `${Date.now()}-${randomSuffix()}.${ext}`;
	// 配置表里带不带结尾斜杠都行，这里统一成一段
	const dir = `${target.dir.replace(/\/+$/u, "")}/`;

	await writeBlob({
		path: `${dir}${name}`,
		base64: await toBase64(blob),
		message: `chore(moments): 上传图片 ${name}`,
		branch,
	});

	return `${target.refPrefix}${name}`;
}

/** 相册图片对外引用的前缀：`/assets/images/albums/<folder>/xxx.webp` */
const ALBUM_PUBLIC_PREFIX = "/assets/images/albums/";

/**
 * 上传一张相册照片，返回 json 里要写的 src。
 *
 * 与说说图片的唯一差别是落点和返回值形态：相册吃的是 `public/` 下带前导
 * 斜杠的绝对路径（schema 的 publicOrRemoteImage 只认 `/` 或 `http`），
 * 说说吃的是相对 `动态/` 的 `assets/diary/` 前缀。
 *
 * `folder` 由调用方给（albumUploadFolder），这里再兜一层，防止拼出 `../`。
 */
export async function uploadAlbumImage(
	file: File,
	folder: string,
	branch: string,
): Promise<string> {
	if (!file.type.startsWith("image/")) {
		throw new Error(`${file.name} 不是图片`);
	}
	if (file.size > MAX_BYTES) {
		throw new Error(`${file.name} 超过 8MB，请先压缩`);
	}

	const safeFolder = folder.replace(/[^\w-]/g, "") || "album";
	const { blob, ext } = await shrink(file);
	const name = `${Date.now()}-${randomSuffix()}.${ext}`;

	await writeBlob({
		path: `${ALBUM_ASSET_ROOT}${safeFolder}/${name}`,
		base64: await toBase64(blob),
		message: `chore(album): 上传照片 ${name}`,
		branch,
	});

	return `${ALBUM_PUBLIC_PREFIX}${safeFolder}/${name}`;
}

/** 一天一组照片的上传结果 */
export interface StatusUpload {
	/** 相对 `status/` 的原图路径，写进 json 的 photos */
	src: string;
	/** 缩略图路径；gif/svg 没有缩略图，等于 src */
	thumb: string;
}

/** 状态照片上传的月份目录：`assets/2026-11/` */
function statusFolderOf(date: string): string {
	const month = /^\d{4}-\d{2}/.test(date)
		? date.slice(0, 7)
		: dayKey().slice(0, 7);
	return `assets/${month}/`;
}

/**
 * 上传一张状态照片，返回原图与缩略图两条相对路径。
 *
 * 跟说说、相册的图片相比，这里是**一次传两张**：
 * - 原图长边 1600，点开看细节用；
 * - 缩略图长边 480，时间轴上一天一列地铺，缩到 480 才滚得动。
 *
 * 两张都落私有仓库（`status/assets/月份/`），所以走 writePrivateBlob 而不是
 * writeBlob —— 后者写的是博客主仓。
 *
 * ⚠️ 调用方必须**串行**上传同一天的多张照片。GitHub Contents API 不支持对
 * 同一分支并发提交，第二张起会因非快进而报 422（§25 踩过同样的坑）。
 */
export async function uploadStatusPhoto(
	file: File,
	date: string,
): Promise<StatusUpload> {
	if (!file.type.startsWith("image/")) {
		throw new Error(`${file.name} 不是图片`);
	}
	if (file.size > MAX_BYTES) {
		throw new Error(`${file.name} 超过 8MB，请先压缩`);
	}

	const folder = statusFolderOf(date);
	const stamp = `${Date.now()}-${randomSuffix()}`;

	const main = await shrinkTo(file, STATUS_MAX_EDGE, STATUS_QUALITY);
	const name = `${stamp}.${main.ext}`;
	await writePrivateBlob({
		path: `${STATUS_ROOT}/${folder}${name}`,
		base64: await toBase64(main.blob),
		message: `chore(status): 上传照片 ${date} ${name}`,
	});

	const src = `${folder}${name}`;

	// 没重绘成 webp 的情况只有两种：gif/svg 原样直传、或者浏览器画不动 canvas
	// 退回了原图。这两种都别生成缩略图 —— 内容跟原图一样，白白多占一份仓库。
	if (main.ext !== "webp" || thumbOf(src) === src) return { src, thumb: src };

	const small = await shrinkTo(file, THUMB_MAX_EDGE, THUMB_QUALITY);
	const thumbName = `${stamp}-thumb.${small.ext}`;
	await writePrivateBlob({
		path: `${STATUS_ROOT}/${folder}${thumbName}`,
		base64: await toBase64(small.blob),
		message: `chore(status): 上传缩略图 ${date} ${thumbName}`,
	});

	return { src, thumb: `${folder}${thumbName}` };
}
