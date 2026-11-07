/** 后台批量提交队列：只保存当前浏览器会话里的新建 Markdown 草稿。 */

export const BATCH_QUEUE_LIMIT = 30;
export const BATCH_QUEUE_STORAGE_KEY = "jojo_admin_batch_queue";

export interface QueuedDraft {
	id: string;
	collectionId: string;
	collectionLabel: string;
	title: string;
	category: string;
	path: string;
	text: string;
}

function isQueuedDraft(value: unknown): value is QueuedDraft {
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

export function upsertQueuedDraft(
	queue: QueuedDraft[],
	draft: QueuedDraft,
): QueuedDraft[] {
	const index = queue.findIndex((item) => item.id === draft.id);
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
		return data.filter(isQueuedDraft).slice(0, BATCH_QUEUE_LIMIT);
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
