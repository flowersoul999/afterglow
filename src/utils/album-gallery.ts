export interface AlbumGalleryPhoto {
	src: string;
	name: string;
	alt: string;
	caption: string;
	tags: string[];
	takenAt: string;
}

export interface ScatterPlacement {
	x: number;
	y: number;
	rotation: number;
	delay: number;
}

function readString(value: unknown): string {
	return typeof value === "string" ? value.trim() : "";
}

function readTags(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value
		.map(readString)
		.filter(Boolean)
		.filter((tag, index, tags) => tags.indexOf(tag) === index);
}

function photoName(src: string): string {
	const raw = src.split("?")[0]?.split("#")[0]?.split("/").pop() || src;
	try {
		return decodeURIComponent(raw);
	} catch {
		return raw;
	}
}

export function normalizeAlbumPhoto(photo: unknown): AlbumGalleryPhoto | null {
	if (typeof photo === "string") {
		const src = photo.trim();
		if (!src) return null;
		return {
			src,
			name: photoName(src),
			alt: "",
			caption: "",
			tags: [],
			takenAt: "",
		};
	}

	if (!photo || typeof photo !== "object" || !("src" in photo)) return null;
	const value = photo as Record<string, unknown>;
	const src = readString(value.src);
	if (!src) return null;

	return {
		src,
		name: readString(value.name) || photoName(src),
		alt: readString(value.alt),
		caption: readString(value.caption),
		tags: readTags(value.tags),
		takenAt: readString(value.takenAt),
	};
}

export function mergePhotoTags(
	albumTags: readonly string[],
	photoTags: readonly string[],
): string[] {
	return [...albumTags, ...photoTags]
		.map((tag) => tag.trim())
		.filter(Boolean)
		.filter((tag, index, tags) => tags.indexOf(tag) === index);
}

function stableHash(value: string): number {
	let hash = 2166136261;
	for (let index = 0; index < value.length; index += 1) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}
	return hash >>> 0;
}

export function getScatterPlacement(
	key: string,
	index: number,
	total: number,
): ScatterPlacement {
	const hash = stableHash(key);
	const safeTotal = Math.max(total, 1);
	const progress = Math.sqrt((index + 1) / safeTotal);
	const goldenAngle = Math.PI * (3 - Math.sqrt(5));
	const angle = index * goldenAngle + ((hash % 360) * Math.PI) / 180;
	const radiusX = 34 * progress;
	const radiusY = 30 * progress;
	const jitterX = ((hash >>> 8) % 9) - 4;
	const jitterY = ((hash >>> 16) % 9) - 4;
	const x = Math.min(
		86,
		Math.max(14, 50 + Math.cos(angle) * radiusX + jitterX),
	);
	const y = Math.min(
		84,
		Math.max(16, 50 + Math.sin(angle) * radiusY + jitterY),
	);

	return {
		x: Number(x.toFixed(2)),
		y: Number(y.toFixed(2)),
		rotation: (hash % 2401) / 100 - 12,
		delay: Math.min(index * 55, 320),
	};
}
