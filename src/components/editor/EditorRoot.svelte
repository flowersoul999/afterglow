<script lang="ts">
/**
 * 编辑器常驻外壳
 *
 * 挂在 Navbar.astro 里（Swup 容器之外），所以换页不会重建，登录态和
 * 抽屉都跟着页面走。这里还负责一件容易被忽略的事：说说卡片上的编辑
 * 按钮是构建期渲染的静态 DOM，换页会被 Swup 换掉，所以监听必须挂在
 * document 上做事件委托，而不是给每个按钮 addEventListener。
 */
import { Check, TriangleAlert } from "lucide-svelte";
import { onMount } from "svelte";
import { editor } from "@/utils/editor/editor-store";
import { editorUi } from "@/utils/editor/editor-ui";
import EditorLoginModal from "./EditorLoginModal.svelte";
import MomentDrawer from "./MomentDrawer.svelte";
import "@/styles/components/editor.css";

onMount(() => {
	void editor.bootstrap();

	const onClick = (event: MouseEvent): void => {
		const target = event.target;
		if (!(target instanceof Element)) return;

		const editBtn = target.closest<HTMLElement>("[data-edit-moment]");
		if (editBtn) {
			event.preventDefault();
			event.stopPropagation();
			editorUi.openMomentEdit(editBtn.dataset.editMoment ?? "");
			return;
		}

		const deleteBtn = target.closest<HTMLElement>("[data-delete-moment]");
		if (deleteBtn) {
			event.preventDefault();
			event.stopPropagation();
			editorUi.openMomentEdit(deleteBtn.dataset.deleteMoment ?? "", "delete");
		}
	};

	document.addEventListener("click", onClick);
	return () => document.removeEventListener("click", onClick);
});
</script>

<EditorLoginModal />
<MomentDrawer />

{#if $editor.toast}
	{#key $editor.toast.id}
		<div
			class="editor-toast"
			class:is-error={$editor.toast.kind === "err"}
			role="status"
			aria-live="polite"
		>
			{#if $editor.toast.kind === "err"}
				<TriangleAlert size={15} aria-hidden="true" />
			{:else}
				<Check size={15} aria-hidden="true" />
			{/if}
			<span>{$editor.toast.text}</span>
		</div>
	{/key}
{/if}
