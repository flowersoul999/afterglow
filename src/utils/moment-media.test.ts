/**
 * 正文媒体拆/拼的纯函数单测。
 *
 * 跑法：`pnpm test:media`（node --experimental-strip-types，无需 Astro 环境）。
 * 这几个函数同时被说说抽屉和 /admin 的图片区调用，拼错一个字面量就是整条说说
 * 的图片消失或重复，所以先钉死行为再改 UI。
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
	isRepoMediaUrl,
	joinBodyMedia,
	moveMediaItem,
	resolveMomentMedia,
	splitMomentMedia,
} from "./moment-media.ts";

test("joinBodyMedia：文字在前，图片一行一个、空行分隔", () => {
	const body = joinBodyMedia("今天好热", [
		"assets/diary/a.webp",
		"assets/diary/b.webp",
	]);
	assert.equal(
		body,
		"今天好热\n\n![](assets/diary/a.webp)\n\n![](assets/diary/b.webp)",
	);
});

test("joinBodyMedia：没有文字时只有图片，不留空行", () => {
	assert.equal(
		joinBodyMedia("", ["https://x.test/a.png"]),
		"![](https://x.test/a.png)",
	);
	assert.equal(joinBodyMedia("   ", ["a.webp"]), "![](a.webp)");
});

test("joinBodyMedia：空 url 被跳过，不会写出废行", () => {
	assert.equal(
		joinBodyMedia("文字", ["", "  ", "a.webp"]),
		"文字\n\n![](a.webp)",
	);
	assert.equal(joinBodyMedia("文字", []), "文字");
	assert.equal(joinBodyMedia(null, []), "");
});

test("split 与 join 互逆：拆出来的文字和顺序能原样拼回去", () => {
	const original =
		"**标题**\n\n正文第一段\n\n![](assets/diary/1.webp)\n\n![](assets/diary/2.webp)";
	const { text, media } = splitMomentMedia(original);
	assert.deepEqual(media, ["assets/diary/1.webp", "assets/diary/2.webp"]);
	assert.equal(text, "**标题**\n\n正文第一段");
	assert.equal(joinBodyMedia(text, media), original);
});

test("split 认外链和仓库路径混排，join 保持列表顺序", () => {
	const { media } = splitMomentMedia(
		"文字\n\n![](https://cdn.test/a.png)\n\n![](assets/diary/b.webp)",
	);
	assert.deepEqual(media, ["https://cdn.test/a.png", "assets/diary/b.webp"]);
	assert.equal(
		joinBodyMedia("文字", moveMediaItem(media, 0, 1)),
		"文字\n\n![](assets/diary/b.webp)\n\n![](https://cdn.test/a.png)",
	);
});

test("resolveMomentMedia：正文图片在前，旧 frontmatter 的去重后接上", () => {
	assert.deepEqual(
		resolveMomentMedia({
			legacyImages: ["assets/diary/a.webp", "assets/diary/old.webp"],
			body: "文字\n\n![](assets/diary/a.webp)",
		}),
		["assets/diary/a.webp", "assets/diary/old.webp"],
	);
});

test("moveMediaItem：占用目标位置，越界不动", () => {
	const list = ["a", "b", "c"];
	assert.deepEqual(moveMediaItem(list, 0, 1), ["b", "a", "c"]);
	assert.deepEqual(moveMediaItem(list, 0, 2), ["b", "c", "a"]);
	assert.deepEqual(moveMediaItem(list, 2, 0), ["c", "a", "b"]);
	assert.deepEqual(moveMediaItem(list, 1, 1), ["a", "b", "c"]);
	// 越界不炸，返回副本
	assert.deepEqual(moveMediaItem(list, -1, 2), ["a", "b", "c"]);
	assert.deepEqual(moveMediaItem(list, 5, 0), ["a", "b", "c"]);
	assert.deepEqual(moveMediaItem(list, 2, 3), ["a", "b", "c"]);
	assert.deepEqual(moveMediaItem(list, 0, 9), ["a", "b", "c"]);
	assert.notEqual(moveMediaItem(list, 0, 0), list);
	assert.deepEqual(list, ["a", "b", "c"]);
});

test("isRepoMediaUrl：只认配置给的前缀", () => {
	assert.equal(isRepoMediaUrl("assets/diary/a.webp", "assets/diary/"), true);
	assert.equal(isRepoMediaUrl("https://x.test/a.webp", "assets/diary/"), false);
	assert.equal(isRepoMediaUrl("/assets/images/a.webp", "assets/diary/"), false);
	// 空前缀不能把所有路径都算成仓库图
	assert.equal(isRepoMediaUrl("assets/diary/a.webp", ""), false);
});
