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
	mode: "create" as const,
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

test("旧队列没有 mode 字段时按新建处理，update 保持原样", () => {
	assert.equal(typeof batchQueue?.parseQueuedDrafts, "function");
	if (!batchQueue) return;

	// 旧版本写进 sessionStorage 的条目没有 mode，读回来必须能直接入队
	const legacy = {
		id: "legacy-1",
		collectionId: "posts",
		collectionLabel: "文章",
		title: "老草稿",
		category: "随笔",
		path: "src/content/文章/随笔/老草稿.md",
		text: "正文",
	};
	const restored = batchQueue.parseQueuedDrafts(
		JSON.stringify([
			legacy,
			{
				...legacy,
				id: "legacy-2",
				path: "src/content/文章/随笔/老草稿-2.md",
				mode: "update",
			},
		]),
	);

	assert.deepEqual(
		restored.map((item) => item.mode),
		["create", "update"],
	);
});

test("更新同一路径只保留最后一份，新建仍各占一条", () => {
	assert.equal(typeof batchQueue?.upsertQueuedDraft, "function");
	if (!batchQueue) return;

	// update 必须命中仓库里那一个文件，同路径只能是同一条
	const update = { ...draft, mode: "update" as const };
	const first = batchQueue.upsertQueuedDraft([], update);
	const second = batchQueue.upsertQueuedDraft(first, {
		...update,
		// id 变了也要按目标路径认出是同一条，避免批量提交时同一文件出现两次
		id: "draft-renamed",
		title: "第一篇（再改）",
	});

	assert.equal(second.length, 1);
	assert.equal(second[0].id, "draft-renamed");
	assert.equal(second[0].title, "第一篇（再改）");

	// create 不能按路径合并：说说同一天两条的路径在服务端加后缀之前是一样的
	const samePath = { ...draft, id: "same-1" };
	const created = batchQueue.upsertQueuedDraft(
		batchQueue.upsertQueuedDraft([], samePath),
		{ ...samePath, id: "same-2" },
	);

	assert.equal(created.length, 2);
});
