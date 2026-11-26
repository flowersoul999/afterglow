<script lang="ts">
/**
 * 灵动岛个人面板里的 GitHub 登录入口
 *
 * 2026-11-26 起登录对所有人开放（原先只有站长能登，非站长会被 Worker 直接
 * 拒掉）。三种形态：
 *   未登录          → 蓝色 LogIn 图标，点开走 GitHub 授权（所有人可用）
 *   已登录 · 普通访客 → 显示 GitHub 头像，点一下退出登录，**没有**任何编辑入口
 *   已登录 · 站长     → 后台 / 新建说说 / 退出，和以前一样
 *
 * 「是不是站长」由 Worker 判定（GitHub 返回的 login 与 OWNER_LOGIN 比对），
 * 前端只读 `$editor.isEditor`，不自己猜。
 *
 * 样式走 `.di-profile__admin`（见 dynamic-island.css），和旁边的 GitHub / B 站 /
 * 邮箱图标排成一行。手机端由 EditorMobileMenuEntry 接管，不走这里。
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

{#if $editor.isEditor}
	<!-- 站长：后台 / 新建说说 / 退出 -->
	<a
		class="di-profile__admin is-on"
		href="/admin"
		data-no-swup
		title={`打开后台（已登录：${label}）`}
		aria-label="打开后台"
		data-di-tooltip-label="打开后台"
	>
		<LayoutGrid size={17} aria-hidden="true" />
		<i class="di-profile__admin-dot" aria-hidden="true"></i>
	</a>
	<button
		type="button"
		class="di-profile__admin"
		title="新建说说"
		aria-label="新建说说"
		data-di-tooltip-label="新建说说"
		onclick={handleCreate}
	>
		<Plus size={17} aria-hidden="true" />
	</button>
	<button
		type="button"
		class="di-profile__admin"
		title="退出登录"
		aria-label="退出登录"
		data-di-tooltip-label="退出登录"
		onclick={handleLogout}
	>
		<LogOut size={17} aria-hidden="true" />
	</button>
{:else if $editor.loggedIn}
	<!-- 普通访客：只显示身份，点一下退出；没有任何编辑入口 -->
	<button
		type="button"
		class="di-profile__admin is-me"
		title={`已登录：${label}（点击退出）`}
		aria-label="退出登录"
		data-di-tooltip-label={`已登录：${label}`}
		onclick={handleLogout}
	>
		{#if $editor.identity?.avatar}
			<img
				class="di-profile__admin-avatar"
				src={$editor.identity.avatar}
				alt=""
				loading="lazy"
				decoding="async"
			/>
		{:else}
			<span class="di-profile__admin-initial">{label.slice(0, 1)}</span>
		{/if}
	</button>
{:else}
	<button
		type="button"
		class="di-profile__admin is-login"
		title="用 GitHub 登录"
		aria-label="用 GitHub 登录"
		data-di-tooltip-label="用 GitHub 登录"
		disabled={$editor.status === "checking"}
		onclick={handleLogin}
	>
		<LogIn size={17} aria-hidden="true" />
	</button>
{/if}
