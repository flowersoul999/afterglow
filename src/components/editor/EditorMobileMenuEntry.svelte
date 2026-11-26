<script lang="ts">
/**
 * 手机导航菜单底部的账号入口
 *
 * 2026-11-26 起登录对所有人开放，所以有三种形态：
 *   未登录          → 一行「登录」入口，走 GitHub 授权
 *   已登录 · 普通访客 → 一行只读身份（头像 + 昵称）+ 一个「退出登录」，无编辑入口
 *   已登录 · 站长     → 内容管理 / 新建说说 / 退出
 * 「是不是站长」由 Worker 判定，前端只读 `$editor.isEditor`。
 *
 * 组件只负责入口状态，登录弹窗和说说抽屉仍由 MainGridLayout 外层的
 * EditorRoot 统一渲染，避免把 fixed 弹层放进带 transform 的导航抽屉。
 */
import { LayoutGrid, LogIn, LogOut, Plus } from "lucide-svelte";
import { onMount } from "svelte";
import { editor } from "@/utils/editor/editor-store";
import { editorUi } from "@/utils/editor/editor-ui";

onMount(() => {
	void editor.bootstrap();
});

function closeMenu(): void {
	document.dispatchEvent(new CustomEvent("mobile-menu-sheet:close"));
}

function handleLogin(): void {
	closeMenu();
	editorUi.openLogin("用 GitHub 登录后，留言会自动带上你的头像和昵称");
}

function handleCreate(): void {
	closeMenu();
	editorUi.openMomentCreate();
}

function handleLogout(): void {
	closeMenu();
	void editor.logout();
}

const label = $derived(
	$editor.identity?.name || $editor.identity?.login || "站长",
);
</script>

<div class="editor-mobile-menu">
	{#if $editor.isEditor}
		<a
			href="/admin"
			data-no-swup
			class="editor-mobile-menu__manage"
			onclick={closeMenu}
		>
			<LayoutGrid size={16} aria-hidden="true" />
			<span class="editor-mobile-menu__copy">
				<strong>内容管理</strong>
				<small>已登录：{label}</small>
			</span>
		</a>

		<div class="editor-mobile-menu__actions">
			<button type="button" onclick={handleCreate}>
				<Plus size={15} aria-hidden="true" />
				<span>新建说说</span>
			</button>
			<button type="button" onclick={handleLogout}>
				<LogOut size={15} aria-hidden="true" />
				<span>退出登录</span>
			</button>
		</div>
	{:else if $editor.loggedIn}
		<!-- 普通访客：只表明身份 + 退出，这里不出现任何编辑入口 -->
		<div class="editor-mobile-menu__me">
			{#if $editor.identity?.avatar}
				<img
					class="editor-mobile-menu__avatar"
					src={$editor.identity.avatar}
					alt=""
					loading="lazy"
					decoding="async"
				/>
			{:else}
				<span class="editor-mobile-menu__initial" aria-hidden="true"
					>{label.slice(0, 1)}</span
				>
			{/if}
			<span class="editor-mobile-menu__copy">
				<strong>已登录</strong>
				<small>{label}</small>
			</span>
		</div>

		<div class="editor-mobile-menu__actions editor-mobile-menu__actions--single">
			<button type="button" onclick={handleLogout}>
				<LogOut size={15} aria-hidden="true" />
				<span>退出登录</span>
			</button>
		</div>
	{:else}
		<button
			type="button"
			class="editor-mobile-menu__login"
			disabled={$editor.status === "checking"}
			onclick={handleLogin}
		>
			<LogIn size={15} aria-hidden="true" />
			<span class="editor-mobile-menu__copy">
				<strong>GitHub 登录</strong>
				<small>{$editor.status === "checking" ? "检查中…" : "留言带上头像"}</small>
			</span>
		</button>
	{/if}
</div>
