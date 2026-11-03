/**
 * 站长登录态（全局单例 store）
 *
 * 为什么不用 `.svelte.ts` + runes：本项目的类型检查是裸 `tsc --isolatedDeclarations`，
 * 它不认识 `$state` 这类编译期宏（那是 svelte2tsx 的活），写 `.svelte.ts` 会直接
 * 卡在 `Cannot find name '$state'`。这里改用 Svelte 官方 store 契约（一个
 * `subscribe` 方法），组件里照样写 `$editor.isEditor`，行为一致且类型干净。
 *
 * 令牌放 sessionStorage 而不是 localStorage：这是明文存储，页面里任何脚本都读得到。
 * 会话级至少能保证关掉标签页就失效，不至于在一台机器上长期留一把能写整个仓库的钥匙。
 * 真要更安全，得把写入挪到服务端代理（Cookie + HttpOnly），届时只换 github-client。
 */

import {
	EditorApiError,
	type EditorIdentity,
	verifyToken,
} from "./github-client";

const TOKEN_KEY: string = "jojo-editor-token";

export type EditorStatus = "idle" | "checking" | "authed";

export interface EditorToast {
	text: string;
	kind: "ok" | "err";
	id: number;
}

export interface EditorSnapshot {
	token: string;
	identity: EditorIdentity | null;
	status: EditorStatus;
	error: string;
	toast: EditorToast | null;
	/** 登录成功且令牌在手，页面内编辑按钮靠它显隐 */
	isEditor: boolean;
	branch: string;
}

type Listener = (snapshot: EditorSnapshot) => void;

function emptySnapshot(): EditorSnapshot {
	return {
		token: "",
		identity: null,
		status: "idle",
		error: "",
		toast: null,
		isEditor: false,
		branch: "main",
	};
}

function readStoredToken(): string {
	try {
		return sessionStorage.getItem(TOKEN_KEY) ?? "";
	} catch {
		// 隐私模式下 sessionStorage 可能直接抛错，退化成「每次都要登录」
		return "";
	}
}

function persistToken(token: string): void {
	try {
		if (token) {
			sessionStorage.setItem(TOKEN_KEY, token);
		} else {
			sessionStorage.removeItem(TOKEN_KEY);
		}
	} catch {
		// 存不住就算了，登录态仍在内存里，只是刷新后会掉
	}
}

/** 页面内的编辑按钮靠这个类显隐，写在 <html> 上便于全局 CSS 一把控制 */
function syncDocumentFlag(active: boolean): void {
	if (typeof document === "undefined") return;
	document.documentElement.classList.toggle("is-editor", active);
}

export class EditorStore {
	private snapshot: EditorSnapshot = emptySnapshot();
	private listeners: Set<Listener> = new Set();
	private toastTimer: ReturnType<typeof setTimeout> | null = null;
	private toastSeq = 0;
	/** 导航栏按钮和 EditorRoot 都会调 bootstrap，加个在途标记免得验两次 */
	private booting = false;

	subscribe(listener: Listener): () => void {
		this.listeners.add(listener);
		listener(this.snapshot);
		return () => {
			this.listeners.delete(listener);
		};
	}

	private patch(partial: Partial<EditorSnapshot>): void {
		this.snapshot = { ...this.snapshot, ...partial };
		for (const listener of this.listeners) {
			listener(this.snapshot);
		}
	}

	/** 命令式读取用，不建立订阅 */
	get isEditor(): boolean {
		return this.snapshot.isEditor;
	}

	get token(): string {
		return this.snapshot.token;
	}

	get branch(): string {
		return this.snapshot.branch;
	}

	get status(): EditorStatus {
		return this.snapshot.status;
	}

	/**
	 * 组件挂载时调用：把上一个页面留下的会话令牌接回来。
	 * SPA 导航不会重新执行模块，所以只在首次挂载时真正请求一次。
	 */
	async bootstrap(): Promise<void> {
		if (this.booting) return;
		const stored = readStoredToken();
		if (!stored || this.snapshot.status !== "idle") return;
		this.booting = true;
		try {
			await this.login(stored, { silent: true });
		} finally {
			this.booting = false;
		}
	}

	async login(
		rawToken: string,
		options: { silent?: boolean } = {},
	): Promise<boolean> {
		const token = rawToken.trim();
		if (!token) {
			this.patch({ error: "请填入 GitHub 访问令牌" });
			return false;
		}

		this.patch({ status: "checking", error: "" });

		try {
			const identity = await verifyToken(token);
			persistToken(token);
			syncDocumentFlag(true);
			this.patch({
				token,
				identity,
				status: "authed",
				error: "",
				isEditor: true,
				branch: identity.defaultBranch,
			});
			if (!options.silent) {
				this.notify(`已登录：${identity.name || identity.login}`);
			}
			return true;
		} catch (error) {
			persistToken("");
			syncDocumentFlag(false);
			this.patch({
				token: "",
				identity: null,
				status: "idle",
				isEditor: false,
				error: this.describeError(error),
			});
			return false;
		}
	}

	logout(): void {
		persistToken("");
		syncDocumentFlag(false);
		this.patch(emptySnapshot());
		this.notify("已退出登录");
	}

	/** 把各类失败翻成一句人话，别把 GitHub 的英文原文糊到脸上 */
	describeError(error: unknown): string {
		if (error instanceof EditorApiError) {
			if (error.status === 401)
				return "令牌无效或已过期，去 GitHub 重新生成一个";
			if (error.status === 403)
				return "令牌权限不足，需要这个仓库的 Contents 读写权限";
			if (error.status === 404)
				return "仓库或文件不存在（也可能是令牌没勾选这个仓库）";
			if (error.status === 409) return "文件刚被改过，刷新页面后再试";
			if (error.status === 422)
				return "提交被拒绝：文件可能已存在，或内容格式不对";
			return `提交失败：${error.message}`;
		}
		if (error instanceof TypeError) {
			return "连不上 GitHub，检查一下网络或代理";
		}
		return error instanceof Error ? error.message : "未知错误";
	}

	/** 轻量提示，3 秒自动消失；同一时刻只显示一条 */
	notify(text: string, kind: "ok" | "err" = "ok"): void {
		this.toastSeq += 1;
		if (this.toastTimer) clearTimeout(this.toastTimer);
		this.patch({ toast: { text, kind, id: this.toastSeq } });
		this.toastTimer = setTimeout(() => {
			this.patch({ toast: null });
		}, 3200);
	}

	dismissToast(): void {
		if (this.toastTimer) clearTimeout(this.toastTimer);
		this.patch({ toast: null });
	}
}

export const editor: EditorStore = new EditorStore();
