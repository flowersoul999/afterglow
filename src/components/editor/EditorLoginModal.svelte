<script lang="ts">
/**
 * 站长登录弹窗
 *
 * 复用站内既有的 `.privacy-modal` 骨架（dialog + overlay + panel），
 * 只补自己的内层样式，避免再造一套弹窗壳。
 *
 * 这里填的是 GitHub 细粒度令牌，不是密码 —— 纯静态站没有服务端，
 * 任何「密码」都只能在前端校验，等于没有。令牌能真正决定写权限，
 * 所以直接把这一点摊开说，别用一个假的密码框骗自己。
 */
import { ExternalLink, Eye, EyeOff, Lock, X } from "lucide-svelte";
import { editor } from "@/utils/editor/editor-store";
import { editorUi } from "@/utils/editor/editor-ui";
import { REPO_NAME, REPO_OWNER } from "@/utils/editor/github-client";

let token = $state("");
let reveal = $state(false);
let showHelp = $state(false);
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

async function submit(event: SubmitEvent): Promise<void> {
	event.preventDefault();
	const ok = await editor.login(token);
	if (ok) {
		token = "";
		close();
	}
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
				<Lock size={20} aria-hidden="true" />
			</div>

			<p class="editor-login__desc">
				{$editorUi.loginHint || "只有你本人登录后，站内才会出现编辑按钮。"}
			</p>

			<form onsubmit={submit}>
				<label class="editor-login__label" for="editor-token">
					GitHub 访问令牌
				</label>
				<div class="editor-login__input-wrap">
					<input
						id="editor-token"
						class="editor-login__input"
						type={reveal ? "text" : "password"}
						autocomplete="off"
						spellcheck="false"
						placeholder="github_pat_..."
						bind:value={token}
						disabled={checking}
					/>
					<button
						type="button"
						class="editor-login__reveal"
						aria-label={reveal ? "隐藏令牌" : "显示令牌"}
						onclick={() => (reveal = !reveal)}
					>
						{#if reveal}
							<EyeOff size={15} aria-hidden="true" />
						{:else}
							<Eye size={15} aria-hidden="true" />
						{/if}
					</button>
				</div>

				{#if $editor.error}
					<p class="editor-login__error">{$editor.error}</p>
				{/if}

				<button
					type="submit"
					class="editor-login__submit"
					disabled={checking || token.trim() === ""}
				>
					{checking ? "正在验证…" : "进入编辑模式"}
				</button>
			</form>

			<button
				type="button"
				class="editor-login__help-toggle"
				aria-expanded={showHelp}
				onclick={() => (showHelp = !showHelp)}
			>
				令牌从哪里来？
			</button>

			{#if showHelp}
				<ol class="editor-login__help">
					<li>
						打开 GitHub 的
						<a
							href="https://github.com/settings/personal-access-tokens/new"
							target="_blank"
							rel="noopener noreferrer"
						>
							新建细粒度令牌 <ExternalLink size={11} aria-hidden="true" />
						</a>
					</li>
					<li>只授权 <code>{REPO_OWNER}/{REPO_NAME}</code> 这一个仓库</li>
					<li>权限里把 <code>Contents</code> 设成 <strong>Read and write</strong></li>
					<li>有效期给短一点，过期了重新生成即可</li>
				</ol>
			{/if}

			<p class="editor-login__fineprint">
				令牌只存在本次会话（关掉标签页就失效），不会写进代码仓库。<br />
				拿到令牌的人能改这个仓库，别贴到聊天窗口里。
			</p>
		</div>
	</div>
</dialog>
