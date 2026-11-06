/**
 * 站长登录态（全局单例 store）
 *
 * 为什么不用 `.svelte.ts` + runes：本项目的类型检查是裸 `tsc --isolatedDeclarations`，
 * 它不认识 `$state` 这类编译期宏（那是 svelte2tsx 的活），写 `.svelte.ts` 会直接
 * 卡在 `Cannot find name '$state'`。这里改用 Svelte 官方 store 契约（一个
 * `subscribe` 方法），组件里照样写 `$editor.isEditor`，行为一致且类型干净。
 *
 * 登录方式是 GitHub OAuth：点登录 → 整页跳到 GitHub 授权 → 回跳。
 * 换回来的 token 由边缘函数封进 HttpOnly Cookie，**页面脚本读不到**，
 * 所以这里不再保存任何token，只缓存一份「我是谁」用于渲染。
 */

import {
	EditorApiError,
	type EditorIdentity,
	fetchSession,
	gotoLogin,
	logoutSession,
	probeLoginService,
} from "./github-client";

export type EditorStatus = "idle" | "checking" | "authed";

export interface EditorToast {
	text: string;
	kind: "ok" | "err";
	id: number;
}

export interface EditorSnapshot {
	identity: EditorIdentity | null;
	status: EditorStatus;
	error: string;
	toast: EditorToast | null;
	/** 登录成功，页面内编辑按钮靠它显隐 */
	isEditor: boolean;
	branch: string;
	/** 登录服务是否可用；false 说明边缘函数没部署或环境变量没配 */
	available: boolean;
}

type Listener = (snapshot: EditorSnapshot) => void;

/**
 * OAuth 回跳时边缘函数会带 `?auth=ok` 或 `?auth=error&reason=…`，
 * 这里把原因翻成人话 —— 用户看到的应该是「怎么回事」，不是错误码。
 */
const REASON_TEXT: Record<string, string> = {
	denied: "你在 GitHub 那边取消了授权",
	not_owner: "这个 GitHub 账号不是站长，登录被拒绝了",
	state_missing: "登录链接不完整，重新点一次登录",
	state_invalid: "登录链接已过期，重新点一次登录",
	exchange_failed: "GitHub 没有换到访问令牌，稍后重试",
	profile_failed: "读不到 GitHub 账号资料，稍后重试",
	not_configured:
		"站点还没配置 GitHub OAuth，请检查 Cloudflare Worker 的环境变量",
};

function emptySnapshot(): EditorSnapshot {
	return {
		identity: null,
		status: "idle",
		error: "",
		toast: null,
		isEditor: false,
		branch: "main",
		available: true,
	};
}

/** 页面内的编辑按钮靠这个类显隐，写在 <html> 上便于全局 CSS 一把控制 */
function syncDocumentFlag(active: boolean): void {
	if (typeof document === "undefined") return;
	document.documentElement.classList.toggle("is-editor", active);
}

function describeReason(reason: string): string {
	return REASON_TEXT[reason] ?? "登录失败，稍后重试";
}

export class EditorStore {
	private snapshot: EditorSnapshot = emptySnapshot();
	private listeners: Set<Listener> = new Set();
	private toastTimer: ReturnType<typeof setTimeout> | null = null;
	private toastSeq = 0;
	/** 导航栏入口和 EditorRoot 都会调 bootstrap，加个在途标记免得探两次 */
	private booting = false;
	/** OAuth 回跳带了 `?auth=ok`，等登录态确认后再提示成功 */
	private justAuthed = false;

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

	get branch(): string {
		return this.snapshot.branch;
	}

	get status(): EditorStatus {
		return this.snapshot.status;
	}

	/**
	 * 组件挂载时调用：先消化 OAuth 回跳带回来的结果，再探一次登录态。
	 * SPA 导航不会重新执行模块，所以只在首次挂载时真正请求一次。
	 */
	async bootstrap(): Promise<void> {
		if (this.booting) return;
		this.booting = true;
		try {
			this.consumeCallback();
			if (this.snapshot.status === "authed") return;
			// 已经确认过登录服务不在，就别每次挂载都白打一轮
			if (!this.snapshot.available) return;

			this.patch({ status: "checking" });
			try {
				const identity = await fetchSession();
				this.applyIdentity(identity);
				if (this.justAuthed) {
					this.justAuthed = false;
					this.notify("GitHub 登录成功，资料卡里有「后台」入口");
				}
			} catch (error) {
				// 401 = 没登录，是常态，不该在界面上报错
				const offline = error instanceof EditorApiError && error.status === 404;
				this.patch({
					identity: null,
					status: "idle",
					isEditor: false,
					available: !offline,
				});
			}
		} finally {
			this.booting = false;
		}
	}

	/**
	 * 读 URL 上的 `?auth=ok|error&reason=…`，提示一句然后把参数抹掉。
	 * 不抹的话刷新一次又弹一遍，而且分享出去的链接会带上莫名其妙的参数。
	 */
	private consumeCallback(): void {
		if (typeof window === "undefined") return;
		const url = new URL(window.location.href);
		const flag = url.searchParams.get("auth");
		if (!flag) return;

		const reason = url.searchParams.get("reason") ?? "";
		url.searchParams.delete("auth");
		url.searchParams.delete("reason");
		window.history.replaceState(window.history.state, "", url.toString());

		// 成功时先记一笔，等 fetchSession 确认 Cookie 真的生效了再提示 ——
		// Cookie 没写进去（比如被浏览器拦了第三方策略）的话，这里提示成功就是骗人
		if (flag === "ok") {
			this.justAuthed = true;
			return;
		}

		const text = describeReason(reason);
		this.patch({ error: text });
		this.notify(text, "err");
	}

	private applyIdentity(identity: EditorIdentity): void {
		syncDocumentFlag(true);
		this.patch({
			identity,
			status: "authed",
			error: "",
			isEditor: true,
			available: true,
			branch: identity.defaultBranch,
		});
	}

	/**
	 * 发起登录：先确认登录服务在，再整页跳 GitHub。
	 * 探测这一步是为了在边缘函数没生效时给出确切原因，而不是把用户甩到 404 页。
	 */
	async startLogin(): Promise<void> {
		this.patch({ status: "checking", error: "" });

		const probe = await probeLoginService();
		if (!probe.ok) {
			this.patch({ status: "idle", available: false, error: probe.message });
			return;
		}

		if (typeof window === "undefined") return;
		gotoLogin(`${window.location.pathname}${window.location.search}`);
	}

	async logout(): Promise<void> {
		try {
			await logoutSession();
		} catch {
			// 服务端清不掉也不能把前端卡在登录态里
		}
		syncDocumentFlag(false);
		this.patch(emptySnapshot());
		this.notify("已退出登录");
	}

	/** 把各类失败翻成一句人话，别把 GitHub 的英文原文糊到脸上 */
	describeError(error: unknown): string {
		if (error instanceof EditorApiError) {
			if (error.status === 401) return "登录已过期，重新登录一次";
			if (error.status === 403) return error.message || "没有权限执行这个操作";
			if (error.status === 404)
				return "内容接口不存在，请在 Cloudflare 重新部署最新版 Worker（需包含 /api/github/tree），并检查 /api/github/* 路由";
			if (error.status === 409) return "文件刚被改过，刷新页面后再试";
			if (error.status === 422)
				return "提交被拒绝：文件可能已存在，或内容格式不对";
			return `提交失败：${error.message}`;
		}
		if (error instanceof TypeError) {
			return "连不上服务器，检查一下网络或代理";
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
