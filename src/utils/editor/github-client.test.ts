import assert from "node:assert/strict";
import test from "node:test";
import { writeBatch } from "./github-client.ts";

test("批量客户端把混合内容一次发送到批量接口", async () => {
	const originalFetch = globalThis.fetch;
	let capturedUrl = "";
	let capturedBody: Record<string, unknown> = {};

	globalThis.fetch = async (
		input: RequestInfo | URL,
		init?: RequestInit,
	): Promise<Response> => {
		capturedUrl = String(input);
		capturedBody = JSON.parse(String(init?.body));
		return Response.json({
			ok: true,
			commitSha: "commit-new",
			items: [
				{
					path: "src/content/文章/随笔/文章.md",
					sha: "blob-1",
					collectionId: "posts",
					label: "文章",
				},
			],
		});
	};

	try {
		const result = await writeBatch({
			branch: "main",
			message: "feat(content): 批量新增 1 条内容",
			items: [
				{
					path: "src/content/文章/随笔/文章.md",
					text: "正文",
					collectionId: "posts",
					label: "文章",
				},
			],
		});

		assert.equal(capturedUrl, "/api/github/batch");
		assert.equal(capturedBody.branch, "main");
		assert.equal((capturedBody.items as unknown[]).length, 1);
		assert.equal(result.commitSha, "commit-new");
		assert.equal(result.items[0].sha, "blob-1");
	} finally {
		globalThis.fetch = originalFetch;
	}
});
