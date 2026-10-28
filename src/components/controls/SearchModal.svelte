<script lang="ts">
import { navigateToPage } from "@utils/navigation-utils";
import { onMount, tick } from "svelte";
import type { SearchResult } from "@/global";
import { bindSearchModalController } from "@/utils/search-modal-controller";
import { url as formatUrl, getSearchUrl } from "@/utils/url-utils";

// --- State ---
let keyword = $state("");
let result = $state<SearchResult[]>([]);
let isSearching = $state(false);
let initialized = $state(false);
let visible = $state(false);
let debounceTimer: NodeJS.Timeout;

// --- Refs（Svelte 5 runes：DOM ref 用 $state 声明）---
let inputEl = $state<HTMLInputElement>();
let modalEl = $state<HTMLDivElement>();

// --- Mocks for Dev Mode ---
const fakeResult: SearchResult[] = [
	{
		url: formatUrl("/"),
		meta: { title: "This Is a Fake Search Result" },
		excerpt:
			"Because Pagefind cannot work in the <mark>dev</mark> environment.",
	},
	{
		url: formatUrl("/"),
		meta: { title: "If You Want to Test the Search" },
		excerpt: "Try running <mark>npm build && npm preview</mark> instead.",
	},
];

// --- Core Search Logic ---
async function doSearch(kw: string) {
	if (!kw) {
		result = [];
		return;
	}
	if (!initialized) return;

	isSearching = true;

	try {
		let searchResults: SearchResult[] = [];
		if (import.meta.env.PROD && window.pagefind) {
			const response = await window.pagefind.search(kw);
			searchResults = await Promise.all(
				response.results.map((item) => item.data()),
			);
		} else if (import.meta.env.DEV) {
			searchResults = fakeResult;
		}
		result = searchResults;
	} catch (error) {
		console.error("Search error:", error);
		result = [];
	} finally {
		isSearching = false;
	}
}

function handleKeyDown(e: KeyboardEvent) {
	if (e.key === "Escape") {
		close();
	}
}

// --- Modal open/close ---
export function open() {
	visible = true;
	result = [];
	keyword = "";
	tick().then(() => {
		inputEl?.focus();
	});
}

function close() {
	visible = false;
	result = [];
	keyword = "";
}

function handleBackdropClick(e: MouseEvent) {
	if (e.target === modalEl) {
		close();
	}
}

function handleResultClick(e: MouseEvent, url: string) {
	e.preventDefault();
	close();
	navigateToPage(url);
}

// --- Global keyboard shortcut (Ctrl+K / Cmd+K) ---
function handleGlobalKeyDown(e: KeyboardEvent) {
	if ((e.ctrlKey || e.metaKey) && e.code === "KeyK") {
		e.preventDefault();
		if (visible) {
			close();
		} else {
			open();
		}
	}
}

// --- Initialization ---
onMount(() => {
	const initializePagefind = () => {
		initialized = true;
	};

	if (import.meta.env.DEV) {
		initializePagefind();
	} else {
		if (window.pagefind) {
			initializePagefind();
		} else {
			document.addEventListener("pagefindready", initializePagefind, {
				once: true,
			});
			document.addEventListener("pagefindloaderror", initializePagefind, {
				once: true,
			});
		}
	}

	document.addEventListener("keydown", handleGlobalKeyDown);

	const handleToggle = () => {
		if (visible) close();
		else open();
	};
	const unbindSearchModalController = bindSearchModalController(window, {
		toggle: handleToggle,
	});

	return () => {
		document.removeEventListener("keydown", handleGlobalKeyDown);
		unbindSearchModalController();
	};
});

// --- Reactive search on input (with debounce) ---
let lastSearched = "";
$effect(() => {
	if (initialized && keyword !== lastSearched) {
		lastSearched = keyword;
		if (keyword) {
			clearTimeout(debounceTimer);
			debounceTimer = setTimeout(() => doSearch(keyword), 300);
		} else {
			result = [];
		}
	}
});
</script>

{#if visible}
<!-- backdrop 点击外部关闭；role/tabindex/keydown 满足 a11y（键盘关闭另有关闭按钮） -->
<div
	class="search-modal-backdrop"
	bind:this={modalEl}
	role="button"
	tabindex="-1"
	onclick={handleBackdropClick}
	onkeydown={(e) => {
		if (e.key === "Enter" || e.key === " ") handleBackdropClick();
	}}
>
	<div class="search-modal-content">
		<!-- Title -->
		<h2 class="search-modal-title">搜索文章</h2>

		<!-- Search Input -->
		<form
			class="search-input-wrapper"
			onsubmit={(e) => { e.preventDefault(); doSearch(keyword); }}
		>
			<input
				type="text"
				bind:this={inputEl}
				bind:value={keyword}
				onkeydown={handleKeyDown}
				class="search-input"
				placeholder="输入关键词搜索..."
			/>

			<button
				type="submit"
				disabled={!keyword}
				class="search-submit-btn"
				aria-label="搜索"
			>
				<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<circle cx="11" cy="11" r="8"/>
					<path d="m21 21-4.3-4.3"/>
				</svg>
			</button>
		</form>

		<!-- Search Results -->
		{#if isSearching}
			<div class="search-results">
				<div class="search-result-empty">搜索中...</div>
			</div>
		{:else if result.length > 0}
			<div class="search-results">
				{#each result.slice(0, 8) as item}
					<a
						href={item.url}
						onclick={(e) => handleResultClick(e, item.url)}
						class="search-result-item"
					>
						<div class="search-result-title">
							{@html item.meta.title}
							<svg class="search-result-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
								<path d="M9 18l6-6-6-6"/>
							</svg>
						</div>
						{#if item.excerpt.includes('<mark>')}
							<div class="search-result-excerpt">
								{@html item.excerpt}
							</div>
						{/if}
					</a>
				{/each}
				{#if result.length > 8}
					<a
						href={getSearchUrl(keyword)}
						onclick={(e) => handleResultClick(e, getSearchUrl(keyword))}
						class="search-result-more"
					>
						查看全部 {result.length} 条结果 →
					</a>
				{/if}
			</div>
		{:else if keyword && !isSearching}
			<div class="search-results">
				<div class="search-result-empty">未找到相关文章</div>
			</div>
		{/if}

		<!-- Footer hint -->
		<div class="search-modal-footer">
			<span class="search-hint-key">ESC</span> 关闭
			<span class="search-hint-key ml-3">ENTER</span> 搜索
			<span class="search-hint-key ml-3">Ctrl+K</span> 切换
		</div>
	</div>
</div>
{/if}

<style>
	.search-modal-backdrop {
		position: fixed;
		inset: 0;
		z-index: 100;
		display: flex;
		align-items: flex-start;
		justify-content: center;
		padding-top: 12vh;
		background: rgba(0, 0, 0, 0.5);
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
		animation: fadeIn 0.2s ease;
	}

	:root.dark .search-modal-backdrop {
		background: rgba(0, 0, 0, 0.7);
	}

	@keyframes fadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	@keyframes slideUp {
		from { opacity: 0; transform: translateY(1rem) scale(0.98); }
		to { opacity: 1; transform: translateY(0) scale(1); }
	}

	.search-modal-content {
		width: 100%;
		max-width: 36rem;
		margin: 0 1rem;
		animation: slideUp 0.25s ease;
	}

	.search-modal-title {
		font-family: ui-monospace, SFMono-Regular, monospace;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.2em;
		color: rgba(255, 255, 255, 0.5);
		margin-bottom: 0.75rem;
		text-align: center;
	}

	/* ── Search Input ── */
	.search-input-wrapper {
		position: relative;
		width: 100%;
		height: 3.5rem;
		border-radius: 9999px;
		overflow: hidden;
		background: #fff;
		box-shadow:
			0px 2px 3px -1px rgba(0, 0, 0, 0.1),
			0px 1px 0px 0px rgba(25, 28, 33, 0.02),
			0px 0px 0px 1px rgba(25, 28, 33, 0.08);
		transition: background-color 0.2s;
	}

	:root.dark .search-input-wrapper {
		background: #27272a;
	}

	.search-input {
		position: relative;
		width: 100%;
		height: 100%;
		z-index: 10;
		border: none;
		background: transparent;
		font-size: 1rem;
		color: #000;
		padding: 0 3rem 0 1.5rem;
		outline: none;
	}

	:root.dark .search-input {
		color: #fff;
	}

	.search-input::placeholder {
		color: #a3a3a3;
	}

	.search-submit-btn {
		position: absolute;
		right: 0.5rem;
		top: 50%;
		z-index: 10;
		transform: translateY(-50%);
		width: 2rem;
		height: 2rem;
		border-radius: 9999px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #000;
		color: #fff;
		border: none;
		cursor: pointer;
		transition: background-color 0.2s, opacity 0.2s;
	}

	.search-submit-btn:disabled {
		background: #e5e5e5;
		color: #a3a3a3;
		cursor: default;
	}

	:root.dark .search-submit-btn {
		background: #171717;
		color: #a3a3a3;
	}

	:root.dark .search-submit-btn:disabled {
		background: #27272a;
		color: #525252;
	}

	/* ── Search Results ── */
	.search-results {
		margin-top: 0.75rem;
		background: #fff;
		border-radius: 1rem;
		padding: 0.5rem;
		max-height: 50vh;
		overflow-y: auto;
		box-shadow:
			0 8px 32px -4px rgba(0, 0, 0, 0.12),
			0 2px 8px rgba(0, 0, 0, 0.06);
		animation: slideUp 0.2s ease;
	}

	:root.dark .search-results {
		background: #171717;
		box-shadow:
			0 8px 32px -4px rgba(0, 0, 0, 0.5),
			0 2px 8px rgba(0, 0, 0, 0.3);
	}

	.search-result-item {
		display: block;
		padding: 0.625rem 0.875rem;
		border-radius: 0.75rem;
		text-decoration: none;
		color: inherit;
		transition: background-color 0.15s;
	}

	.search-result-item:hover {
		background: rgba(0, 0, 0, 0.04);
	}

	:root.dark .search-result-item:hover {
		background: rgba(255, 255, 255, 0.06);
	}

	.search-result-title {
		font-size: 1rem;
		font-weight: 700;
		color: #171717;
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
	}

	:root.dark .search-result-title {
		color: #e5e5e5;
	}

	.search-result-item:hover .search-result-title {
		color: var(--primary, #3b82f6);
	}

	.search-result-arrow {
		transition: transform 0.15s;
		opacity: 0;
	}

	.search-result-item:hover .search-result-arrow {
		opacity: 1;
		transform: translateX(2px);
	}

	.search-result-excerpt {
		font-size: 0.875rem;
		color: #737373;
		margin-top: 0.25rem;
		line-height: 1.5;
	}

	:root.dark .search-result-excerpt {
		color: #a3a3a3;
	}

	.search-result-excerpt :global(mark) {
		background: transparent;
		color: var(--primary, #3b82f6);
		font-weight: 600;
	}

	.search-result-more {
		display: block;
		text-align: center;
		padding: 0.625rem;
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--primary, #3b82f6);
		text-decoration: none;
		border-radius: 0.75rem;
		transition: background-color 0.15s;
	}

	.search-result-more:hover {
		background: rgba(0, 0, 0, 0.04);
	}

	:root.dark .search-result-more:hover {
		background: rgba(255, 255, 255, 0.06);
	}

	.search-result-empty {
		padding: 1rem;
		text-align: center;
		color: #a3a3a3;
		font-size: 0.875rem;
	}

	/* ── Footer ── */
	.search-modal-footer {
		margin-top: 0.75rem;
		text-align: center;
		font-size: 0.75rem;
		color: rgba(255, 255, 255, 0.35);
		font-family: ui-monospace, SFMono-Regular, monospace;
	}

	.search-hint-key {
		display: inline-block;
		padding: 0.125rem 0.375rem;
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 0.25rem;
		font-size: 0.6875rem;
		margin-right: 0.25rem;
	}

	/* ── Mobile ── */
	@media (max-width: 640px) {
		.search-modal-backdrop {
			padding-top: 8vh;
		}

		.search-modal-content {
			margin: 0 0.5rem;
		}

		.search-input-wrapper {
			height: 3rem;
		}

		.search-input {
			font-size: 0.875rem;
			padding: 0 2.5rem 0 1rem;
		}

		.search-results {
			max-height: 60vh;
		}
	}
</style>
