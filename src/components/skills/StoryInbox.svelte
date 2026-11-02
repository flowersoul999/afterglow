<script lang="ts">
/**
 * 飞剑传书·收件箱：隐藏剧情到达的地方。
 *
 * 监听 aemeath-story-unlocked（cultivation.ts 在解锁新剧情时派发）：
 * 把新信收进信箱、红点亮起、自动拆开第一封；也可随时点信封回看全部信件。
 * 已读状态单独存 localStorage，不影响「已解锁」集合（解锁集合只增不减）。
 *
 * ⚠️ 这里只留信箱与阅读器本体。入口按钮在侧栏「修行」卡片
 * （src/components/skills/CultivationDock.svelte）里，靠 OPEN_INBOX_EVENT 开门 ——
 * 别再把入口塞回本页，之前 position:fixed 钉在视口左下角既压内容又永远不动。
 */
import { OPEN_INBOX_EVENT, STORY_EVENT } from "@/data/cultivation";
import { getStory, type Story } from "@/data/cultivationStories";
import { getSagaChapter, getSagaStory, isSagaId, pumpSaga } from "@/data/saga";
import { playStory } from "@/lib/sfx";

const UNLOCKED_KEY = "aemeath-stories-unlocked";
const READ_KEY = "aemeath-stories-read";

function readUnlocked(): string[] {
	try {
		const raw = localStorage.getItem(UNLOCKED_KEY);
		return raw ? (JSON.parse(raw) as string[]) : [];
	} catch {
		return [];
	}
}
function readReadSet(): Set<string> {
	try {
		const raw = localStorage.getItem(READ_KEY);
		return new Set(raw ? (JSON.parse(raw) as string[]) : []);
	} catch {
		return new Set();
	}
}
function persistRead(set: Set<string>) {
	try {
		localStorage.setItem(READ_KEY, JSON.stringify([...set]));
	} catch {
		/* 忽略 */
	}
}

let unlockedIds = $state<string[]>(readUnlocked());
let readIds = $state<Set<string>>(readReadSet());
let readerId = $state<string | null>(null);
let mailboxOpen = $state(false);

/** 收件箱里有两种信：既有的彩蛋小笺，和按卷连载的话本 */
function storyOf(id: string): Story | null {
	return getStory(id) ?? getSagaStory(id);
}

/** 话本按章序正序在前（方便顺着读），小笺按最新在前 */
const inboxList = $derived.by(() => {
	const chapters: { id: string; no: number }[] = [];
	const others: string[] = [];
	for (const id of unlockedIds) {
		const c = getSagaChapter(id);
		if (c) chapters.push({ id, no: c.no });
		else others.push(id);
	}
	chapters.sort((a, b) => a.no - b.no);
	return [...chapters.map((x) => x.id), ...others.reverse()];
});

const readerStory = $derived(readerId ? storyOf(readerId) : null);
/** 话本章节的卷信息（小笺为 null） */
const readerChapter = $derived(readerId ? getSagaChapter(readerId) : null);

function openReader(id: string) {
	readerId = id;
	mailboxOpen = false;
}

function markRead(id: string) {
	if (!readIds.has(id)) {
		const next = new Set(readIds);
		next.add(id);
		readIds = next;
		persistRead(next);
	}
}

function closeReader() {
	if (readerId) {
		const wasSaga = isSagaId(readerId);
		markRead(readerId);
		readerId = null;
		// 读完这一回，下一回（前提是已经挣得）自动到手——连载的节奏靠这里驱动
		if (wasSaga) pumpSaga();
	}
}

function stepReader(dir: 1 | -1) {
	if (!readerId) return;
	// 按信箱里的排的顺序走：话本按回目连着翻，读到边界就收起来
	const idx = inboxList.indexOf(readerId);
	const target = inboxList[idx + dir];
	if (target) openReader(target);
	else closeReader();
}

$effect(() => {
	const onStory = (e: Event) => {
		const ids = (e as CustomEvent<{ ids: string[] }>).detail.ids;
		const set = new Set(unlockedIds);
		let changed = false;
		for (const id of ids)
			if (storyOf(id) && !set.has(id)) {
				set.add(id);
				changed = true;
			}
		if (changed) {
			unlockedIds = [...set];
			openReader(ids[0]);
			playStory();
		}
	};
	window.addEventListener(STORY_EVENT, onStory as EventListener);
	return () =>
		window.removeEventListener(STORY_EVENT, onStory as EventListener);
});

/** 侧栏「修行」卡片的信封按钮派单来开门 */
$effect(() => {
	const onOpen = () => {
		mailboxOpen = true;
	};
	window.addEventListener(OPEN_INBOX_EVENT, onOpen);
	return () => window.removeEventListener(OPEN_INBOX_EVENT, onOpen);
});
</script>

<!-- 信箱列表 -->
{#if mailboxOpen}
	<div
		class="sib-backdrop"
		onclick={() => (mailboxOpen = false)}
		role="presentation"
	></div>
	<dialog class="sib-mailbox" open>
		<header class="sib-mb-head">
			<span>飞剑传书</span>
			<button type="button" class="sib-mb-close" onclick={() => (mailboxOpen = false)}
				>合上</button
			>
		</header>
		<ul class="sib-mb-list">
			{#each inboxList as id (id)}
				{@const s = storyOf(id)}
				{#if s}
					<li class:is-unread={!readIds.has(id)}>
						<button type="button" class="sib-mb-item" onclick={() => openReader(id)}>
							<span class="sib-mb-dot"></span>
							<span class="sib-mb-title">{s.title}</span>
							<span class="sib-mb-from">{s.from}</span>
						</button>
					</li>
				{/if}
			{/each}
		</ul>
	</dialog>
{/if}

<!-- 拆信阅读器 -->
{#if readerId && readerStory}
	<div
		class="sib-backdrop"
		onclick={closeReader}
		role="presentation"
	></div>
	<dialog class="sib-reader" open>
		<header class="sib-r-head">
			<span class="sib-r-from">{readerStory.from}</span>
			<button type="button" class="sib-r-close" onclick={closeReader}>封缄</button>
		</header>
		<h3 class="sib-r-title" class:is-saga={!!readerChapter}>{readerStory.title}</h3>
		{#if readerChapter}
			<p class="sib-r-badge">
				{readerChapter.volume}
				<span>·</span>
				{readerChapter.no === 0 ? "楔子" : `第 ${readerChapter.no} 回`}
			</p>
		{/if}
		<div class="sib-r-body">
			{#each readerStory.paragraphs as p, i (i)}
				<p>{p}</p>
			{/each}
		</div>
		<footer class="sib-r-foot">
			<button type="button" class="sib-r-nav" onclick={() => stepReader(-1)}>上一封</button>
			<button type="button" class="sib-r-nav" onclick={() => stepReader(1)}>下一封</button>
		</footer>
	</dialog>
{/if}

<style>
	/* 入口按钮已挪到侧栏「修行」卡片（CultivationDock.svelte），这里只留信箱/阅读器 */

	.sib-backdrop {
		position: fixed;
		inset: 0;
		z-index: 95;
		background: rgb(20 14 6 / 0.5);
		backdrop-filter: blur(3px);
	}
	.sib-mailbox,
	.sib-reader {
		position: fixed;
		z-index: 100;
		margin: auto;
		padding: 0;
		border: 0;
		max-width: 30rem;
		width: calc(100vw - 2rem);
	}
	.sib-mailbox {
		top: 50%;
		transform: translateY(-50%);
	}
	.sib-reader {
		top: 50%;
		bottom: auto;
		transform: translateY(-50%);
	}

	.sib-mb-head,
	.sib-r-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.7rem 1rem;
		border-bottom: 1px solid color-mix(in srgb, #c9a44c 30%, transparent);
		font-size: 0.9rem;
		font-weight: 800;
		color: #4a4335;
	}
	:global(html.dark) .sib-mb-head,
	:global(html.dark) .sib-r-head {
		color: #e9e1ce;
	}
	.sib-mb-close,
	.sib-r-close {
		padding: 0.24rem 0.66rem;
		border: 1px solid color-mix(in srgb, #c9a44c 36%, transparent);
		border-radius: 99px;
		background: transparent;
		font-size: 0.66rem;
		color: inherit;
		cursor: pointer;
	}
	.sib-mailbox {
		border-radius: 16px;
		overflow: hidden;
		background: #fffdf7;
		box-shadow: 0 18px 44px rgb(0 0 0 / 0.24);
	}
	:global(html.dark) .sib-mailbox {
		background: #211b13;
	}
	.sib-mb-list {
		max-height: 56vh;
		overflow-y: auto;
		margin: 0;
		padding: 0.4rem;
		list-style: none;
		display: grid;
		gap: 0.2rem;
	}
	.sib-mb-item {
		display: grid;
		grid-template-columns: 0.7rem 1fr auto;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		padding: 0.5rem 0.6rem;
		border: 0;
		border-radius: 0.6rem;
		background: transparent;
		text-align: left;
		cursor: pointer;
		transition: background 150ms ease;
	}
	.sib-mb-item:hover {
		background: color-mix(in srgb, #c9a44c 12%, transparent);
	}
	.sib-mb-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: transparent;
		box-shadow: inset 0 0 0 1px color-mix(in srgb, #857d6c 60%, transparent);
	}
	/* 未读红点：is-unread 挂在 <li> 上（见上面的 {#each}），别只匹配 .sib-mb-item */
	li.is-unread .sib-mb-dot {
		background: #c2557a;
		box-shadow: 0 0 0 0 transparent;
	}
	.sib-mb-title {
		font-size: 0.78rem;
		font-weight: 700;
		color: #4a4335;
	}
	:global(html.dark) .sib-mb-title {
		color: #e9e1ce;
	}
	.sib-mb-from {
		font-size: 0.64rem;
		color: #857d6c;
	}

	/* 拆信阅读器：纸卷风 */
	.sib-reader {
		border-radius: 16px;
		overflow: hidden;
		background: linear-gradient(160deg, #fbf3df, #f3e6c4);
		color: #4a4335;
		box-shadow: 0 18px 44px rgb(0 0 0 / 0.28);
	}
	:global(html.dark) .sib-reader {
		background: linear-gradient(160deg, #2a2218, #1d160e);
		color: #e9e1ce;
	}
	.sib-r-title {
		margin: 0;
		padding: 0.6rem 1rem 0.4rem;
		font-size: 1.02rem;
		font-weight: 800;
	}
	.sib-r-title.is-saga {
		padding-bottom: 0.15rem;
		font-size: 1.12rem;
	}
	/* 话本章节：卷名 + 回目，一眼区分「连载」和「小笺」 */
	.sib-r-badge {
		margin: 0;
		padding: 0 1rem 0.5rem;
		font-size: 0.66rem;
		letter-spacing: 0.12em;
		color: #a08a52;
		display: flex;
		gap: 0.35rem;
		align-items: center;
	}
	.sib-r-badge span {
		opacity: 0.5;
	}
	:global(html.dark) .sib-r-badge {
		color: #c8ab6a;
	}
	.sib-r-body {
		padding: 0 1.1rem;
		max-height: 44vh;
		overflow-y: auto;
	}
	.sib-r-body p {
		margin: 0 0 0.7rem;
		font-size: 0.82rem;
		line-height: 1.9;
		text-indent: 2em;
		color: inherit;
	}
	.sib-r-foot {
		display: flex;
		gap: 0.5rem;
		justify-content: flex-end;
		padding: 0.6rem 1rem 0.8rem;
		border-top: 1px solid color-mix(in srgb, #c9a44c 24%, transparent);
	}
	.sib-r-nav {
		padding: 0.3rem 0.8rem;
		border: 1px solid color-mix(in srgb, #c9a44c 40%, transparent);
		border-radius: 99px;
		background: transparent;
		font-size: 0.7rem;
		color: inherit;
		cursor: pointer;
	}
	.sib-r-nav:hover {
		background: color-mix(in srgb, #c9a44c 16%, transparent);
	}
</style>
