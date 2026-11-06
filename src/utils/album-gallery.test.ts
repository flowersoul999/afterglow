import assert from "node:assert/strict";
import test from "node:test";
import {
	getScatterPlacement,
	mergePhotoTags,
	normalizeAlbumPhoto,
} from "./album-gallery.ts";

test("规范化单张照片时保留描述、标签与拍摄时间", () => {
	assert.deepEqual(
		normalizeAlbumPhoto({
			src: "/assets/images/albums/old-jojo-gallery/cat-cloud.webp",
			alt: "广州天空中的猫猫云",
			caption: "七夕那天广州的猫猫云",
			tags: ["广州", "云"],
			takenAt: "2026-08-28T09:03:19.161Z",
		}),
		{
			src: "/assets/images/albums/old-jojo-gallery/cat-cloud.webp",
			name: "cat-cloud.webp",
			alt: "广州天空中的猫猫云",
			caption: "七夕那天广州的猫猫云",
			tags: ["广州", "云"],
			takenAt: "2026-08-28T09:03:19.161Z",
		},
	);
});

test("字符串照片仍可转换为兼容的照片元数据", () => {
	assert.deepEqual(normalizeAlbumPhoto("/images/demo photo.webp"), {
		src: "/images/demo photo.webp",
		name: "demo photo.webp",
		alt: "",
		caption: "",
		tags: [],
		takenAt: "",
	});
});

test("相册标签与照片标签稳定合并并去重", () => {
	assert.deepEqual(mergePhotoTags(["旧博客", "生活"], ["生活", "广州"]), [
		"旧博客",
		"生活",
		"广州",
	]);
});

test("散落坐标稳定且处于安全范围", () => {
	const first = getScatterPlacement("cat-cloud.webp", 1, 5);
	const second = getScatterPlacement("cat-cloud.webp", 1, 5);

	assert.deepEqual(first, second);
	assert.ok(first.x >= 14 && first.x <= 86);
	assert.ok(first.y >= 16 && first.y <= 84);
	assert.ok(first.rotation >= -12 && first.rotation <= 12);
	assert.ok(first.delay >= 0 && first.delay <= 320);
});
