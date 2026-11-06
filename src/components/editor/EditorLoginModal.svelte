<script lang="ts">
/**
 * 站长登录弹窗
 *
 * 复用站内既有的 `.privacy-modal` 骨架（dialog + overlay + panel），
 * 只补自己的内层样式，避免再造一套弹窗壳。
 *
 * 登录走 GitHub OAuth：点按钮 → 整页跳到 GitHub 授权页 → 回跳本页。
 * 这里**不收任何凭据**，客户端也拿不到 token —— 换 token 和校验「是不是站长」
 * 都在 Cloudflare Worker 里做，token 存进 HttpOnly Cookie。
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
			<h2 id="editor-login-title" class="privacy-title">站长登录</h2>
			<button class="privacy-close" type="button" onclick={close} aria-label="关闭">
				<X size={20} aria-hidden="true" />
			</button>
		</div>

		<div class="privacy-body editor-login__body">
			<div class="editor-login__badge">
				<Github size={22} aria-hidden="true" />
			</div>

			<p class="editor-login__desc">
				{$editorUi.loginHint || "用站长的 GitHub 账号登录后，页面里每个模块都会出现编辑按钮。"}
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
						只申请 <code>public_repo</code> 权限：仅能读写这个博客的公开仓库，碰不到你的其它项目
					</span>
				</li>
				<li>
					<ShieldCheck size={12} aria-hidden="true" />
					<span>访问令牌保存在 HttpOnly Cookie 里，页面上的脚本读不到它</span>
				</li>
			</ul>

			<p class="editor-login__fineprint">
				不是站长也没关系，登录会在服务端被直接拒绝，不会留下任何东西。
			</p>
		</div>
	</div>
</dialog>
