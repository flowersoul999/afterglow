/**
 * 编辑器 UI 状态（弹窗开合、抽屉模式）
 *
 * 导航栏按钮、页面内的编辑按钮、抽屉本体分处三个组件，彼此不能互相引用，
 * 所以把「谁打开了什么」抽成一份共享状态，由 EditorRoot 统一渲染。
 *
 * 用 store 契约而不是 `.svelte.ts` 的 runes，原因同 editor-store.ts。
 */

export type MomentDrawerMode = "create" | "edit";

export interface EditorUiSnapshot {
	loginOpen: boolean;
	/** 打开登录框的由头，显示成副标题（比如「登录后才能编辑」） */
	loginHint: string;
	momentOpen: boolean;
	momentMode: MomentDrawerMode;
	/** 编辑时的 entry.id，形如 `2026/09/2026-09-11` */
	momentId: string;
	/** 从卡片上点「删除」进来时，抽屉加载完直接进入待确认状态 */
	momentIntent: "edit" | "delete";
}

type Listener = (snapshot: EditorUiSnapshot) => void;

export class EditorUi {
	private snapshot: EditorUiSnapshot = {
		loginOpen: false,
		loginHint: "",
		momentOpen: false,
		momentMode: "create",
		momentId: "",
		momentIntent: "edit",
	};

	private listeners: Set<Listener> = new Set();

	subscribe(listener: Listener): () => void {
		this.listeners.add(listener);
		listener(this.snapshot);
		return () => {
			this.listeners.delete(listener);
		};
	}

	private patch(partial: Partial<EditorUiSnapshot>): void {
		this.snapshot = { ...this.snapshot, ...partial };
		for (const listener of this.listeners) {
			listener(this.snapshot);
		}
	}

	get loginOpen(): boolean {
		return this.snapshot.loginOpen;
	}

	get momentOpen(): boolean {
		return this.snapshot.momentOpen;
	}

	openLogin(hint = ""): void {
		this.patch({ loginHint: hint, loginOpen: true });
	}

	closeLogin(): void {
		this.patch({ loginOpen: false, loginHint: "" });
	}

	openMomentCreate(): void {
		this.patch({
			momentMode: "create",
			momentId: "",
			momentIntent: "edit",
			momentOpen: true,
		});
	}

	openMomentEdit(id: string, intent: "edit" | "delete" = "edit"): void {
		this.patch({
			momentMode: "edit",
			momentId: id,
			momentIntent: intent,
			momentOpen: true,
		});
	}

	closeMoment(): void {
		this.patch({ momentOpen: false });
	}
}

export const editorUi: EditorUi = new EditorUi();
