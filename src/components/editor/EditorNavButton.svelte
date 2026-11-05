<script lang="ts">
/**
 * 站长入口（嵌在「JOJOSTAR」悬停弹出的资料卡里）
 *
 * 为什么放在资料卡而不是导航栏上：导航栏右段在滚动时会收缩成球，塞进去
 * 一个常驻按钮要么被裁掉、要么破坏收缩动效；资料卡本来就有空位，也不占
 * 导航栏的视觉重量 —— 站长之外的访客基本不会注意到它。
 *
 * 未登录时是一枚「登录」小胶囊；登录后换成「+ 说说 / 退出」两个小按钮。
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
	editorUi.openLogin("登录之后，页面里会出现编辑按钮");
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
	{:else}
		<button
			type="button"
			class="editor-nav__chip"
			title="站长登录"
			aria-label="站长登录"
			disabled={$editor.status === "checking"}
			onclick={handleLogin}
		>
			<LogIn size={12} aria-hidden="true" />
			<span>登录</span>
		</button>
	{/if}
</div>
