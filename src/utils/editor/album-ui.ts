/**
 * 相册编辑弹窗的 UI 状态
 *
 * 和 editor-ui.ts 是同一套路：相册页的管理按钮是 Astro 静态 DOM（交互写在
 * album/index.astro 的内联脚本里），弹窗本体是常驻在 EditorRoot 里的 Svelte
 * 组件，两边够不着彼此，所以用一份 store 串起来。
 *
 * 单独开一个 store 而不是塞进 EditorUi：说说抽屉和相册弹窗的字段几乎不重叠，
 * 混在一个快照里只会让两边都读到一堆用不上的空字段。
 */

export type AlbumDrawerMode = "create" | "edit";

export interface AlbumUiSnapshot {
	open: boolean;
	mode: AlbumDrawerMode;
	/** 目标相册的 entry.id，如 `old-jojo-gallery` */
	albumId: string;
	/** 编辑模式下要改的那张照片的 src；新增模式留空 */
	src: string;
}

type Listener = (snapshot: AlbumUiSnapshot) => void;

export class AlbumUi {
	private snapshot: AlbumUiSnapshot = {
		open: false,
		mode: "create",
		albumId: "",
		src: "",
	};

	private listeners: Set<Listener> = new Set();

	subscribe(listener: Listener): () => void {
		this.listeners.add(listener);
		listener(this.snapshot);
		return () => {
			this.listeners.delete(listener);
		};
	}

	private patch(partial: Partial<AlbumUiSnapshot>): void {
		this.snapshot = { ...this.snapshot, ...partial };
		for (const listener of this.listeners) {
			listener(this.snapshot);
		}
	}

	get open(): boolean {
		return this.snapshot.open;
	}

	openCreate(albumId: string): void {
		this.patch({ mode: "create", albumId, src: "", open: true });
	}

	openEdit(albumId: string, src: string): void {
		this.patch({ mode: "edit", albumId, src, open: true });
	}

	close(): void {
		this.patch({ open: false });
	}
}

export const albumUi: AlbumUi = new AlbumUi();
