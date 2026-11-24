import assert from "node:assert/strict";
import test from "node:test";
import {
	albumPath,
	albumUploadFolder,
	createAlbumDraft,
	emptyAlbumPhoto,
	indexOfPhoto,
	newAlbumFolderId,
	parseAlbumFile,
	sanitizeAlbumId,
	serializeAlbum,
} from "./album-serializer.ts";

/** 仓库里真实相册文件的味道：带编辑器不认识的键、裸字符串照片、本地目录 */
const SAMPLE = `{
	"title": "旧日相片",
	"date": "2026-09-13",
	"location": "广州",
	"tags": ["旧博客", "生活碎片"],
	"localFolder": "old-jojo-gallery",
	"imgbedFolder": "",
	"cover": "/assets/images/albums/old-jojo-gallery/cover.webp",
	"draft": false,
	"photos": [
		{
			"src": "/assets/images/albums/old-jojo-gallery/meimei.webp",
			"alt": "旧博客相册中的 meimei",
			"caption": "meimei",
			"tags": ["日常"],
			"takenAt": "2026-08-28T09:04:02.912Z",
			"exif": { "iso": 100 }
		},
		"/assets/images/albums/old-jojo-gallery/raw.webp"
	]
}
`;

test("相册路径按集合目录拼", () => {
	assert.equal(
		albumPath("old-jojo-gallery"),
		"src/content/相册/old-jojo-gallery.json",
	);
});

test("解析时保留编辑器不认识的顶层键与逐张未知键", () => {
	const album = parseAlbumFile(SAMPLE, "old-jojo-gallery");

	assert.equal(album.title, "旧日相片");
	assert.equal(album.localFolder, "old-jojo-gallery");
	assert.deepEqual(album.tags, ["旧博客", "生活碎片"]);
	assert.equal(
		album.cover,
		"/assets/images/albums/old-jojo-gallery/cover.webp",
	);
	assert.equal(album.extra.draft, false);

	assert.equal(album.photos.length, 2);
	assert.deepEqual(album.photos[0].tags, ["日常"]);
	assert.deepEqual(
		(album.photos[0] as unknown as Record<string, unknown>).exif,
		{
			iso: 100,
		},
	);
});

test("裸字符串照片被拍平成对象", () => {
	const album = parseAlbumFile(SAMPLE, "old-jojo-gallery");
	const bare = album.photos[1];

	assert.equal(bare.src, "/assets/images/albums/old-jojo-gallery/raw.webp");
	assert.equal(bare.caption, "");
	assert.deepEqual(bare.tags, []);
});

test("解析 → 序列化 → 再解析，信息不丢", () => {
	const first = parseAlbumFile(SAMPLE, "old-jojo-gallery");
	const text = serializeAlbum(first);
	const second = parseAlbumFile(text, "old-jojo-gallery");

	assert.deepEqual(second.photos, first.photos);
	assert.deepEqual(second.tags, first.tags);
	assert.equal(second.title, first.title);
	assert.equal(second.cover, first.cover);
	assert.equal(second.extra.draft, false);
});

test("序列化按 tab 缩进并以换行收尾，diff 才不会飘", () => {
	const text = serializeAlbum(parseAlbumFile(SAMPLE, "old-jojo-gallery"));

	assert.ok(text.includes('\n\t"photos": ['));
	assert.ok(text.endsWith("}\n"));
});

test("空描述和空标签不写进输出", () => {
	const album = parseAlbumFile(SAMPLE, "old-jojo-gallery");
	album.photos.push(emptyAlbumPhoto());
	album.photos[2].src = "/assets/x.webp";

	const text = serializeAlbum(album);
	const reparsed = JSON.parse(text) as {
		photos: Array<Record<string, unknown>>;
	};
	const added = reparsed.photos[2];

	assert.deepEqual(Object.keys(added), ["src"]);
});

test("上传目录优先跟 localFolder，其次回落到 id，并清掉非法字符", () => {
	const album = parseAlbumFile(SAMPLE, "old-jojo-gallery");
	assert.equal(albumUploadFolder(album), "old-jojo-gallery");

	album.localFolder = "";
	assert.equal(albumUploadFolder(album), "old-jojo-gallery");

	// 防的是有人在 id 里塞路径穿越
	album.id = "../../etc";
	assert.equal(albumUploadFolder(album), "etc");
});

test("按 src 定位照片", () => {
	const album = parseAlbumFile(SAMPLE, "old-jojo-gallery");

	assert.equal(
		indexOfPhoto(album, "/assets/images/albums/old-jojo-gallery/meimei.webp"),
		0,
	);
	assert.equal(indexOfPhoto(album, "/assets/nope.webp"), -1);
});

/* ---------------------------------------------------------------- 新建相册 */

test("相册标识被清成文件名安全的 ASCII", () => {
	assert.equal(sanitizeAlbumId("  Old Jojo Gallery  "), "old-jojo-gallery");
	assert.equal(sanitizeAlbumId("../../etc/passwd"), "etc-passwd");
	assert.equal(sanitizeAlbumId("2026 冬天"), "2026");
	// 纯中文清完是空串：由调用方拦下提示，不猜拼音
	assert.equal(sanitizeAlbumId("冬天"), "");
	assert.equal(sanitizeAlbumId("-"), "");
});

test("相册标识长度封顶 40 且不以连字符收尾", () => {
	const long = sanitizeAlbumId(`${"a".repeat(38)} 尾`);
	assert.equal(long.length, 38);
	assert.ok(!long.endsWith("-"));

	const capped = sanitizeAlbumId(`${"a".repeat(39)}-中文`);
	assert.ok(capped.length <= 40);
	assert.ok(!capped.endsWith("-"));
});

test("默认标识长这样：album-时间戳随机串", () => {
	const id = newAlbumFolderId(1764000000000);
	assert.match(id, /^album-[a-z0-9]{4}[a-z0-9]{4}$/);
	assert.equal(sanitizeAlbumId(id), id);
});

test("新建草稿的 localFolder 跟 id 一致，序列化能往返", () => {
	const draft = createAlbumDraft({
		id: "2026-winter",
		title: "2026 冬天",
		date: "2026-11-24",
		subtitle: "第一场雪",
		location: "哈尔滨",
		tags: ["冬天"],
	});

	assert.equal(draft.localFolder, "2026-winter");
	assert.equal(albumUploadFolder(draft), "2026-winter");
	assert.deepEqual(draft.photos, []);

	const reparsed = parseAlbumFile(serializeAlbum(draft), draft.id);
	assert.equal(reparsed.title, "2026 冬天");
	assert.equal(reparsed.subtitle, "第一场雪");
	assert.equal(reparsed.location, "哈尔滨");
	assert.equal(reparsed.date, "2026-11-24");
	assert.equal(reparsed.localFolder, "2026-winter");
	assert.deepEqual(reparsed.tags, ["冬天"]);
	assert.deepEqual(reparsed.photos, []);
});

test("新建草稿的 id 会被清洗后再落盘", () => {
	const draft = createAlbumDraft({
		id: "  My Album  ",
		title: "我的相册",
		date: "2026-11-24",
	});

	assert.equal(draft.id, "my-album");
	assert.equal(albumPath(draft.id), "src/content/相册/my-album.json");
});
