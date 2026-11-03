<script lang="ts">
/**
 * 导航栏右侧的站长入口
 *
 * 未登录时是一枚低调的「登录」按钮，登录后换成头像 + 在线绿点。
 * 挂载点在 Navbar.astro 的 `navbar-seg--right` 里 —— 那里在 Swup 容器之外，
 * 换页不会重建，所以 bootstrap 只跑一次。
 */
import { LogIn, LogOut, Plus } from "lucide-svelte";
import { onMount } from "svelte";
import { editor } from "@/utils/editor/editor-store";
import { editorUi } from "@/utils/editor/editor-ui";

let menuOpen = $state(false);
let root: HTMLDivElement | null = $state(null);

onMount(() => {
	void editor.bootstrap();
});

// 点外面收起菜单（navbar 常驻，这个监听的生命周期跟页面一样长）
$effect(() => {
	if (!menuOpen) return;
	const onPointerDown = (event: MouseEvent): void => {
		if (root && !root.contains(event.target as Node)) menuOpen = false;
	};
	document.addEventListener("mousedown", onPointerDown);
	return () => document.removeEventListener("mousedown", onPointerDown);
});

const initial = $derived(
	($editor.identity?.name || $editor.identity?.login || "J")
		.slice(0, 1)
		.toUpperCase(),
);

function handleLogin(): void {
	editorUi.openLogin("登录之后，页面里会出现编辑按钮");
}

function handleLogout(): void {
	menuOpen = false;
	editor.logout();
}

function handleCreate(): void {
	menuOpen = false;
	editorUi.openMomentCreate();
}
</script>

<div class="editor-nav" bind:this={root}>
	{#if $editor.isEditor}
		<button
			type="button"
			class="editor-nav__avatar"
			aria-label="站长菜单"
			aria-haspopup="menu"
			aria-expanded={menuOpen}
			onclick={() => (menuOpen = !menuOpen)}
		>
			{#if $editor.identity?.avatar}
				<img src={$editor.identity.avatar} alt="" loading="lazy" decoding="async" />
			{:else}
				<span>{initial}</span>
			{/if}
			<i class="editor-nav__dot" aria-hidden="true"></i>
		</button>

		{#if menuOpen}
			<div class="editor-nav__menu" role="menu">
				<div class="editor-nav__menu-head">
					{#if $editor.identity?.avatar}
						<img
							class="editor-nav__menu-avatar"
							src={$editor.identity.avatar}
							alt=""
							loading="lazy"
							decoding="async"
						/>
					{:else}
						<span class="editor-nav__menu-avatar is-text">{initial}</span>
					{/if}
					<div class="editor-nav__menu-meta">
						<strong>{$editor.identity?.name || $editor.identity?.login}</strong>
						<span><i aria-hidden="true"></i>站长 · 已登录</span>
					</div>
				</div>

				<button
					type="button"
					class="editor-nav__item"
					role="menuitem"
					onclick={handleCreate}
				>
					<Plus size={15} aria-hidden="true" />
					<span>新建说说</span>
				</button>
				<button
					type="button"
					class="editor-nav__item editor-nav__item--danger"
					role="menuitem"
					onclick={handleLogout}
				>
					<LogOut size={15} aria-hidden="true" />
					<span>退出登录</span>
				</button>
			</div>
		{/if}
	{:else}
		<button
			type="button"
			class="editor-nav__login"
			aria-label="站长登录"
			onclick={handleLogin}
		>
			<LogIn size={16} aria-hidden="true" />
			<span class="editor-nav__login-text">登录</span>
		</button>
	{/if}
</div>
