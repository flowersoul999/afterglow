/**
 * 后台的内容仓库层
 *
 * 夹在「组件」和「GitHub 客户端」之间，负责三件组件不该管的事：
 *   1. 把一个集合目录递归摊平成条目列表（顺带缓存，切来切去不重复请求）
 *   2. 按集合的路径模板生成新文件路径（`文章/随笔/xxx.md`）
 *   3. 读写时的冲突处理（同一天第二条说说自动加 -2）
 *
 * 列表刻意**只读文件名，不读文件内容** —— 面经有 108 篇，逐篇拉 frontmatter
 * 就是 108 次请求，慢且浪费额度。文件名本身是给人看的（面经带序号、说说带日期），
 * 标题等真实字段等打开时再显示。
 */

import type { AdminCollection } from "@/config/admin-collections";
import {
	type ContentDoc,
	parseContent,
	serializeContent,
} from "./content-serializer";
import {
	deleteFile,
	EditorApiError,
	listDir,
	readFile,
	writeFile,
} from "./github-client";

export interface AdminEntry {
	/** 仓库相对路径，含 .md */
	path: string;
	/** 文件名，含 .md */
	name: string;
	/** 去掉扩展名与序号前缀的可读名 */
	display: string;
	/** 相对集合目录的子目录，根目录下为空字符串 */
	category: string;
	sha: string;
	size: number;
}

/** 递归深度上限：内容结构是「集合/分类/文件」，3 层足够，多一层只可能是意外 */
const MAX_DEPTH = 4;
/** 单个集合的条目上限，防止误配目录把整站拉下来 */
const MAX_ENTRIES = 600;
/** 列表缓存时间：切集合、切条目时不重复请求；保存后主动失效 */
const CACHE_TTL = 20_000;

interface CacheItem {
	at: number;
	entries: AdminEntry[];
}

const cache = new Map<string, CacheItem>();

/** 去掉 `.md`、去掉 `01-` 这类排序前缀，剩下的就是给人看的名字 */
function toDisplayName(fileName: string): string {
	const base = fileName.replace(/\.mdx?$/i, "");
	const stripped = base.replace(/^\d{1,3}[-_.\s]+/, "");
	const name = stripped || base;
	// 日期型文件名保持连字符（换成空格反而像「2026 09 26」）；
	// 同一天的第二条 `2026-10-05-2` 显示成 `2026-10-05 · 2`
	const dated = name.match(/^(\d{4}-\d{2}-\d{2})(?:-(\d+))?$/);
	if (dated) return dated[2] ? `${dated[1]} · ${dated[2]}` : dated[1];
	return name.replace(/[-_]+/g, " ").trim();
}

async function walk(
	collection: AdminCollection,
	branch: string,
	dir: string,
	depth: number,
	out: AdminEntry[],
): Promise<void> {
	if (depth > MAX_DEPTH || out.length >= MAX_ENTRIES) return;

	const entries = await listDir(dir, branch);

	const subDirs: string[] = [];
	for (const entry of entries) {
		if (entry.type === "dir") {
			subDirs.push(entry.path);
			continue;
		}
		if (!/\.mdx?$/i.test(entry.name)) continue;
		out.push({
			path: entry.path,
			name: entry.name,
			display: toDisplayName(entry.name),
			category: dir.slice(collection.dir.length + 1),
			sha: entry.sha,
			size: entry.size,
		});
		if (out.length >= MAX_ENTRIES) return;
	}

	// 同一层的子目录并发拉，层与层之间串行 —— 面经是 5 个分类，一次并发足够
	await Promise.all(
		subDirs.map((path) => walk(collection, branch, path, depth + 1, out)),
	);
}

/** 列出集合下所有 md（带缓存） */
export async function listEntries(
	collection: AdminCollection,
	branch: string,
	options: { force?: boolean } = {},
): Promise<AdminEntry[]> {
	const key = `${collection.id}@${branch}`;
	const hit = cache.get(key);
	if (!options.force && hit && Date.now() - hit.at < CACHE_TTL) {
		return hit.entries;
	}

	const entries: AdminEntry[] = [];
	await walk(collection, branch, collection.dir, 0, entries);

	entries.sort((a, b) => {
		// 先按目录倒序聚拢（说说/更新日志的目录是 年/月，倒序 = 新的在前），
		// 再按文件名倒序；文章是 slug，顺序无所谓，至少保持稳定
		if (a.category !== b.category) return b.category.localeCompare(a.category);
		return b.name.localeCompare(a.name);
	});

	cache.set(key, { at: Date.now(), entries });
	return entries;
}

/** 保存/删除后调用，下次进列表拿到的一定是新结果 */
export function invalidateEntries(collectionId?: string): void {
	if (!collectionId) {
		cache.clear();
		return;
	}
	for (const key of [...cache.keys()]) {
		if (key.startsWith(`${collectionId}@`)) cache.delete(key);
	}
}

/* --------------------------------------------------------------- 路径 */

/** 标题 → 文件名片段：保留中文，去掉文件系统不认的字符 */
export function toSlug(title: string, fallback: string): string {
	const cleaned = title
		.trim()
		// 半角与全角标点都去掉：全角冒号在 Windows 上合法，但文件名会很难读
		.replace(/[\\/:*?"<>|#%&{}$!'@+`=~^]/g, "")
		.replace(/[：；，。！？、（）【】《》〈〉「」『』…·—]/g, "")
		.replace(/\s+/g, "-")
		.replace(/-{2,}/g, "-")
		.replace(/^-+|-+$/g, "");
	const slug = cleaned.slice(0, 60).replace(/^-+|-+$/g, "");
	return slug || fallback;
}

function pad(value: number): string {
	return String(value).padStart(2, "0");
}

/** `2026-11-04` / `2026-11-04 21:40` → 模板占位符 */
function dateParts(value: string): { yyyy: string; mm: string; dd: string } {
	const matched = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
	if (matched) {
		return { yyyy: matched[1], mm: matched[2], dd: matched[3] };
	}
	const now = new Date();
	return {
		yyyy: String(now.getFullYear()),
		mm: pad(now.getMonth() + 1),
		dd: pad(now.getDate()),
	};
}

/** 按集合的路径模板生成新文件路径（不含 .md） */
export function buildPath(
	collection: AdminCollection,
	options: { title: string; date: string; category: string },
): string {
	const parts = dateParts(options.date);
	const slug = toSlug(options.title, `untitled-${Date.now().toString(36)}`);
	const relative = collection.pathTemplate
		.replace(/\{category\}/g, options.category || "未分类")
		.replace(/\{yyyy\}/g, parts.yyyy)
		.replace(/\{mm\}/g, parts.mm)
		.replace(/\{dd\}/g, parts.dd)
		.replace(/\{slug\}/g, slug)
		.replace(/\/{2,}/g, "/")
		.replace(/^\/|\/$/g, "");

	return `${collection.dir}/${relative}.md`;
}

/** 同一天已有文件时往后加序号：`...-2.md` */
function withSuffix(path: string, attempt: number): string {
	if (attempt <= 1) return path;
	return path.replace(/\.md$/, `-${attempt}.md`);
}

/* --------------------------------------------------------------- 读写 */

export interface LoadedEntry {
	doc: ContentDoc;
	sha: string;
	/** 原文，用于判断有没有真的改动 */
	raw: string;
}

export async function loadEntry(
	path: string,
	branch: string,
): Promise<LoadedEntry | null> {
	const file = await readFile(path, branch);
	if (!file) return null;
	return {
		doc: parseContent(file.text),
		sha: file.sha,
		raw: file.text,
	};
}

export interface SaveOptions {
	collection: AdminCollection;
	path: string;
	doc: ContentDoc;
	sha: string;
	/** 新建时为 true，会处理同名冲突 */
	isNew: boolean;
	branch: string;
	/** 提交信息里用的名字，比如「给 AI 装上工作流程」 */
	label: string;
}

/** 保存。返回最终写入的路径（新建撞名时可能和传入的 path 不同） */
export interface SavedEntry {
	path: string;
	sha: string;
}

export async function saveEntry(options: SaveOptions): Promise<SavedEntry> {
	const text = serializeContent(options.doc);
	const message = options.isNew
		? `feat(${options.collection.id}): 新增《${options.label}》`
		: `chore(${options.collection.id}): 更新《${options.label}》`;

	if (!options.isNew) {
		const sha = await writeFile({
			path: options.path,
			text,
			message,
			branch: options.branch,
			sha: options.sha,
		});
		invalidateEntries(options.collection.id);
		return { path: options.path, sha };
	}

	for (let attempt = 1; ; attempt += 1) {
		const candidate = withSuffix(options.path, attempt);
		try {
			const sha = await writeFile({
				path: candidate,
				text,
				message,
				branch: options.branch,
			});
			invalidateEntries(options.collection.id);
			return { path: candidate, sha };
		} catch (error) {
			// 422 = 文件已存在但没给 sha，说明撞名了，换个序号再试
			const exists = error instanceof EditorApiError && error.status === 422;
			if (exists && attempt < 9) continue;
			throw error;
		}
	}
}

export async function removeEntry(options: {
	collection: AdminCollection;
	path: string;
	sha: string;
	branch: string;
	label: string;
}): Promise<void> {
	await deleteFile({
		path: options.path,
		message: `chore(${options.collection.id}): 删除《${options.label}》`,
		branch: options.branch,
		sha: options.sha,
	});
	invalidateEntries(options.collection.id);
}
