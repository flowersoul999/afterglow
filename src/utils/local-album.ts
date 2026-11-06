import type { Dirent } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";

const LOCAL_ALBUM_EXTENSIONS = new Set([
	".avif",
	".gif",
	".jpeg",
	".jpg",
	".png",
	".webp",
]);

export interface LocalAlbumPhoto {
	name: string;
	src: string;
}

export interface ScanLocalAlbumOptions {
	rootDir: string;
	folder: string;
	publicBase?: string;
}

function encodePublicPath(value: string): string {
	return value
		.split("/")
		.filter(Boolean)
		.map((segment) => encodeURIComponent(segment))
		.join("/");
}

export async function scanLocalAlbumPhotos({
	rootDir,
	folder,
	publicBase = "/assets/images/albums",
}: ScanLocalAlbumOptions): Promise<LocalAlbumPhoto[]> {
	const normalizedFolder = folder
		.replaceAll("\\", "/")
		.replace(/^\/+|\/+$/gu, "");
	if (!normalizedFolder) return [];

	const resolvedRoot = path.resolve(rootDir);
	const resolvedFolder = path.resolve(resolvedRoot, normalizedFolder);
	const relativeFolder = path.relative(resolvedRoot, resolvedFolder);
	if (
		!relativeFolder ||
		relativeFolder.startsWith(`..${path.sep}`) ||
		relativeFolder === ".." ||
		path.isAbsolute(relativeFolder)
	) {
		throw new Error("相册目录必须位于本地相册根目录内");
	}

	const photos: LocalAlbumPhoto[] = [];

	async function walk(currentDir: string, relativeDir = ""): Promise<void> {
		let entries: Dirent[];
		try {
			entries = await readdir(currentDir, { withFileTypes: true });
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
			throw error;
		}

		entries.sort((left, right) => left.name.localeCompare(right.name, "en"));
		for (const entry of entries) {
			if (entry.name.startsWith(".") || entry.isSymbolicLink()) continue;

			const relativeName = relativeDir
				? `${relativeDir}/${entry.name}`
				: entry.name;
			const absolutePath = path.join(currentDir, entry.name);
			if (entry.isDirectory()) {
				await walk(absolutePath, relativeName);
				continue;
			}

			if (
				!entry.isFile() ||
				!LOCAL_ALBUM_EXTENSIONS.has(path.extname(entry.name).toLowerCase())
			) {
				continue;
			}

			photos.push({
				name: relativeName,
				src: `${publicBase.replace(/\/+$/u, "")}/${encodePublicPath(
					`${normalizedFolder}/${relativeName}`,
				)}`,
			});
		}
	}

	await walk(resolvedFolder);
	return photos;
}
