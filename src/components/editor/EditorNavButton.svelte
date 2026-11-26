<script lang="ts">
/**
 * 桌面端账号入口（嵌在「JOJOSTAR」悬停弹出的资料卡里）
 *
 * 为什么放在资料卡而不是导航栏上：导航栏右段在滚动时会收缩成球，塞进去
 * 一个常驻按钮要么被裁掉、要么破坏收缩动效；资料卡本来就有空位，也不占
 * 导航栏的视觉重量。
 *
 * 2026-11-26 起登录对所有人开放，所以这里有三种形态：
 *   未登录          → 「登录」胶囊，走 GitHub 授权
 *   已登录 · 普通访客 → 头像 + 昵称的胶囊，点一下退出，**没有**任何编辑入口
 *   已登录 · 站长     → 「后台 / + 说说 / 退出」三个图标钮
 * 「是不是站长」由 Worker 判定，前端只读 `$editor.isEditor`。
 *
 * 手机端由 EditorMobileMenuEntry 接管，CSS 会隐藏这个资料卡入口。
 * 挂载点在 NavbarProfileCard.astro 的 `.nav-profile__identity` 里，属于
 * Swup 容器之外，换页不会重建，所以 bootstrap 只跑一次。
 */
import { LayoutGrid, LogIn, LogOut, Plus } from "lucide-svelte";
import { onMount } from "svelte";
import { editor } from "@/utils/editor/editor-store";
import { editorUi } from "@/utils/editor/editor-ui";

onMount(() => {
	void editor.bootstrap();
});

function handleLogin(): void {
	editorUi.openLogin("用 GitHub 登录后，留言会自动带上你的头像和昵称");
}

function handleLogout(): void {
	void editor.logout();
}

function handleCreate(): void {
	editorUi.openMomentCreate();
}

const label = $derived(
	$editor.identity?.name || $editor.identity?.login || "站长",
);
</script>

<div class="editor-nav editor-nav--card">
	{#if $editor.isEditor}
		<!-- 已登录只用图标钮：资料卡左栏只有 18.5rem，带文字的胶囊会把
		     名字和简介挤成两行。含义交给 title 和 hover 提示。 -->
		<a
			href="/admin"
			data-no-swup
			class="editor-nav__icon"
			title={`打开后台（已登录：${label}）`}
			aria-label="打开后台"
		>
			<LayoutGrid size={13} aria-hidden="true" />
			<i class="editor-nav__dot" aria-hidden="true"></i>
		</a>
		<button
			type="button"
			class="editor-nav__icon editor-nav__icon--quiet"
			title="新建说说"
			aria-label="新建说说"
			onclick={handleCreate}
		>
			<Plus size={13} aria-hidden="true" />
		</button>
		<button
			type="button"
			class="editor-nav__icon editor-nav__icon--quiet"
			title="退出登录"
			aria-label="退出登录"
			onclick={handleLogout}
		>
			<LogOut size={13} aria-hidden="true" />
		</button>
	{:else if $editor.loggedIn}
		<!-- 普通访客：只表明身份，点一下退出。不放任何编辑类按钮。 -->
		<button
			type="button"
			class="editor-nav__chip editor-nav__chip--me"
			title={`已登录：${label}（点击退出）`}
			aria-label="退出登录"
			onclick={handleLogout}
		>
			{#if $editor.identity?.avatar}
				<img
					class="editor-nav__avatar"
					src={$editor.identity.avatar}
					alt=""
					loading="lazy"
					decoding="async"
				/>
			{:else}
				<span class="editor-nav__initial" aria-hidden="true"
					>{label.slice(0, 1)}</span
				>
			{/if}
			<span class="editor-nav__me-name">{label}</span>
		</button>
	{:else}
		<button
			type="button"
			class="editor-nav__chip"
			title="用 GitHub 登录"
			aria-label="用 GitHub 登录"
			disabled={$editor.status === "checking"}
			onclick={handleLogin}
		>
			<LogIn size={12} aria-hidden="true" />
			<span>登录</span>
		</button>
	{/if}
</div>
