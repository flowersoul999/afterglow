<script lang="ts">
/**
 * 后台中栏：某个集合下的条目列表
 *
 * 只显示文件名推出来的信息（文件名、所在分类、文件名里的日期），
 * 不预读每个文件的 frontmatter —— 面经 108 篇逐篇读就是 108 次请求。
 * 真实标题等打开编辑器后再显示。
 */
import { Loader2, Search } from "lucide-svelte";
import type { AdminCollection } from "@/config/admin-collections";
import type { AdminEntry } from "@/utils/editor/content-repo";

interface Props {
	collection: AdminCollection;
	entries: AdminEntry[];
	loading: boolean;
	error: string;
	selectedPath: string;
	query: string;
	onSelect: (path: string) => void;
	onCreate: () => void;
}

let {
	collection,
	entries,
	loading,
	error,
	selectedPath,
	query = $bindable(""),
	onSelect,
	onCreate,
}: Props = $props();

/** 文件名里带日期就提出来单独显示 —— 说说和更新日志都是这种命名 */
function dateFromName(name: string): string {
	const matched = name.match(/(\d{4}-\d{2}-\d{2})/);
	return matched ? matched[1] : "";
}

/** 标题本身就是日期时不重复显示日期（说说列表整列都是日期） */
function showDate(entry: AdminEntry): string {
	const date = dateFromName(entry.name);
	if (!date) return "";
	return date === entry.display ? "" : date;
}
</script>

<section class="admin-list">
	<div class="admin-list__head">
		<div class="admin-list__title-row">
			<h2 class="admin-list__title">{collection.label}</h2>
			<span class="admin-list__count">{entries.length}</span>
			<button type="button" class="admin-btn admin-btn--primary admin-btn--sm" onclick={onCreate}>
				新建
			</button>
		</div>

		<label class="admin-search">
			<Search size={13} aria-hidden="true" />
			<input
				type="search"
				placeholder="搜索文件名或分类…"
				bind:value={query}
			/>
		</label>
	</div>

	<div class="admin-list__scroll">
		{#if loading}
			<p class="admin-list__state">
				<Loader2 size={14} class="spin" aria-hidden="true" /> 正在列目录…
			</p>
		{:else if error}
			<p class="admin-list__state is-error">{error}</p>
		{:else if entries.length === 0}
			<p class="admin-list__state">
				{query ? "没有匹配的条目" : "这个集合还是空的"}
			</p>
		{:else}
			{#each entries as entry (entry.path)}
				{@render item(entry)}
			{/each}
		{/if}
	</div>
</section>

{#snippet item(entry: AdminEntry)}
	<button
		type="button"
		class="admin-item"
		class:is-active={entry.path === selectedPath}
		onclick={() => onSelect(entry.path)}
	>
		<span class="admin-item__title">{entry.display}</span>
		<span class="admin-item__meta">
			{#if showDate(entry)}
				<span class="admin-item__date">{showDate(entry)}</span>
			{/if}
			<span class="admin-item__category">{entry.category || "根目录"}</span>
		</span>
	</button>
{/snippet}
