/**
 * 动态（moments）正文里的媒体（图片 / 视频）提取与清洗。
 *
 * 背景：2026-10-21 起动态图片从 frontmatter 的 `images` 属性迁移到**正文 Markdown**
 * （一行一个 `![](https://...)`），这样在 Obsidian 里打开 md 就能直接看到图。
 * 迁移期旧写法仍然有效：schema 的 images 字段保留，两种来源合并去重。
 *
 * 约定：动态正文里的图片一律写**空 alt**（`![](url)`）。非空 alt 会被 rehype-figure
 * 包成 figure/figcaption，卡片里会多出一行图注。
 */

/** 视频扩展名：这些走视频区渲染，其余走九宫格 */
export const VIDEO_EXTENSIONS: ReadonlySet<string> = new Set([
	"mp4",
	"webm",
	"mov",
	"ogg",
	"avi",
	"mkv",
]);

/**
 * 一条正则同时匹配 Markdown 图片语法与行内 HTML img/video，保证按文档顺序提取。
 * 组 1 = Markdown `![alt](url)` 的 url；组 2 = HTML `src="..."` 的 url。
 */
const MEDIA_RE =
	/!\[[^\]]*\]\(\s*<?([^)\s]+)>?(?:\s+["'][^"']*["'])?\s*\)|<(?:img|video)\b[^>]*?\ssrc\s*=\s*["']([^"']+)["'][^>]*>/gi;

/** 去掉 Markdown 的转义符（`\(`、`\_` 等）还原成原始 URL */
function cleanUrl(raw: string): string {
	return raw.replace(/\\(.)/gu, "$1").trim().replace(/^<|>$/g, "");
}

/** 取 URL 后缀小写（忽略 query / hash），用于判断是不是视频 */
function extensionOf(url: string): string {
	let pathname = url;
	try {
		pathname = new URL(url, "http://localhost").pathname;
	} catch {
		/* 相对路径等情况直接用原值 */
	}
	const file = pathname.split(/[?#]/u)[0] ?? "";
	const matched = file.match(/\.([a-z0-9]+)$/iu);
	return matched ? (matched[1] ?? "").toLowerCase() : "";
}

export function isVideoUrl(url: string): boolean {
	return VIDEO_EXTENSIONS.has(extensionOf(url));
}

/** 扫描正文，按出现顺序返回媒体 URL */
function collectFromBody(body: string): string[] {
	const found: string[] = [];
	const re = new RegExp(MEDIA_RE.source, "giu");
	for (const matched of body.matchAll(re)) {
		const url = cleanUrl(matched[1] ?? matched[2] ?? "");
		if (url) found.push(url);
	}
	return found;
}

/**
 * 旧 frontmatter `images` 字段归一化成字符串数组。
 * 兼容三种历史写法：字符串数组、单个字符串（逗号/分号分隔）、ImageMetadata 对象。
 */
export function normalizeLegacyImages(legacyImages: unknown): string[] {
	const toUrl = (item: unknown): string => {
		if (typeof item === "string") return item.trim();
		if (item && typeof item === "object" && "src" in item) {
			const src = (item as { src?: unknown }).src;
			if (typeof src === "string") return src.trim();
		}
		return "";
	};

	if (Array.isArray(legacyImages)) {
		return legacyImages.map(toUrl).filter(Boolean);
	}
	if (typeof legacyImages === "string") {
		return legacyImages
			.split(/[,;]/u)
			.map((item) => item.trim())
			.filter(Boolean);
	}
	return [];
}

/**
 * 汇总一条动态要渲染的全部媒体 URL：正文里的在前，旧 images 属性里的在后，去重保序。
 */
export function resolveMomentMedia(input: {
	legacyImages?: unknown;
	body?: string | null;
}): string[] {
	const fromBody = collectFromBody(input.body ?? "");
	const fromLegacy = normalizeLegacyImages(input.legacyImages);
	return [...new Set([...fromBody, ...fromLegacy])];
}

/**
 * 去掉正文里的图片 / 视频语法，只留文字。
 * 用于摘要、搜索索引、归档标题——避免 `![](https://...)` 混进纯文本。
 */
export function stripMomentMedia(body: string | undefined | null): string {
	if (!body) return "";
	return body.replace(MEDIA_RE, " ").replace(/[ \t]+$/gmu, "");
}

/**
 * 正文转小写纯文本（去 Markdown 标记与图片语法），供前端搜索匹配。
 */
export function toMomentPlainText(body: string | undefined | null): string {
	return stripMomentMedia(body)
		.replace(/```[\s\S]*?```/gu, " ")
		.replace(/\[([^\]]*)\]\([^)]*\)/gu, "$1")
		.replace(/[#>*_`~|]/gu, " ")
		.replace(/\s+/gu, " ")
		.trim()
		.toLowerCase();
}
