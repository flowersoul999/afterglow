/**
 * 相册文件的读写转换
 *
 * 相册存在 `src/content/相册/<id>.json`（集合 loader 同时吃 md/mdx/json，
 * 但目前仓库里只有 json），所以这里不需要 YAML 那一套窄解析 —— 直接
 * JSON.parse / stringify 就够了，索引和注释都归浏览器管。
 *
 * 一条铁律：不认识的键原样留着。相册 schema 里有 cover / imgbedFolder
 * 这类编辑器暂不提供输入框的字段，丢掉就等于把作者的数据吃了。
 */

// 带 .ts 后缀是刻意的：这个模块有 node:test 单测（album-serializer.test.ts），
// 而 Node 的类型擦除不做后缀补全，写成 "./github-client" 会让单测直接
// ERR_MODULE_NOT_FOUND。tsconfig 里 allowImportingTsExtensions 是开着的。
import { CONTENT_ROOT } from "./github-client.ts";

/** 相册的集合目录（中文目录名，集合键是 album） */
export const ALBUM_DIR: string = `${CONTENT_ROOT}相册/`;

/** `public/` 下的相册图片根目录，上传时从这里往下拼 */
export const ALBUM_ASSET_ROOT: string = "public/assets/images/albums/";

/** 一张照片在 json 里的形态，与 content.config.ts 的 photos 项一一对应 */
export interface AlbumPhotoFile {
	src: string;
	alt: string;
	caption: string;
	tags: string[];
	takenAt: string;
}

export interface AlbumFile {
	/** 相对 相册/ 的路径（不含扩展名），同时也是 content collection 的 entry.id */
	id: string;
	title: string;
	subtitle: string;
	date: string;
	location: string;
	tags: string[];
	cover: string;
	/** 本地图片目录，相对 public/assets/images/albums */
	localFolder: string;
	imgbedFolder: string;
	photos: AlbumPhotoFile[];
	/** 本编辑器不认识的顶层键，原样保留（cover / draft 等） */
	extra: Record<string, unknown>;
}

/** 由 entry.id 拼出仓库路径 */
export function albumPath(id: string): string {
	return `${ALBUM_DIR}${id}.json`;
}

/** 新建一张空白照片 */
export function emptyAlbumPhoto(): AlbumPhotoFile {
	return { src: "", alt: "", caption: "", tags: [], takenAt: "" };
}

/**
 * 上传落点：优先跟 localFolder 走。
 *
 * 相册页会扫描 `localFolder` 目录把图片都收进来，新图放进同一个目录，
 * 才能和目录扫描结果按 src 去重后表现为「同一批照片」。
 */
export function albumUploadFolder(album: AlbumFile): string {
	const candidate = album.localFolder || album.id;
	return candidate.replace(/[^\w-]/g, "") || "album";
}

const PHOTO_KEYS = new Set(["src", "alt", "caption", "tags", "takenAt"]);
// draft 故意不列在这里：编辑器不提供发布状态开关，列进来就会在保存时被吃掉。
// 让它走 extra 原样进出，草稿相册不会因为改个描述就突然上线。
const KNOWN_KEYS = new Set([
	"title",
	"subtitle",
	"date",
	"location",
	"tags",
	"cover",
	"localFolder",
	"imgbedFolder",
	"photos",
]);

function asString(value: unknown): string {
	return typeof value === "string" ? value : "";
}

function asStringArray(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value.filter((item): item is string => typeof item === "string");
}

/** 照片项可能写成裸字符串（schema 允许），统一拍平成对象 */
function normalizePhoto(raw: unknown): AlbumPhotoFile | null {
	if (typeof raw === "string") {
		const src = raw.trim();
		return src ? { ...emptyAlbumPhoto(), src } : null;
	}
	if (!raw || typeof raw !== "object") return null;

	const record = raw as Record<string, unknown>;
	const src = asString(record.src).trim();
	if (!src) return null;

	const photo: AlbumPhotoFile = {
		src,
		alt: asString(record.alt),
		caption: asString(record.caption),
		tags: asStringArray(record.tags),
		takenAt: asString(record.takenAt),
	};
	// 逐张的未知键（顶多写错一个字段名）也留着，不然保存一次就没了
	for (const key of Object.keys(record)) {
		if (!PHOTO_KEYS.has(key)) {
			(photo as unknown as Record<string, unknown>)[key] = record[key];
		}
	}
	return photo;
}

/** json 原文 → 草稿。解析失败时抛出，由抽屉显示成人话 */
export function parseAlbumFile(raw: string, id: string): AlbumFile {
	let data: Record<string, unknown>;
	try {
		const parsed: unknown = JSON.parse(raw);
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
			throw new Error("不是一个对象");
		}
		data = parsed as Record<string, unknown>;
	} catch (error) {
		throw new Error(
			`相册 ${id} 不是合法的 JSON：${error instanceof Error ? error.message : String(error)}`,
		);
	}

	const album: AlbumFile = {
		id,
		title: asString(data.title),
		subtitle: asString(data.subtitle),
		date: asString(data.date).slice(0, 10),
		location: asString(data.location),
		tags: asStringArray(data.tags),
		cover: asString(data.cover),
		localFolder: asString(data.localFolder),
		imgbedFolder: asString(data.imgbedFolder),
		photos: Array.isArray(data.photos)
			? data.photos
					.map(normalizePhoto)
					.filter((photo): photo is AlbumPhotoFile => photo !== null)
			: [],
		extra: {},
	};

	for (const key of Object.keys(data)) {
		if (!KNOWN_KEYS.has(key)) album.extra[key] = data[key];
	}

	return album;
}

/** 草稿 → json 原文。字段顺序固定，diff 才好看；缩进沿用仓库里的 tab */
export function serializeAlbum(album: AlbumFile): string {
	const photos = album.photos.map((photo) => {
		const record: Record<string, unknown> = { src: photo.src, alt: photo.alt };
		if (photo.caption) record.caption = photo.caption;
		if (photo.tags.length > 0) record.tags = photo.tags;
		if (photo.takenAt) record.takenAt = photo.takenAt;
		// 现场带回来的未知键补回尾部
		for (const key of Object.keys(photo)) {
			if (!PHOTO_KEYS.has(key)) {
				record[key] = (photo as unknown as Record<string, unknown>)[key];
			}
		}
		// 空 alt 不写，省得每张照片都多一行 `"alt": ""`
		if (!record.alt) delete record.alt;
		return record;
	});

	const payload: Record<string, unknown> = { title: album.title };
	if (album.subtitle) payload.subtitle = album.subtitle;
	if (album.cover) payload.cover = album.cover;
	if (album.date) payload.date = album.date;
	if (album.location) payload.location = album.location;
	if (album.tags.length > 0) payload.tags = album.tags;
	if (album.localFolder) payload.localFolder = album.localFolder;
	if (album.imgbedFolder) payload.imgbedFolder = album.imgbedFolder;
	payload.photos = photos;
	Object.assign(payload, album.extra);

	return `${JSON.stringify(payload, null, "\t")}\n`;
}

/** 在草稿里按 src 找照片下标，找不到返回 -1 */
export function indexOfPhoto(album: AlbumFile, src: string): number {
	return album.photos.findIndex((photo) => photo.src === src);
}
