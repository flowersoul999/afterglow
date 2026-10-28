<script lang="ts">
import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import { navigateToPage } from "@utils/navigation-utils";
import { onMount, tick } from "svelte";
import Icon from "@/components/common/Icon.svelte";
import type { SearchResult } from "@/global";
import { url as formatUrl, getSearchUrl } from "@/utils/url-utils";

// --- State ---
let keyword = $state("");
let result: SearchResult[] = $state([]);
let isSearching = $state(false);
let initialized = $state(false);
let debounceTimer: NodeJS.Timeout;

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

// --- UI Logic ---
const setPanelVisibility = async (show: boolean): Promise<void> => {
	const panel = document.getElementById("search-panel");
	if (!panel || !keyword) return;
	if (show) {
		await tick();
		panel.classList.remove("float-panel-closed");
	} else {
		panel.classList.add("float-panel-closed");
	}
};

const closeSearchPanel = (): void => {
	document.getElementById("search-panel")?.classList.add("float-panel-closed");
	keyword = "";
	result = [];
};

const handleResultClick = (event: Event, url: string): void => {
	event.preventDefault();
	closeSearchPanel();
	navigateToPage(url);
};

// --- Core Search Logic ---
const search = async (keyword: string): Promise<void> => {
	if (!keyword) {
		setPanelVisibility(false);
		result = [];
		return;
	}
	if (!initialized) return;

	isSearching = true;

	clearTimeout(debounceTimer);
	debounceTimer = setTimeout(async () => {
		try {
			let searchResults: SearchResult[] = [];

			if (import.meta.env.PROD && window.pagefind) {
				const response = await window.pagefind.search(keyword);
				searchResults = await Promise.all(
					response.results.map((item) => item.data()),
				);
			} else if (import.meta.env.DEV) {
				searchResults = fakeResult;
			}

			result = searchResults;
			setPanelVisibility(true);
		} catch (error) {
			console.error("Search error:", error);
			result = [];
			setPanelVisibility(false);
		} finally {
			isSearching = false;
		}
	}, 300);
};

// --- Initialization onMount ---
onMount(() => {
	const initializePagefind = () => {
		initialized = true;
		if (keyword) search(keyword);
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
});

// --- Reactive Statements ---
$effect(() => {
	// 只在客户端且初始化完成后执行搜索
	if (initialized) {
		search(keyword);
	}
});
</script>

<!-- 搜索面板 - 浮动坞触发 -->
<div id="search-panel" class="float-panel float-panel-closed search-panel">
  <div class="flex relative transition-all items-center h-11 rounded-xl
    bg-black/4 hover:bg-black/6 focus-within:bg-black/6
    dark:bg-white/5 dark:hover:bg-white/10 dark:focus-within:bg-white/10
  ">
    <Icon icon="material-symbols:search"
          class="absolute text-[1.25rem] pointer-events-none ml-3 transition my-auto text-black/30 dark:text-white/30"></Icon>
    <input placeholder={i18n(I18nKey.search)} bind:value={keyword}
           class="pl-10 absolute inset-0 text-sm bg-transparent outline-0
           text-black/50 dark:text-white/50"
    >
  </div>

  <!-- search results -->
  {#if isSearching}
    <div class="transition first-of-type:mt-2 block rounded-xl text-lg px-3 py-2 text-50">
      {i18n(I18nKey.searchLoading)}
    </div>
  {:else if result.length > 0}
    {#each result.slice(0, 5) as item}
      <a href={item.url}
         onclick={(e) => handleResultClick(e, item.url)}
         class="transition first-of-type:mt-2 group block
           rounded-xl text-lg px-3 py-2 hover:bg-(--btn-plain-bg-hover) active:bg-(--btn-plain-bg-active)">
        <div class="transition text-90 inline-flex font-bold group-hover:text-(--primary)">
          {@html item.meta.title}
          <Icon icon="fa7-solid:chevron-right"
                class="transition text-[0.75rem] translate-x-1 my-auto text-(--primary)"></Icon>
        </div>
        {#if item.excerpt.includes('<mark>')}
          <div class="transition text-sm text-50" style="display: flex; align-items: flex-start; margin-top: 0.1rem">
            <div>
              {@html item.excerpt}
            </div>
          </div>
        {/if}
      </a>
    {/each}
    {#if result.length > 5}
      <a href={getSearchUrl(keyword)}
         onclick={(e) => handleResultClick(e, getSearchUrl(keyword))}
         class="transition first-of-type:mt-2 group block rounded-xl text-lg px-3 py-2 hover:bg-(--btn-plain-bg-hover) active:bg-(--btn-plain-bg-active) text-(--primary) font-bold text-center">
        <span class="inline-flex items-center">
          {i18n(I18nKey.searchViewMore).replace('{count}', (result.length - 5).toString())}
          <Icon icon="fa7-solid:arrow-right" class="transition text-[0.75rem] ml-1"></Icon>
        </span>
      </a>
    {/if}
  {:else if result.length === 0}
    <div class="transition first-of-type:mt-2 block rounded-xl text-lg px-3 py-2 text-50">
      {i18n(I18nKey.searchNoResults)}
    </div>
  {:else if keyword}
    <div class="transition first-of-type:mt-2 block rounded-xl text-lg px-3 py-2 text-50">
      {i18n(I18nKey.searchTypeSomething)}
    </div>
  {/if}
</div>

<style>
  input:focus {
    outline: 0;
  }

  .search-panel {
    position: fixed;
    width: 22rem;
    max-height: 50vh;
    overflow-y: auto;
    right: 5rem;
    bottom: 1.25rem;
    z-index: 61;
    background: color-mix(in oklch, var(--float-panel-bg) 85%, transparent);
    backdrop-filter: blur(16px) saturate(180%);
    -webkit-backdrop-filter: blur(16px) saturate(180%);
    box-shadow: 0 8px 32px -4px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.06);
    border-radius: 1rem;
    padding: 0.5rem;
  }
  :root.dark .search-panel {
    box-shadow: 0 8px 32px -4px rgba(0, 0, 0, 0.5), 0 2px 8px rgba(0, 0, 0, 0.3);
  }
  @media (max-width: 768px) {
    .search-panel {
      right: 0.5rem;
      left: 0.5rem;
      width: auto;
      bottom: calc(0.75rem + 4.25rem + 0.5rem);
    }
  }
</style>
