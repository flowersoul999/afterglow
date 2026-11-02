<script lang="ts">
/**
 * 侧栏「修行」卡片：话本楼 + 飞剑传书这两个沉浸层入口的落脚点。
 *
 * 为什么不留在 StoryInbox / SagaLibrary 里：那两个组件常驻 Layout 的 body 底部，
 * 按钮以前是 position:fixed 钉在视口左下角 —— 压在正文上、跟着全屏滚动，
 * 而且窄屏容易被正文栏挡住。搬进侧栏后随文档滚动，位置固定在读者的视线里。
 *
 * 本组件只管「入口 + 角标」，本体 dialog 仍在 StoryInbox / SagaLibrary，
 * 两者靠 cultivation.ts 的 OPEN_SHELF_EVENT / OPEN_INBOX_EVENT 搭桥。
 */
import {
	CULTIVATION_EVENT,
	OPEN_INBOX_EVENT,
	OPEN_SHELF_EVENT,
	STORY_EVENT,
	unlockEgg,
} from "@/data/cultivation";
import { ENVELOPE_SPAM_STORY } from "@/data/cultivationStories";
import { allSagaChapters, sagaTotalChars } from "@/data/saga";

const UNLOCKED_KEY = "aemeath-stories-unlocked";
const READ_KEY = "aemeath-stories-read";

const chapters = allSagaChapters();
const totalChars = sagaTotalChars();

function readUnlocked(): string[] {
	try {
		const raw = localStorage.getItem(UNLOCKED_KEY);
		return raw ? (JSON.parse(raw) as string[]) : [];
	} catch {
		return [];
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

let unlockedIds = $state<string[]>([]);
let readIds = $state<Set<string>>(new Set());
let envelopeSpam = 0;

function refresh() {
	unlockedIds = readUnlocked();
	readIds = readRead();
}

$effect(() => {
	refresh();
	const onStory = () => refresh();
	window.addEventListener(STORY_EVENT, onStory as EventListener);
	window.addEventListener(CULTIVATION_EVENT, onStory);
	window.addEventListener("storage", onStory);
	return () => {
		window.removeEventListener(STORY_EVENT, onStory as EventListener);
		window.removeEventListener(CULTIVATION_EVENT, onStory);
		window.removeEventListener("storage", onStory);
	};
});

/** 话本已启封回数 —— 书架角标 */
const openedCount = $derived(
	chapters.filter((c) => unlockedIds.includes(c.id)).length,
);
/** 未读来信数（话本回目 + 彩蛋小笺）—— 信封角标 */
const unread = $derived(unlockedIds.filter((id) => !readIds.has(id)).length);

function openShelf() {
	window.dispatchEvent(new CustomEvent(OPEN_SHELF_EVENT));
}

function openInbox() {
	window.dispatchEvent(new CustomEvent(OPEN_INBOX_EVENT));
	// 连点信封 5 次的彩蛋：老入口上的隐藏玩法，搬家后别丢
	if (++envelopeSpam >= 5) {
		envelopeSpam = 0;
		unlockEgg(ENVELOPE_SPAM_STORY);
	}
}

/** 「下一回已挣得、读完当前这封才到手」的提示文案 */
const shelfHint = $derived.by(() => {
	if (openedCount === 0)
		return `佚名 · 共 ${chapters.length} 回 · 约 ${totalChars} 字`;
	const next = chapters[openedCount];
	if (!next) return "全书已启封完";
	return `已启封 ${openedCount} / ${chapters.length} 回 · 下一回${next.no === 0 ? "楔子" : `第 ${next.no} 回`}待启封`;
});

/** 角标旁的一行进度条，和书架里的比例一致 */
const shelfPct = $derived(
	Math.min(100, Math.round((openedCount / Math.max(1, chapters.length)) * 100)),
);

const inboxHint = $derived(
	unread > 0 ? `飞剑传书 · ${unread} 封未拆` : "飞剑传书 · 暂无未读",
);
</script>

<div class="cd-dock">
	<button type="button" class="cd-row" onclick={openShelf}>
		<span class="cd-icon cd-icon-shelf" aria-hidden="true">
			<svg viewBox="0 0 24 24">
				<path
					d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5v-13Z"
					fill="none"
					stroke="currentColor"
					stroke-width="1.6"
					stroke-linejoin="round"
				/>
				<path
					d="M13 4h5.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H13V4Z"
					fill="none"
					stroke="currentColor"
					stroke-width="1.6"
					stroke-linejoin="round"
				/>
			</svg>
		</span>
		<span class="cd-body">
			<span class="cd-name">
				话本楼
				<span class="cd-sub">佚名</span>
			</span>
			<span class="cd-hint">{shelfHint}</span>
		</span>
		{#if openedCount > 0}
			<span class="cd-badge cd-badge-shelf">{openedCount}</span>
		{/if}
	</button>

	<div class="cd-bar" aria-hidden="true">
		<i style={`width:${shelfPct}%`}></i>
	</div>

	<button type="button" class="cd-row" onclick={openInbox}>
		<span class="cd-icon cd-icon-mail" aria-hidden="true">
			<svg viewBox="0 0 24 24">
				<path
					d="M3 6.5 12 13l9-6.5M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z"
					fill="none"
					stroke="currentColor"
					stroke-width="1.6"
					stroke-linejoin="round"
				/>
			</svg>
		</span>
		<span class="cd-body">
			<span class="cd-name">飞剑传书</span>
			<span class="cd-hint">{inboxHint}</span>
		</span>
		{#if unread > 0}
			<span class="cd-badge cd-badge-mail">{unread}</span>
		{/if}
	</button>
</div>

<style>
	/* 配色与 CultivationPanel / SagaLibrary 同源（暖纸 + 金） */
	.cd-dock {
		--cd-gold: #c9a44c;
		--cd-gold-dp: #8a6d24;
		--cd-ink: #4a4335;
		--cd-ink-2: #857d6c;
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}
	:global(html.dark) .cd-dock {
		--cd-gold: #d9b45f;
		--cd-gold-dp: #a9862f;
		--cd-ink: #e9e1ce;
		--cd-ink-2: #a79d88;
	}

	.cd-row {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		width: 100%;
		padding: 0.45rem 0.35rem;
		border: 0;
		border-radius: 10px;
		background: transparent;
		text-align: left;
		cursor: pointer;
		transition: background 160ms ease;
	}
	.cd-row:hover {
		background: color-mix(in srgb, var(--cd-gold) 12%, transparent);
	}
	.cd-row:focus-visible {
		outline: 2px solid color-mix(in srgb, var(--cd-gold) 70%, transparent);
		outline-offset: 1px;
	}

	.cd-icon {
		flex: none;
		width: 26px;
		height: 26px;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 1px solid color-mix(in srgb, var(--cd-gold) 38%, transparent);
		border-radius: 8px;
	}
	.cd-icon svg {
		width: 15px;
		height: 15px;
	}
	.cd-icon-shelf {
		background: color-mix(in srgb, #fffdf7 70%, var(--cd-gold));
		color: var(--cd-gold-dp);
	}
	.cd-icon-mail {
		background: color-mix(in srgb, #fdeef3 70%, #c2557a);
		color: #a83f63;
	}
	:global(html.dark) .cd-icon-shelf {
		background: color-mix(in srgb, #211b13 70%, var(--cd-gold));
		color: #e7d09a;
	}
	:global(html.dark) .cd-icon-mail {
		background: color-mix(in srgb, #211b13 70%, #c2557a);
		color: #f0a7c0;
	}

	.cd-body {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.05rem;
	}
	.cd-name {
		display: flex;
		align-items: baseline;
		gap: 0.35rem;
		font-size: 0.8rem;
		font-weight: 700;
		color: var(--cd-ink);
	}
	.cd-sub {
		font-size: 0.6rem;
		font-weight: 500;
		letter-spacing: 0.04em;
		color: var(--cd-ink-2);
	}
	.cd-hint {
		font-size: 0.64rem;
		line-height: 1.5;
		color: var(--cd-ink-2);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.cd-badge {
		flex: none;
		min-width: 18px;
		height: 18px;
		padding: 0 5px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 99px;
		font-size: 0.6rem;
		font-weight: 800;
		font-variant-numeric: tabular-nums;
		color: #fff;
	}
	.cd-badge-shelf {
		background: #b08028;
	}
	.cd-badge-mail {
		background: #c2557a;
	}

	/* 书架进度：夹在两行之间，暗示「话本是一本本解锁的」 */
	.cd-bar {
		height: 4px;
		margin: 0.05rem 0 0.3rem 2.7rem;
		border-radius: 99px;
		background: color-mix(in srgb, var(--cd-gold) 18%, transparent);
		overflow: hidden;
	}
	.cd-bar i {
		display: block;
		height: 100%;
		border-radius: inherit;
		background: linear-gradient(
			90deg,
			color-mix(in srgb, var(--cd-gold) 55%, transparent),
			var(--cd-gold)
		);
		transition: width 320ms ease;
	}
</style>
