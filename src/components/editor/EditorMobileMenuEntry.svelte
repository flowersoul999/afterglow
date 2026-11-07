<script lang="ts">
/**
 * 手机导航菜单底部的站长入口
 *
 * 未登录时只显示一行低对比度入口；登录后才展开内容管理、新建说说和退出。
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
	editorUi.openLogin("登录之后才能在手机上管理和修改内容");
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
	{:else}
		<button
			type="button"
			class="editor-mobile-menu__login"
			disabled={$editor.status === "checking"}
			onclick={handleLogin}
		>
			<LogIn size={15} aria-hidden="true" />
			<span class="editor-mobile-menu__copy">
				<strong>站长登录</strong>
				<small>{$editor.status === "checking" ? "检查中…" : "GitHub"}</small>
			</span>
		</button>
	{/if}
</div>
