import assert from "node:assert/strict";
import test from "node:test";

type BatchQueueModule = typeof import("./batch-queue.ts");

let batchQueue: BatchQueueModule | undefined;
try {
	batchQueue = await import("./batch-queue.ts");
} catch {
	// RED 阶段允许模块尚不存在，下面会给出明确失败。
}

const draft = {
	id: "draft-1",
	collectionId: "posts",
	collectionLabel: "文章",
	title: "第一篇",
	category: "随笔",
	path: "src/content/文章/随笔/第一篇.md",
	text: "---\ntitle: 第一篇\n---\n正文\n",
};

test("待提交队列可以混合集合并更新原位置草稿", () => {
	assert.equal(typeof batchQueue?.upsertQueuedDraft, "function");
	if (!batchQueue) return;

	const mixed = batchQueue.upsertQueuedDraft([], draft);
	mixed.push({
		...draft,
		id: "draft-2",
		collectionId: "moments",
		collectionLabel: "说说",
		title: "照片说说",
		path: "src/content/动态/2026/11/2026-11-07.md",
	});

	const updated = batchQueue.upsertQueuedDraft(mixed, {
		...draft,
		title: "第一篇（已修改）",
	});

	assert.equal(updated.length, 2);
	assert.equal(updated[0].title, "第一篇（已修改）");
	assert.equal(updated[1].collectionId, "moments");
});

test("待提交队列最多允许三十条", () => {
	assert.equal(typeof batchQueue?.upsertQueuedDraft, "function");
	if (!batchQueue) return;

	const full = Array.from({ length: 30 }, (_, index) => ({
		...draft,
		id: `draft-${index}`,
		title: `内容 ${index}`,
		path: `src/content/文章/随笔/内容-${index}.md`,
	}));

	assert.throws(
		() =>
			batchQueue?.upsertQueuedDraft(full, {
				...draft,
				id: "draft-overflow",
			}),
		/最多只能加入 30 条/,
	);
});

test("恢复会话队列时过滤损坏和越界数据", () => {
	assert.equal(typeof batchQueue?.parseQueuedDrafts, "function");
	if (!batchQueue) return;

	const restored = batchQueue.parseQueuedDrafts(
		JSON.stringify([
			draft,
			{ id: "broken", path: "../CLAUDE.md" },
			...Array.from({ length: 35 }, (_, index) => ({
				...draft,
				id: `extra-${index}`,
				path: `src/content/文章/随笔/extra-${index}.md`,
			})),
		]),
	);

	assert.equal(restored.length, 30);
	assert.equal(restored[0].id, "draft-1");
	assert.ok(
		restored.every(
			(item) =>
				item.path.startsWith("src/content/") && item.path.endsWith(".md"),
		),
	);
});
