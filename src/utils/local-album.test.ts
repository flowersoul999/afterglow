import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

type ScanLocalAlbumPhotos = (options: {
	rootDir: string;
	folder: string;
	publicBase?: string;
}) => Promise<Array<{ name: string; src: string }>>;

let scanLocalAlbumPhotos: ScanLocalAlbumPhotos | undefined;
try {
	const module = await import("./local-album.ts");
	scanLocalAlbumPhotos = module.scanLocalAlbumPhotos;
} catch {
	// 首次 RED 阶段允许模块尚不存在，下面的断言会给出明确失败。
}

test("递归扫描本地相册并生成稳定的公开 URL", async () => {
	assert.equal(typeof scanLocalAlbumPhotos, "function");
	if (!scanLocalAlbumPhotos) return;

	const rootDir = await mkdtemp(path.join(tmpdir(), "local-album-"));
	try {
		await mkdir(path.join(rootDir, "travel", "city"), { recursive: true });
		await writeFile(path.join(rootDir, "travel", "cover 01.webp"), "image");
		await writeFile(path.join(rootDir, "travel", "city", "night.jpg"), "image");
		await writeFile(path.join(rootDir, "travel", "notes.txt"), "ignore");
		await writeFile(path.join(rootDir, "travel", "raw.heic"), "ignore");
		await writeFile(path.join(rootDir, "travel", ".DS_Store"), "ignore");

		const photos = await scanLocalAlbumPhotos({
			rootDir,
			folder: "travel",
		});

		assert.deepEqual(photos, [
			{
				name: "city/night.jpg",
				src: "/assets/images/albums/travel/city/night.jpg",
			},
			{
				name: "cover 01.webp",
				src: "/assets/images/albums/travel/cover%2001.webp",
			},
		]);
	} finally {
		await rm(rootDir, { recursive: true, force: true });
	}
});

test("拒绝读取相册根目录之外的路径", async () => {
	assert.equal(typeof scanLocalAlbumPhotos, "function");
	if (!scanLocalAlbumPhotos) return;

	const rootDir = await mkdtemp(path.join(tmpdir(), "local-album-"));
	try {
		await assert.rejects(
			scanLocalAlbumPhotos({ rootDir, folder: "../private" }),
			/相册目录必须位于本地相册根目录内/,
		);
	} finally {
		await rm(rootDir, { recursive: true, force: true });
	}
});
