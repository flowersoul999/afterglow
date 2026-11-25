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
async function shrink(file: File): Promise<{ blob: Blob; ext: string }> {
	const passthrough = { blob: file, ext: extensionOf(file.name, file.type) };
	if (file.type === "image/gif" || file.type === "image/svg+xml") return passthrough;

	try {
		const bitmap = await createImageBitmap(file);
		const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
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
			canvas.toBlob(resolve, "image/webp", QUALITY);
		});
		if (!blob) throw new Error("转换失败");
		return { blob, ext: "webp" };
	} catch {
		// Safari 老版本没有 createImageBitmap、或者浏览器禁了 canvas，
		// 这时候宁可传原图也不要让上传整个失败
		return passthrough;
	}
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
 * 抛错时由调用方（抽屉）统一显示在表单里 —— 一张图失败不该中断整条说说，
 * 所以调用方是逐张 catch 的。
 */
export async function uploadMomentImage(
	file: File,
	branch: string,
): Promise<string> {
	if (!file.type.startsWith("image/")) {
		throw new Error(`${file.name} 不是图片`);
	}
	if (file.size > MAX_BYTES) {
		throw new Error(`${file.name} 超过 8MB，请先压缩`);
	}

	const { blob, ext } = await shrink(file);
	const name = `${Date.now()}-${randomSuffix()}.${ext}`;

	await writeBlob({
		path: `${ASSET_DIR}diary/${name}`,
		base64: await toBase64(blob),
		message: `chore(moments): 上传图片 ${name}`,
		branch,
	});

	return `${PUBLIC_PREFIX}${name}`;
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
