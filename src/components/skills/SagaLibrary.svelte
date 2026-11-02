<script lang="ts">
/**
 * 话本楼：连载小说的书架。
 *
 * 和「飞剑传书」的区别：信封是收信口（新回目到手的地方，还混着彩蛋小笺），
 * 这里是书架（只放话本，按卷按回目铺开，可以随时回看任何已启封的一回）。
 *
 * 启封规则与引擎一致：彻底点亮一个技能 = 挣得一枚签 = 多开一回；
 * 读完当前这一回，下一回才到手。未启封的回目只显示回序、不显示标题，不剧透。
 *
 * ⚠️ 这里只留书架与阅读器本体。入口按钮在侧栏「修行」卡片
 * （src/components/skills/CultivationDock.svelte）里，靠 OPEN_SHELF_EVENT 开门。
 */
import { OPEN_SHELF_EVENT, STORY_EVENT } from "@/data/cultivation";
import {
	allSagaChapters,
	getSagaChapter,
	pumpSaga,
	type SagaChapter,
	sagaEarnedQuota,
	sagaTotalChars,
} from "@/data/saga";

const UNLOCKED_KEY = "aemeath-stories-unlocked";
const READ_KEY = "aemeath-stories-read";

function readUnlocked(): Set<string> {
	try {
		const raw = localStorage.getItem(UNLOCKED_KEY);
		return new Set(raw ? (JSON.parse(raw) as string[]) : []);
	} catch {
		return new Set();
	}
}
function readRead(): Set<string> {
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

const chapters = allSagaChapters();
const totalChars = sagaTotalChars();

let unlocked = $state<Set<string>>(readUnlocked());
let read = $state<Set<string>>(readRead());
let quota = $state(sagaEarnedQuota());
let shelfOpen = $state(false);
let readingId = $state<string | null>(null);

let shelfEl = $state<HTMLDialogElement | null>(null);
let readerEl = $state<HTMLDialogElement | null>(null);

/** 已启封的回目，按回序正序 —— 书架里只有这些能翻开 */
const opened = $derived(chapters.filter((c) => unlocked.has(c.id)));
const openedCount = $derived(opened.length);
/** 挣到了但还没发出来的回数（读完当前这封就到手） */
const pending = $derived(Math.max(0, quota - openedCount));
/** 全部启封且没有待发的 = 读完这一卷了 */
const atEnd = $derived(openedCount >= chapters.length);

/** 按卷分组，卷二起不止一卷，目录里要能看出分卷 */
const grouped = $derived.by(() => {
	const out: { volume: string; items: SagaChapter[] }[] = [];
	for (const c of chapters) {
		const last = out[out.length - 1];
		if (last && last.volume === c.volume) last.items.push(c);
		else out.push({ volume: c.volume, items: [c] });
	}
	return out;
});

const reading = $derived(readingId ? getSagaChapter(readingId) : null);
const readingIdx = $derived(
	reading ? opened.findIndex((c) => c.id === reading.id) : -1,
);

/** 中文按每分钟 400 字估，最少算 1 分钟 */
function minutes(chars: number): number {
	return Math.max(1, Math.round(chars / 400));
}
function label(c: SagaChapter): string {
	return c.no === 0 ? "楔子" : `第 ${c.no} 回`;
}

function refresh() {
	unlocked = readUnlocked();
	quota = sagaEarnedQuota();
	read = readRead();
}

function openChapter(id: string) {
	if (!unlocked.has(id)) return;
	readingId = id;
}

function markRead(id: string) {
	if (!read.has(id)) {
		const next = new Set(read);
		next.add(id);
		read = next;
		persistRead(next);
	}
}

function closeReader() {
	const id = readingId;
	readingId = null;
	if (!id) return;
	markRead(id);
	// 读到书架最靠后的一回时才试着发下一回：让「读完这封，下一封到手」的节奏保持一致。
	// （发放会广播解锁事件，由收件箱负责弹窗，这里不重复弹。）
	if (opened.length > 0 && opened[opened.length - 1].id === id) pumpSaga();
}

function step(dir: 1 | -1) {
	const target = opened[readingIdx + dir];
	if (target) readingId = target.id;
	else if (dir === 1) closeReader();
}

function closeShelf() {
	shelfOpen = false;
}

// 原生 dialog：必须 showModal() 才进 top layer（直接写 open 属性，遮罩和内容会跑到页面里）
$effect(() => {
	const el = shelfEl;
	if (!el) return;
	if (shelfOpen && !el.open) el.showModal();
	else if (!shelfOpen && el.open) el.close();
});
$effect(() => {
	const el = readerEl;
	if (!el) return;
	if (readingId && !el.open) el.showModal();
	else if (!readingId && el.open) el.close();
});

// 别处（收件箱/技能图）解锁了新回目，书架跟着长
$effect(() => {
	const onStory = () => refresh();
	window.addEventListener(STORY_EVENT, onStory as EventListener);
	return () =>
		window.removeEventListener(STORY_EVENT, onStory as EventListener);
});

/** 侧栏「修行」卡片的书架按钮派单来开门 */
$effect(() => {
	const onOpen = () => {
		refresh();
		shelfOpen = true;
	};
	window.addEventListener(OPEN_SHELF_EVENT, onOpen);
	return () => window.removeEventListener(OPEN_SHELF_EVENT, onOpen);
});
</script>

<!-- 书架：按回目铺开的目录 -->
<dialog class="slb-shelf" bind:this={shelfEl} onclose={closeShelf}>
	<header class="slb-head">
		<div class="slb-head-main">
			<span class="slb-book">佚名</span>
			<span class="slb-vol">{chapters[0]?.volume ?? ""}</span>
		</div>
		<button type="button" class="slb-close" onclick={closeShelf}>合上</button>
	</header>

	<div class="slb-stat">
		<div class="slb-bar">
			<div class="slb-bar-fill" style={`width:${(openedCount / chapters.length) * 100}%`}></div>
		</div>
		<p class="slb-stat-line">
			已启封 <strong>{openedCount}</strong> / {chapters.length} 回 · 约 {totalChars} 字
		</p>
		<p class="slb-hint">
			{#if atEnd}
				这一卷已经读完，往后且待下卷。
			{:else if pending > 0}
				还有 {pending} 回已挣得——读完当前这一回，它就到手。
			{:else}
				再彻底点亮 1 个技能，启封{label(chapters[openedCount] ?? chapters[0])}。
			{/if}
		</p>
	</div>

	<div class="slb-scroll">
		{#each grouped as group (group.volume)}
		<h4 class="slb-group">{group.volume}</h4>
		<ul class="slb-list">
			{#each group.items as c (c.id)}
				{@const isOpen = unlocked.has(c.id)}
				<li class:is-locked={!isOpen}>
					<button
						type="button"
						class="slb-item"
						disabled={!isOpen}
						onclick={() => openChapter(c.id)}
					>
						<span class="slb-no">{label(c)}</span>
						{#if isOpen}
							<span class="slb-title" class:is-read={read.has(c.id)}>{c.title}</span>
							<span class="slb-meta">{c.chars} 字 · {minutes(c.chars)} 分钟</span>
						{:else}
							<span class="slb-title slb-locked-title">未启封</span>
							<svg class="slb-lock" viewBox="0 0 24 24" aria-hidden="true">
								<path
									d="M8 10V8a4 4 0 0 1 8 0v2m-9 0h10v9H7v-9Z"
									fill="none"
									stroke="currentColor"
									stroke-width="1.5"
									stroke-linejoin="round"
								/>
							</svg>
						{/if}
					</button>
				</li>
			{/each}
		</ul>
		{/each}
	</div>
</dialog>

<!-- 阅读器：与收件箱同款纸卷，只放话本 -->
<dialog class="slb-reader" bind:this={readerEl} onclose={closeReader}>
	{#if reading}
		<header class="slb-r-head">
			<span class="slb-r-from">{reading.volume} · {label(reading)}</span>
			<button type="button" class="slb-close" onclick={closeReader}>封缄</button>
		</header>
		<h3 class="slb-r-title">{reading.title}</h3>
		<div class="slb-r-body">
			{#each reading.paragraphs as p, i (i)}
				<p>{p}</p>
			{/each}
		</div>
		<footer class="slb-r-foot">
			<button
				type="button"
				class="slb-r-nav"
				disabled={readingIdx <= 0}
				onclick={() => step(-1)}>上一回</button
			>
			<span class="slb-r-count">{readingIdx + 1} / {openedCount}</span>
			<button
				type="button"
				class="slb-r-nav"
				disabled={readingIdx >= openedCount - 1}
				onclick={() => step(1)}>下一回</button
			>
		</footer>
	{/if}
</dialog>

<style>
	/* 入口按钮已挪到侧栏「修行」卡片（CultivationDock.svelte），这里只留书架/阅读器 */

	.slb-shelf,
	.slb-reader {
		padding: 0;
		border: 0;
		max-width: 30rem;
		width: calc(100vw - 2rem);
		border-radius: 16px;
		overflow: hidden;
		background: #fffdf7;
		color: #4a4335;
		box-shadow: 0 18px 44px rgb(0 0 0 / 0.24);

		/* ⚠️ 必须显式写回 margin: auto —— 全站 reset（Tailwind preflight）里的
		   `* { margin: 0 }` 把浏览器 UA 给 dialog:modal 的 `margin: auto` 归零了，
		   而 modal dialog 的居中**全靠这个 auto**。归零后 UA 的 inset: 0 会让它
		   贴到视口左上角（position: fixed 还在，top/left 都是 0）。
		   别学 CultivationPanel 那样只写 max-width/height 就以为居中了。 */
		margin: auto;
	}
	:global(html.dark) .slb-shelf,
	:global(html.dark) .slb-reader {
		background: #211b13;
		color: #e9e1ce;
	}
	.slb-shelf::backdrop,
	.slb-reader::backdrop {
		background: rgb(20 14 6 / 0.5);
		backdrop-filter: blur(3px);
	}

	.slb-head,
	.slb-r-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.6rem;
		padding: 0.7rem 1rem;
		border-bottom: 1px solid color-mix(in srgb, #c9a44c 30%, transparent);
	}
	.slb-head-main {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		min-width: 0;
	}
	.slb-book {
		font-size: 0.98rem;
		font-weight: 800;
		letter-spacing: 0.04em;
	}
	.slb-vol,
	.slb-r-from {
		font-size: 0.66rem;
		letter-spacing: 0.12em;
		color: #a08a52;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	:global(html.dark) .slb-vol,
	:global(html.dark) .slb-r-from {
		color: #c8ab6a;
	}
	.slb-close {
		padding: 0.24rem 0.66rem;
		border: 1px solid color-mix(in srgb, #c9a44c 36%, transparent);
		border-radius: 99px;
		background: transparent;
		font-size: 0.66rem;
		color: inherit;
		cursor: pointer;
		white-space: nowrap;
	}

	.slb-stat {
		padding: 0.7rem 1rem 0.2rem;
	}
	.slb-bar {
		height: 5px;
		border-radius: 99px;
		background: color-mix(in srgb, #c9a44c 22%, transparent);
		overflow: hidden;
	}
	.slb-bar-fill {
		height: 100%;
		border-radius: 99px;
		background: linear-gradient(90deg, #d9b45f, #b08028);
		transition: width 240ms ease;
	}
	.slb-stat-line {
		margin: 0.45rem 0 0;
		font-size: 0.7rem;
		color: #6b6353;
	}
	.slb-stat-line strong {
		color: #b08028;
		font-size: 0.82rem;
	}
	:global(html.dark) .slb-stat-line {
		color: #a99f8b;
	}
	.slb-hint {
		margin: 0.2rem 0 0;
		font-size: 0.66rem;
		line-height: 1.7;
		color: #857d6c;
	}

	.slb-group {
		margin: 0.5rem 0 0.2rem;
		padding: 0 0.6rem;
		font-size: 0.64rem;
		font-weight: 800;
		letter-spacing: 0.18em;
		color: #a08a52;
	}
	:global(html.dark) .slb-group {
		color: #c8ab6a;
	}
	.slb-scroll {
		max-height: 52vh;
		overflow-y: auto;
	}
	.slb-list {
		margin: 0;
		padding: 0.5rem;
		list-style: none;
		display: grid;
		gap: 0.15rem;
	}
	.slb-item {
		display: grid;
		grid-template-columns: 3.6rem 1fr auto;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		padding: 0.45rem 0.6rem;
		border: 0;
		border-radius: 0.6rem;
		background: transparent;
		text-align: left;
		color: inherit;
		cursor: pointer;
		transition: background 150ms ease;
	}
	.slb-item:hover:not(:disabled) {
		background: color-mix(in srgb, #c9a44c 12%, transparent);
	}
	.slb-item:disabled {
		cursor: default;
		opacity: 0.42;
	}
	.slb-no {
		font-size: 0.66rem;
		letter-spacing: 0.06em;
		color: #a08a52;
	}
	.slb-title {
		font-size: 0.78rem;
		font-weight: 700;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.slb-title.is-read {
		font-weight: 500;
		color: #857d6c;
	}
	:global(html.dark) .slb-title.is-read {
		color: #9b9384;
	}
	.slb-meta {
		font-size: 0.6rem;
		color: #a09989;
		white-space: nowrap;
	}
	.slb-locked-title {
		font-weight: 500;
		letter-spacing: 0.1em;
	}
	.slb-lock {
		width: 14px;
		height: 14px;
		justify-self: end;
	}

	/* 阅读器：纸卷 */
	.slb-reader {
		background: linear-gradient(160deg, #fbf3df, #f3e6c4);
	}
	:global(html.dark) .slb-reader {
		background: linear-gradient(160deg, #2a2218, #1d160e);
	}
	.slb-r-title {
		margin: 0;
		padding: 0.55rem 1rem 0.35rem;
		font-size: 1.1rem;
		font-weight: 800;
	}
	.slb-r-body {
		padding: 0 1.1rem;
		max-height: 46vh;
		overflow-y: auto;
	}
	.slb-r-body p {
		margin: 0 0 0.7rem;
		font-size: 0.82rem;
		line-height: 1.9;
		text-indent: 2em;
		color: inherit;
	}
	.slb-r-foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0.6rem 1rem 0.8rem;
		border-top: 1px solid color-mix(in srgb, #c9a44c 24%, transparent);
	}
	.slb-r-nav {
		padding: 0.3rem 0.8rem;
		border: 1px solid color-mix(in srgb, #c9a44c 40%, transparent);
		border-radius: 99px;
		background: transparent;
		font-size: 0.7rem;
		color: inherit;
		cursor: pointer;
	}
	.slb-r-nav:hover:not(:disabled) {
		background: color-mix(in srgb, #c9a44c 16%, transparent);
	}
	.slb-r-nav:disabled {
		opacity: 0.35;
		cursor: default;
	}
	.slb-r-count {
		font-size: 0.66rem;
		letter-spacing: 0.08em;
		color: #857d6c;
	}
</style>
