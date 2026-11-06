import { getScatterPlacement } from "@/utils/album-gallery";

type AlbumViewMode = "scatter" | "wall";

interface AlbumPayloadPhoto {
	src: string;
	name: string;
	alt: string;
	caption: string;
	tags: string[];
	takenAt: string;
	takenAtText: string;
}

interface AlbumPayload {
	id: string;
	title: string;
	date: string;
	dateText: string;
	location: string;
	tags: string[];
	folder: string;
	photos: AlbumPayloadPhoto[];
}

interface CardDragState {
	card: HTMLButtonElement;
	pointerId: number;
	startX: number;
	startY: number;
	originX: number;
	originY: number;
	cardRect: DOMRect;
	stageRect: DOMRect;
	moved: boolean;
}

interface NoteDragState {
	pointerId: number;
	startX: number;
	startY: number;
	originX: number;
	originY: number;
}

const VIEW_STORAGE_KEY = "album-gallery-view";
const OFFSET_STORAGE_PREFIX = "album-photo-offset:";
const DRAG_THRESHOLD = 5;
const CARD_EDGE_MARGIN = 12;

function parseJson<T>(value: string | null, fallback: T): T {
	if (!value) return fallback;
	try {
		return JSON.parse(value) as T;
	} catch {
		return fallback;
	}
}

function loadOffset(key: string): { x: number; y: number } {
	try {
		return parseJson(localStorage.getItem(`${OFFSET_STORAGE_PREFIX}${key}`), {
			x: 0,
			y: 0,
		});
	} catch {
		return { x: 0, y: 0 };
	}
}

function saveOffset(key: string, x: number, y: number): void {
	try {
		localStorage.setItem(
			`${OFFSET_STORAGE_PREFIX}${key}`,
			JSON.stringify({ x, y }),
		);
	} catch {
		// 隐私模式或存储空间不足时仍保留本次拖动结果。
	}
}

function clearOffset(key: string): void {
	try {
		localStorage.removeItem(`${OFFSET_STORAGE_PREFIX}${key}`);
	} catch {
		// localStorage 不可用时无需额外处理。
	}
}

function clamp(value: number, minimum: number, maximum: number): number {
	return Math.min(maximum, Math.max(minimum, value));
}

function readCardTags(card: HTMLElement): string[] {
	return parseJson<string[]>(card.dataset.photoTags || "", []);
}

function setCardOffset(card: HTMLElement, x: number, y: number): void {
	card.dataset.offsetX = String(x);
	card.dataset.offsetY = String(y);
	card.style.setProperty("--album-drag-x", `${x}px`);
	card.style.setProperty("--album-drag-y", `${y}px`);
}

function cardOffset(card: HTMLElement): { x: number; y: number } {
	return {
		x: Number(card.dataset.offsetX || 0),
		y: Number(card.dataset.offsetY || 0),
	};
}

function createPhotoCard(
	album: AlbumPayload,
	photo: AlbumPayloadPhoto,
): HTMLButtonElement {
	const card = document.createElement("button");
	card.type = "button";
	card.className = "alb-photo";
	card.dataset.photoCard = "";
	card.dataset.photoKey = `${album.id}:${photo.src}`;
	card.dataset.albumId = album.id;
	card.dataset.albumTitle = album.title;
	card.dataset.photoSrc = photo.src;
	card.dataset.photoAlt = photo.alt || photo.caption || album.title;
	card.dataset.photoCaption = photo.caption;
	card.dataset.photoTags = JSON.stringify(photo.tags);
	card.dataset.photoDate = photo.takenAtText || album.dateText;
	card.dataset.photoLocation = album.location;
	card.dataset.search = [
		album.title,
		album.location,
		photo.name,
		photo.caption,
		...photo.tags,
	]
		.join(" ")
		.toLocaleLowerCase("zh-CN");
	card.setAttribute(
		"aria-label",
		photo.caption ? `查看照片：${photo.caption}` : `查看${album.title}中的照片`,
	);

	const frame = document.createElement("span");
	frame.className = "alb-photo__frame";
	const image = document.createElement("img");
	image.loading = "lazy";
	image.decoding = "async";
	image.draggable = false;
	image.src = photo.src;
	image.alt = photo.alt || photo.caption || album.title;
	frame.append(image);

	if (photo.caption) {
		const caption = document.createElement("span");
		caption.className = "alb-photo__caption";
		caption.textContent = photo.caption;
		frame.append(caption);
	}

	card.append(frame);
	return card;
}

function mountAlbumGallery(root: HTMLElement): () => void {
	if (root.dataset.albumReady === "true") return () => undefined;
	root.dataset.albumReady = "true";

	const controller = new AbortController();
	const { signal } = controller;
	const stage = root.querySelector<HTMLElement>("[data-album-stage]");
	const searchInput = root.querySelector<HTMLInputElement>(
		"[data-album-search]",
	);
	const searchClear = root.querySelector<HTMLButtonElement>(
		"[data-album-search-clear]",
	);
	const clearFilters = root.querySelector<HTMLButtonElement>(
		"[data-album-clear-filters]",
	);
	const resetButton =
		root.querySelector<HTMLButtonElement>("[data-album-reset]");
	const countElement = root.querySelector<HTMLElement>("[data-album-count]");
	const emptyElement = root.querySelector<HTMLElement>("[data-album-empty]");
	const payloadElement = root.querySelector<HTMLScriptElement>(
		"[data-album-payload]",
	);
	const dialog = root.querySelector<HTMLDialogElement>("[data-album-lightbox]");
	const lightboxImage = root.querySelector<HTMLImageElement>(
		"[data-album-lightbox-image]",
	);
	const lightboxCounter = root.querySelector<HTMLElement>(
		"[data-album-lightbox-counter]",
	);
	const lightboxDate = root.querySelector<HTMLElement>(
		"[data-album-lightbox-date]",
	);
	const lightboxCaption = root.querySelector<HTMLElement>(
		"[data-album-lightbox-caption]",
	);
	const lightboxTags = root.querySelector<HTMLElement>(
		"[data-album-lightbox-tags]",
	);
	const lightboxNote = root.querySelector<HTMLElement>(
		"[data-album-lightbox-note]",
	);

	if (!stage) return () => controller.abort();
	const galleryStage = stage;

	const albums = parseJson<AlbumPayload[]>(
		payloadElement?.textContent || "",
		[],
	);
	let mode: AlbumViewMode =
		localStorage.getItem(VIEW_STORAGE_KEY) === "wall" ? "wall" : "scatter";
	let query = "";
	let albumId = "";
	let visibleCards: HTMLButtonElement[] = [];
	let currentLightboxIndex = -1;
	let topZIndex = 20;
	let cardDrag: CardDragState | null = null;
	let noteDrag: NoteDragState | null = null;
	let noteX = 0;
	let noteY = 0;

	const cards = (): HTMLButtonElement[] => [
		...galleryStage.querySelectorAll<HTMLButtonElement>("[data-photo-card]"),
	];

	function syncModeButtons(): void {
		root
			.querySelectorAll<HTMLButtonElement>("[data-album-view]")
			.forEach((button) => {
				const active = button.dataset.albumView === mode;
				button.classList.toggle("is-active", active);
				button.setAttribute("aria-pressed", String(active));
			});
		if (resetButton) resetButton.hidden = mode !== "scatter";
	}

	function restoreCardOffsets(): void {
		for (const card of cards()) {
			const key = card.dataset.photoKey || "";
			const offset = loadOffset(key);
			setCardOffset(card, offset.x, offset.y);
		}
	}

	function applyScatterLayout(): void {
		visibleCards.forEach((card, index) => {
			const key = card.dataset.photoKey || String(index);
			const placement = getScatterPlacement(key, index, visibleCards.length);
			card.style.setProperty("--album-x", `${placement.x}%`);
			card.style.setProperty("--album-y", `${placement.y}%`);
			card.style.setProperty(
				"--album-rotation",
				`${placement.rotation.toFixed(2)}deg`,
			);
			card.style.setProperty("--album-delay", `${placement.delay}ms`);
			card.style.setProperty("--album-z", String(index + 1));
		});
	}

	function applyFilters(): void {
		visibleCards = [];
		for (const card of cards()) {
			const matchesAlbum = !albumId || card.dataset.albumId === albumId;
			const matchesQuery =
				!query || (card.dataset.search || "").includes(query);
			const visible = matchesAlbum && matchesQuery;
			card.hidden = !visible;
			if (visible) visibleCards.push(card);
		}

		const filtering = Boolean(albumId || query);
		if (countElement) {
			countElement.textContent = filtering
				? `已筛 ${visibleCards.length} 张`
				: `${visibleCards.length} 张照片`;
		}
		if (clearFilters) clearFilters.hidden = !filtering;
		if (emptyElement) emptyElement.hidden = visibleCards.length > 0;
		applyScatterLayout();
	}

	function setMode(nextMode: AlbumViewMode): void {
		mode = nextMode;
		root.dataset.albumViewMode = mode;
		try {
			localStorage.setItem(VIEW_STORAGE_KEY, mode);
		} catch {
			// 视图偏好无法持久化时仍保持当前会话状态。
		}
		syncModeButtons();
		applyScatterLayout();
	}

	function syncAlbumTabs(): void {
		root
			.querySelectorAll<HTMLButtonElement>("[data-album-filter-id]")
			.forEach((button) => {
				const active = (button.dataset.albumFilterId || "") === albumId;
				button.classList.toggle("is-active", active);
				button.setAttribute("aria-pressed", String(active));
			});
	}

	function resetFilters(): void {
		query = "";
		albumId = "";
		if (searchInput) searchInput.value = "";
		if (searchClear) searchClear.hidden = true;
		syncAlbumTabs();
		applyFilters();
	}

	function resetOffsets(): void {
		for (const card of cards()) {
			clearOffset(card.dataset.photoKey || "");
			setCardOffset(card, 0, 0);
		}
	}

	function renderLightbox(index: number): void {
		const card = visibleCards[index];
		if (!card || !lightboxImage) return;
		currentLightboxIndex = index;
		lightboxImage.src = card.dataset.photoSrc || "";
		lightboxImage.alt = card.dataset.photoAlt || "";
		if (lightboxCounter) {
			lightboxCounter.textContent = `${index + 1} / ${visibleCards.length}`;
		}
		if (lightboxDate) {
			lightboxDate.textContent = [
				card.dataset.photoDate,
				card.dataset.photoLocation,
			]
				.filter(Boolean)
				.join(" · ");
		}
		if (lightboxCaption) {
			lightboxCaption.textContent =
				card.dataset.photoCaption || card.dataset.albumTitle || "一张照片";
		}
		if (lightboxTags) {
			lightboxTags.replaceChildren();
			for (const tag of readCardTags(card)) {
				const chip = document.createElement("span");
				chip.textContent = `#${tag}`;
				lightboxTags.append(chip);
			}
		}
		noteX = 0;
		noteY = 0;
		if (lightboxNote) {
			lightboxNote.style.transform = "translate3d(0, 0, 0)";
			lightboxNote.dataset.noteTone = String(index % 5);
		}
	}

	function openLightbox(card: HTMLButtonElement): void {
		const index = visibleCards.indexOf(card);
		if (index < 0 || !dialog) return;
		renderLightbox(index);
		if (!dialog.open) dialog.showModal();
	}

	function closeLightbox(): void {
		if (dialog?.open) dialog.close();
	}

	function stepLightbox(delta: number): void {
		if (!visibleCards.length) return;
		const next =
			(currentLightboxIndex + delta + visibleCards.length) %
			visibleCards.length;
		renderLightbox(next);
	}

	function updateCardDrag(event: PointerEvent): void {
		if (!cardDrag || event.pointerId !== cardDrag.pointerId) return;
		const deltaX = event.clientX - cardDrag.startX;
		const deltaY = event.clientY - cardDrag.startY;
		if (!cardDrag.moved && Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD) {
			return;
		}

		cardDrag.moved = true;
		cardDrag.card.classList.add("is-dragging");
		const movementX = clamp(
			deltaX,
			cardDrag.stageRect.left + CARD_EDGE_MARGIN - cardDrag.cardRect.left,
			cardDrag.stageRect.right - CARD_EDGE_MARGIN - cardDrag.cardRect.right,
		);
		const movementY = clamp(
			deltaY,
			cardDrag.stageRect.top + CARD_EDGE_MARGIN - cardDrag.cardRect.top,
			cardDrag.stageRect.bottom - CARD_EDGE_MARGIN - cardDrag.cardRect.bottom,
		);
		setCardOffset(
			cardDrag.card,
			cardDrag.originX + movementX,
			cardDrag.originY + movementY,
		);
	}

	function finishCardDrag(event: PointerEvent): void {
		if (!cardDrag || event.pointerId !== cardDrag.pointerId) return;
		const { card, moved } = cardDrag;
		card.classList.remove("is-dragging");
		if (moved) {
			const offset = cardOffset(card);
			saveOffset(card.dataset.photoKey || "", offset.x, offset.y);
			card.dataset.dragged = "true";
			window.setTimeout(() => {
				delete card.dataset.dragged;
			}, 0);
		}
		cardDrag = null;
	}

	function updateNoteDrag(event: PointerEvent): void {
		if (!noteDrag || event.pointerId !== noteDrag.pointerId || !lightboxNote)
			return;
		noteX = noteDrag.originX + event.clientX - noteDrag.startX;
		noteY = noteDrag.originY + event.clientY - noteDrag.startY;
		lightboxNote.style.transform = `translate3d(${noteX}px, ${noteY}px, 0)`;
	}

	function listFolder(album: AlbumPayload): Promise<AlbumPayloadPhoto[]> {
		const baseUrl = root.dataset.albumBedUrl || "";
		const token = root.dataset.albumBedToken || "";
		if (!baseUrl || !token || !album.folder) return Promise.resolve([]);

		const output: AlbumPayloadPhoto[] = [];
		let start = 0;
		const readPage = async (): Promise<AlbumPayloadPhoto[]> => {
			const response = await fetch(
				`${baseUrl}/api/manage/list?dir=${encodeURIComponent(album.folder)}&start=${start}&count=100`,
				{
					headers: { Authorization: `Bearer ${token}` },
					signal,
				},
			);
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			const data = (await response.json()) as {
				files?: Array<{
					name: string;
					metadata?: { FileType?: string };
				}>;
			};
			const files = (data.files || []).filter((file) =>
				file.metadata?.FileType?.startsWith("image/"),
			);
			output.push(
				...files.map((file) => ({
					src: `${baseUrl}/file/${file.name}`,
					name: file.name,
					alt: "",
					caption: "",
					tags: album.tags,
					takenAt: album.date,
					takenAtText: album.dateText,
				})),
			);
			if ((data.files || []).length < 100) return output;
			start += 100;
			return readPage();
		};
		return readPage();
	}

	async function loadRemotePhotos(): Promise<void> {
		const remoteAlbums = albums.filter(
			(album) => album.photos.length === 0 && album.folder,
		);
		if (!remoteAlbums.length) return;
		const results = await Promise.allSettled(
			remoteAlbums.map(async (album) => ({
				album,
				photos: await listFolder(album),
			})),
		);
		for (const result of results) {
			if (result.status !== "fulfilled") continue;
			for (const photo of result.value.photos) {
				galleryStage.append(createPhotoCard(result.value.album, photo));
			}
		}
		restoreCardOffsets();
		applyFilters();
	}

	root.addEventListener(
		"click",
		(event) => {
			const target = event.target as HTMLElement;
			const viewButton = target.closest<HTMLButtonElement>("[data-album-view]");
			if (viewButton) {
				setMode(viewButton.dataset.albumView === "wall" ? "wall" : "scatter");
				return;
			}
			const albumButton = target.closest<HTMLButtonElement>(
				"[data-album-filter-id]",
			);
			if (albumButton) {
				const selected = albumButton.dataset.albumFilterId || "";
				albumId = albumId === selected && selected ? "" : selected;
				syncAlbumTabs();
				applyFilters();
				return;
			}
			if (target.closest("[data-album-search-clear]")) {
				query = "";
				if (searchInput) searchInput.value = "";
				if (searchClear) searchClear.hidden = true;
				applyFilters();
				return;
			}
			if (target.closest("[data-album-clear-filters]")) {
				resetFilters();
				return;
			}
			if (target.closest("[data-album-reset]")) {
				resetOffsets();
				return;
			}
			if (target.closest("[data-album-lightbox-close]")) {
				closeLightbox();
				return;
			}
			if (target.closest("[data-album-lightbox-prev]")) {
				stepLightbox(-1);
				return;
			}
			if (target.closest("[data-album-lightbox-next]")) {
				stepLightbox(1);
				return;
			}
			const card = target.closest<HTMLButtonElement>("[data-photo-card]");
			if (card && card.dataset.dragged !== "true") openLightbox(card);
		},
		{ signal },
	);

	searchInput?.addEventListener(
		"input",
		() => {
			query = searchInput.value.trim().toLocaleLowerCase("zh-CN");
			if (searchClear) searchClear.hidden = !searchInput.value;
			applyFilters();
		},
		{ signal },
	);

	root.addEventListener(
		"pointerdown",
		(event) => {
			const target = event.target as HTMLElement;
			const note = target.closest<HTMLElement>("[data-album-lightbox-note]");
			if (note && dialog?.open) {
				noteDrag = {
					pointerId: event.pointerId,
					startX: event.clientX,
					startY: event.clientY,
					originX: noteX,
					originY: noteY,
				};
				note.setPointerCapture(event.pointerId);
				return;
			}

			const card = target.closest<HTMLButtonElement>("[data-photo-card]");
			if (
				!card ||
				mode !== "scatter" ||
				(event.pointerType === "mouse" && event.button !== 0)
			) {
				return;
			}
			const offset = cardOffset(card);
			cardDrag = {
				card,
				pointerId: event.pointerId,
				startX: event.clientX,
				startY: event.clientY,
				originX: offset.x,
				originY: offset.y,
				cardRect: card.getBoundingClientRect(),
				stageRect: galleryStage.getBoundingClientRect(),
				moved: false,
			};
			topZIndex += 1;
			card.style.setProperty("--album-z", String(topZIndex));
			card.setPointerCapture(event.pointerId);
		},
		{ signal },
	);

	root.addEventListener("pointermove", updateCardDrag, { signal });
	root.addEventListener("pointermove", (event) => updateNoteDrag(event), {
		signal,
	});
	root.addEventListener("pointerup", finishCardDrag, { signal });
	root.addEventListener("pointercancel", finishCardDrag, { signal });
	root.addEventListener(
		"pointerup",
		(event) => {
			if (noteDrag?.pointerId === event.pointerId) noteDrag = null;
		},
		{ signal },
	);
	root.addEventListener(
		"pointercancel",
		(event) => {
			if (noteDrag?.pointerId === event.pointerId) noteDrag = null;
		},
		{ signal },
	);

	root.addEventListener(
		"keydown",
		(event) => {
			const card = (event.target as HTMLElement).closest<HTMLButtonElement>(
				"[data-photo-card]",
			);
			if (!card || mode !== "scatter") return;
			const directions: Record<string, [number, number]> = {
				ArrowLeft: [-1, 0],
				ArrowRight: [1, 0],
				ArrowUp: [0, -1],
				ArrowDown: [0, 1],
			};
			const direction = directions[event.key];
			if (!direction) return;
			event.preventDefault();
			const step = event.shiftKey ? 36 : 12;
			const offset = cardOffset(card);
			const x = offset.x + direction[0] * step;
			const y = offset.y + direction[1] * step;
			setCardOffset(card, x, y);
			saveOffset(card.dataset.photoKey || "", x, y);
		},
		{ signal },
	);

	dialog?.addEventListener(
		"click",
		(event) => {
			if (event.target === dialog) closeLightbox();
		},
		{ signal },
	);
	dialog?.addEventListener(
		"keydown",
		(event) => {
			if (event.key === "ArrowLeft") stepLightbox(-1);
			if (event.key === "ArrowRight") stepLightbox(1);
		},
		{ signal },
	);

	window.addEventListener(
		"resize",
		() => {
			if (mode === "scatter") applyScatterLayout();
		},
		{ signal },
	);

	root.dataset.albumViewMode = mode;
	restoreCardOffsets();
	syncModeButtons();
	syncAlbumTabs();
	applyFilters();
	void loadRemotePhotos();

	return () => {
		controller.abort();
		if (dialog?.open) dialog.close();
	};
}

let registered = false;

export function registerAlbumGallery(): void {
	let cleanup: (() => void) | undefined;

	function mount(): void {
		cleanup?.();
		cleanup = undefined;
		const root = document.querySelector<HTMLElement>("[data-album-gallery]");
		if (root) cleanup = mountAlbumGallery(root);
	}

	mount();
	if (registered) return;
	registered = true;
	window.addEventListener("swup:content:replaced", mount);
}
