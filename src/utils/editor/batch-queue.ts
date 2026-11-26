/**
 * 后台批量提交队列（草稿箱）
 *
 * 点「存入草稿箱」只把内容攒在本地，等点「提交全部」时才合成一次 Git 提交。
 * 所以不能放 sessionStorage —— 站长常见的用法是改几篇、关掉标签页、过一会
 * 再回来继续，关掉页面就丢等于没存。2026-11-26 从 sessionStorage 迁到
 * localStorage，旧数据在 AdminApp 启动时搬一次。
 */

export const BATCH_QUEUE_LIMIT = 30;
export const BATCH_QUEUE_STORAGE_KEY = "jojo_admin_batch_queue";

/** create = 新建文件；update = 覆盖仓库里已有的同路径文件 */
export type QueuedDraftMode = "create" | "update";

export interface QueuedDraft {
	id: string;
	collectionId: string;
	collectionLabel: string;
	title: string;
	category: string;
	path: string;
	text: string;
	/** 决定批量提交时走「新建」还是「覆盖」，缺省按 create 处理 */
	mode: QueuedDraftMode;
}

/** 存进浏览器的是历史格式：mode 字段是后加的，旧队列里没有 */
type StoredQueuedDraft = Omit<QueuedDraft, "mode"> & { mode?: unknown };

function isStoredQueuedDraft(value: unknown): value is StoredQueuedDraft {
	if (!value || typeof value !== "object") return false;
	const item = value as Record<string, unknown>;
	return (
		typeof item.id === "string" &&
		item.id !== "" &&
		typeof item.collectionId === "string" &&
		item.collectionId !== "" &&
		typeof item.collectionLabel === "string" &&
		typeof item.title === "string" &&
		typeof item.category === "string" &&
		typeof item.path === "string" &&
		item.path.startsWith("src/content/") &&
		/\.md$/i.test(item.path) &&
		!item.path.includes("..") &&
		typeof item.text === "string"
	);
}

/**
 * 入队 / 替换。
 *
 * 同一个 id 一定算「同一条」：从队列里点编辑再存回来时 id 不变。
 *
 * 路径去重只对 update 生效 —— 它必须命中仓库里那一个文件，同路径只能是同一条。
 * create 不能按路径去重：说说的文件 id 由发布日期决定，同一天发两条说到不了
 * `-2` 之前路径完全一样，按路径合并会把第二条吃掉。新建撞名交给服务端加后缀。
 */
export function upsertQueuedDraft(
	queue: QueuedDraft[],
	draft: QueuedDraft,
): QueuedDraft[] {
	const index = queue.findIndex(
		(item) =>
			item.id === draft.id ||
			(draft.mode === "update" && item.path === draft.path),
	);
	if (index >= 0) {
		const next = [...queue];
		next[index] = draft;
		return next;
	}
	if (queue.length >= BATCH_QUEUE_LIMIT) {
		throw new Error(`每批最多只能加入 ${BATCH_QUEUE_LIMIT} 条内容`);
	}
	return [...queue, draft];
}

export function parseQueuedDrafts(raw: string | null): QueuedDraft[] {
	if (!raw) return [];
	try {
		const data = JSON.parse(raw) as unknown;
		if (!Array.isArray(data)) return [];
		return data
			.filter(isStoredQueuedDraft)
			.slice(0, BATCH_QUEUE_LIMIT)
			.map((item) => ({
				...item,
				// 旧队列默认都是新建；只有明确写了 update 的才算更新
				mode: item.mode === "update" ? "update" : "create",
			}));
	} catch {
		return [];
	}
}

export function createQueuedDraftId(): string {
	if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
		return crypto.randomUUID();
	}
	return `draft-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * 读队列。
 *
 * 后台（/admin）和站内说说抽屉共用同一份队列：抽屉里存进去的说说，要能在后台
 * 的「待提交」里看到并一起提交，所以两边读写必须走同一个 key 和同一套校验。
 */
export function loadQueuedDrafts(): QueuedDraft[] {
	if (typeof localStorage === "undefined") return [];
	try {
		return parseQueuedDrafts(localStorage.getItem(BATCH_QUEUE_STORAGE_KEY));
	} catch {
		// 隐私模式下 localStorage 连读都会抛，按空队列处理
		return [];
	}
}

/** 写队列；空队列直接删 key，免得留一个 `[]` 在浏览器里误导排查 */
export function persistQueuedDrafts(next: QueuedDraft[]): void {
	if (typeof localStorage === "undefined") return;
	try {
		if (next.length === 0) {
			localStorage.removeItem(BATCH_QUEUE_STORAGE_KEY);
			return;
		}
		localStorage.setItem(BATCH_QUEUE_STORAGE_KEY, JSON.stringify(next));
	} catch {
		// 写不进去也不能让编辑流程失败，本页内存里的队列仍然可用
	}
}
