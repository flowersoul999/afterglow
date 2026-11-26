<script lang="ts">
/**
 * GitHub 登录弹窗（所有人都能登）
 *
 * 复用站内既有的 `.privacy-modal` 骨架（dialog + overlay + panel），
 * 只补自己的内层样式，避免再造一套弹窗壳。
 *
 * 登录走 GitHub OAuth：点按钮 → 整页跳到 GitHub 授权页 → 回跳本页。
 * 这里**不收任何凭据**，客户端也拿不到 token —— 换 token 都在 Cloudflare
 * Worker 里做，token 存进 HttpOnly Cookie。
 *
 * 2026-11-26 起对所有人开放：普通访客登录只为在留言板留个 GitHub 身份；
 * 「是不是站长」由 Worker 比对 GitHub 账号名后写进 session，前端只读结果。
 */
import { Github, ShieldCheck, X } from "lucide-svelte";
import { editor } from "@/utils/editor/editor-store";
import { editorUi } from "@/utils/editor/editor-ui";

let dialog: HTMLDialogElement | null = $state(null);

const checking = $derived($editor.status === "checking");

function syncDialog(open: boolean): void {
	if (!dialog) return;
	if (open && !dialog.open) {
		dialog.showModal();
		document.body.style.overflow = "hidden";
	} else if (!open && dialog.open) {
		dialog.close();
	}
}

$effect(() => {
	syncDialog($editorUi.loginOpen);
});

function close(): void {
	editorUi.closeLogin();
	document.body.style.overflow = "";
}

async function startLogin(): Promise<void> {
	// 探测失败时 store 会把原因写进 error，这里不用自己管状态
	await editor.startLogin();
}
</script>

<dialog
	bind:this={dialog}
	class="privacy-modal editor-login"
	aria-labelledby="editor-login-title"
	onclose={() => {
		editorUi.closeLogin();
		document.body.style.overflow = "";
	}}
	oncancel={(event) => {
		event.preventDefault();
		close();
	}}
>
	<div
		class="privacy-overlay"
		role="button"
		tabindex="-1"
		onclick={close}
		onkeydown={(event) => {
			if (event.key === "Enter" || event.key === " ") close();
		}}
	></div>

	<div class="privacy-panel editor-login__panel">
		<div class="privacy-header">
			<h2 id="editor-login-title" class="privacy-title">GitHub 登录</h2>
			<button class="privacy-close" type="button" onclick={close} aria-label="关闭">
				<X size={20} aria-hidden="true" />
			</button>
		</div>

		<div class="privacy-body editor-login__body">
			<div class="editor-login__badge">
				<Github size={22} aria-hidden="true" />
			</div>

			<p class="editor-login__desc">
				{$editorUi.loginHint ||
					"用 GitHub 登录后，留言会自动带上你的头像和昵称；如果你是站长，菜单里还会多出「内容管理」。"}
			</p>

			<button
				type="button"
				class="editor-login__submit editor-login__submit--github"
				disabled={checking}
				onclick={() => void startLogin()}
			>
				<Github size={17} aria-hidden="true" />
				<span>{checking ? "正在前往 GitHub…" : "使用 GitHub 登录"}</span>
			</button>

			{#if $editor.error}
				<p class="editor-login__error">{$editor.error}</p>
			{/if}

			<ul class="editor-login__notes">
				<li>
					<ShieldCheck size={12} aria-hidden="true" />
					<span>
						站点只读你的公开资料（昵称、头像）用于显示；申请 <code
							>public_repo</code
						> 是为了站长能提交文章改动，写操作在后端只放行站长账号
					</span>
				</li>
				<li>
					<ShieldCheck size={12} aria-hidden="true" />
					<span>碰不到你的私有仓库和邮箱；令牌存在 HttpOnly Cookie 里，页面脚本读不到</span>
				</li>
			</ul>

			<p class="editor-login__fineprint">
				登录完全自愿：不登录也能正常留言，只是要自己填一遍昵称。用不着了就在导航栏退出，随时可撤。
			</p>
		</div>
	</div>
</dialog>
