<script lang="ts">
import { Edit3, Files, Loader2, Send, Trash2, X } from "lucide-svelte";
import type { QueuedDraft } from "@/utils/editor/batch-queue";

interface Props {
	open: boolean;
	items: QueuedDraft[];
	submitting: boolean;
	error: string;
	onClose: () => void;
	onEdit: (item: QueuedDraft) => void;
	onRemove: (id: string) => void;
	onClear: () => void;
	onSubmit: () => void;
}

let {
	open,
	items,
	submitting,
	error,
	onClose,
	onEdit,
	onRemove,
	onClear,
	onSubmit,
}: Props = $props();

let closeButton = $state<HTMLButtonElement | null>(null);
let previousFocus: HTMLElement | null = null;

$effect(() => {
	if (open) {
		previousFocus =
			document.activeElement instanceof HTMLElement
				? document.activeElement
				: null;
		queueMicrotask(() => closeButton?.focus());
		return;
	}
	if (previousFocus) {
		const target = previousFocus;
		previousFocus = null;
		queueMicrotask(() => target.focus());
	}
});
</script>

<svelte:window
	onkeydown={(event) => open && event.key === "Escape" && onClose()}
/>

{#if open}
	<div class="admin-batch">
		<button
			type="button"
			class="admin-batch__backdrop"
			aria-label="关闭待提交队列"
			onclick={onClose}
		></button>
		<div
			class="admin-batch__panel"
			role="dialog"
			aria-modal="true"
			aria-labelledby="admin-batch-title"
			tabindex="-1"
		>
			<header class="admin-batch__head">
				<div>
					<p class="admin-batch__eyebrow">批量发布</p>
					<h2 id="admin-batch-title">待提交队列</h2>
				</div>
				<button
					bind:this={closeButton}
					type="button"
					class="admin-icon-btn"
					aria-label="关闭待提交队列"
					onclick={onClose}
				>
					<X size={15} aria-hidden="true" />
				</button>
			</header>

			<div class="admin-batch__summary" aria-live="polite">
				<Files size={15} aria-hidden="true" />
				<span>{items.length} 条内容将合并为一个 Git 提交</span>
			</div>

			<div class="admin-batch__list">
				{#if items.length === 0}
					<div class="admin-batch__empty">
						<Files size={22} aria-hidden="true" />
						<p>队列还是空的</p>
						<span>新建内容时点击“加入待提交”</span>
					</div>
				{:else}
					{#each items as item, index (item.id)}
						<article class="admin-batch__item">
							<div class="admin-batch__index">{index + 1}</div>
							<div class="admin-batch__content">
								<div class="admin-batch__item-head">
									<span class="admin-batch__type">{item.collectionLabel}</span>
									<strong>{item.title || "未命名"}</strong>
								</div>
								<code>{item.path}</code>
							</div>
							<div class="admin-batch__item-actions">
								<button
									type="button"
									class="admin-icon-btn"
									aria-label={`编辑 ${item.title || "未命名"}`}
									title="重新编辑"
									disabled={submitting}
									onclick={() => onEdit(item)}
								>
									<Edit3 size={14} aria-hidden="true" />
								</button>
								<button
									type="button"
									class="admin-icon-btn admin-batch__remove"
									aria-label={`移除 ${item.title || "未命名"}`}
									title="从队列移除"
									disabled={submitting}
									onclick={() => onRemove(item.id)}
								>
									<Trash2 size={14} aria-hidden="true" />
								</button>
							</div>
						</article>
					{/each}
				{/if}
			</div>

			{#if error}
				<p class="admin-batch__error" role="alert">{error}</p>
			{/if}

			<footer class="admin-batch__foot">
				<button
					type="button"
					class="admin-btn"
					disabled={items.length === 0 || submitting}
					onclick={onClear}
				>
					清空
				</button>
				<button
					type="button"
					class="admin-btn admin-btn--primary admin-batch__submit"
					disabled={items.length === 0 || submitting}
					onclick={onSubmit}
				>
					{#if submitting}
						<Loader2 size={14} class="spin" aria-hidden="true" />
						正在提交…
					{:else}
						<Send size={14} aria-hidden="true" />
						提交全部
					{/if}
				</button>
			</footer>
		</div>
	</div>
{/if}
