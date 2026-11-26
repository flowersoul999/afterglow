<script lang="ts">
/**
 * 灵动岛个人面板里的站长入口
 *
 * 背景：桌面端导航换成灵动岛后，个人面板（di-profile-card）是一套全新的
 * 名片布局（banner + 居中头像 + 名字职业 + 社交图标），旧的
 * NavbarProfileCard 那套「登录」胶囊没有跟着搬过来 —— 结果站长在页面上
 * 找不到进后台的地方（2026-11-26 报障）。
 *
 * 所以这里补一枚与社交图标同形制的入口：未登录是「登录」，已登录是
 * 「后台」。样式走 `.di-profile__admin`（见 dynamic-island.css），和旁边
 * 的 GitHub / B 站 / 邮箱图标排成一行。
 *
 * 挂在 DynamicIsland.astro 的 `.di-profile__socials` 行尾；手机端由
 * EditorMobileMenuEntry 接管，不走这里。
 */
import { LayoutGrid, LogIn } from "lucide-svelte";
import { onMount } from "svelte";
import { editor } from "@/utils/editor/editor-store";
import { editorUi } from "@/utils/editor/editor-ui";

onMount(() => {
	void editor.bootstrap();
});

function handleLogin(): void {
	editorUi.openLogin("登录之后，页面里会出现编辑按钮");
}

const label = $derived(
	$editor.identity?.name || $editor.identity?.login || "站长",
);
</script>

{#if $editor.isEditor}
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
{:else}
	<button
		type="button"
		class="di-profile__admin is-login"
		title="站长登录"
		aria-label="站长登录"
		data-di-tooltip-label="站长登录"
		disabled={$editor.status === "checking"}
		onclick={handleLogin}
	>
		<LogIn size={17} aria-hidden="true" />
	</button>
{/if}
