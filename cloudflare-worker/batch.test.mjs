import assert from "node:assert/strict";
import test from "node:test";
import worker, * as workerModule from "./index.js";

test("批量路径会避让仓库已有文件和本批次重名", () => {
	assert.equal(typeof workerModule.resolveBatchPaths, "function");
	if (typeof workerModule.resolveBatchPaths !== "function") return;

	const resolved = workerModule.resolveBatchPaths(
		[
			{ path: "src/content/动态/2026/11/2026-11-07.md" },
			{ path: "src/content/动态/2026/11/2026-11-07.md" },
		],
		new Set([
			"src/content/动态/2026/11/2026-11-07.md",
			"src/content/动态/2026/11/2026-11-07-2.md",
		]),
	);

	assert.deepEqual(
		resolved.map((item) => item.path),
		[
			"src/content/动态/2026/11/2026-11-07-3.md",
			"src/content/动态/2026/11/2026-11-07-4.md",
		],
	);
});

test("批量写入只创建一个提交并原子更新一次分支", async () => {
	assert.equal(typeof workerModule.commitBatchFiles, "function");
	if (typeof workerModule.commitBatchFiles !== "function") return;

	const calls = [];
	let blobIndex = 0;
	const fakeFetch = async (url, options = {}) => {
		calls.push({ url: String(url), options });
		const target = String(url);
		if (target.includes("/git/ref/heads/main")) {
			return Response.json({ object: { sha: "commit-old" } });
		}
		if (target.includes("/git/commits/commit-old")) {
			return Response.json({ tree: { sha: "tree-old" } });
		}
		if (target.includes("/git/trees/tree-old?recursive=1")) {
			return Response.json({
				truncated: false,
				tree: [{ path: "src/content/动态/2026/11/2026-11-07.md" }],
			});
		}
		if (target.endsWith("/git/blobs")) {
			blobIndex += 1;
			return Response.json({ sha: `blob-${blobIndex}` });
		}
		if (target.endsWith("/git/trees")) {
			const body = JSON.parse(options.body);
			assert.deepEqual(
				body.tree.map((item) => item.path),
				[
					"src/content/文章/随笔/批量文章.md",
					"src/content/动态/2026/11/2026-11-07-2.md",
				],
			);
			return Response.json({ sha: "tree-new" });
		}
		if (target.endsWith("/git/commits")) {
			const body = JSON.parse(options.body);
			assert.deepEqual(body.parents, ["commit-old"]);
			assert.equal(body.tree, "tree-new");
			return Response.json({ sha: "commit-new" });
		}
		if (target.includes("/git/refs/heads/main")) {
			return Response.json({ object: { sha: "commit-new" } });
		}
		throw new Error(`未处理的请求：${target}`);
	};

	const result = await workerModule.commitBatchFiles({
		token: "token",
		branch: "main",
		message: "feat(content): 批量新增 2 条内容",
		items: [
			{
				path: "src/content/文章/随笔/批量文章.md",
				text: "文章",
				collectionId: "posts",
				label: "批量文章",
			},
			{
				path: "src/content/动态/2026/11/2026-11-07.md",
				text: "说说",
				collectionId: "moments",
				label: "照片说说",
			},
		],
		fetchImpl: fakeFetch,
	});

	assert.equal(result.commitSha, "commit-new");
	assert.equal(
		result.items[1].path,
		"src/content/动态/2026/11/2026-11-07-2.md",
	);
	assert.equal(
		calls.filter(
			(call) =>
				call.options.method === "PATCH" &&
				call.url.includes("/git/refs/heads/main"),
		).length,
		1,
	);
});

test("Worker 暴露批量提交路由", async () => {
	const response = await worker.fetch(
		new Request("https://jojocode.cn/api/github/batch", {
			method: "GET",
		}),
		{
			GITHUB_CLIENT_ID: "id",
			GITHUB_CLIENT_SECRET: "secret",
		},
	);

	assert.notEqual(response.status, 404);
});
