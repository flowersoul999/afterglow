<script lang="ts">
/**
 * 修仙境界面板：四张技能图页面顶部各放一块。
 *
 * 显示当前境界（凡人修仙传九境）、修为进度条、距下一境界还差多少，
 * 以及「修行路引」——四张图按解锁顺序排开，没到境界的图是暗的。
 *
 * 数据来源见 src/data/cultivation.ts：和技能图共用同一批 localStorage 键，
 * SkillTree 勾选时会广播 aemeath-cultivation-changed 事件，这里监听它实时刷新；
 * SSR / 无存档时按各图出厂预设算（与技能图首屏一致，不会闪一个错的状态）。
 */
import {
	CULTIVATION_EVENT,
	type CultivationState,
	GRAPH_JOURNEY,
	type GraphId,
	getCultivationLog,
	OPEN_INBOX_EVENT,
	OPEN_SHELF_EVENT,
	snapshot,
} from "@/data/cultivation";
import { isMuted, setMuted } from "@/lib/sfx";

interface Props {
	/** 当前所在的图，用来在路引里点亮「此地」 */
	here: GraphId;
}

let { here }: Props = $props();

let st = $state<CultivationState>(snapshot());

$effect(() => {
	const refresh = () => {
		st = snapshot();
	};
	window.addEventListener(CULTIVATION_EVENT, refresh);
	window.addEventListener("storage", refresh);
	return () => {
		window.removeEventListener(CULTIVATION_EVENT, refresh);
		window.removeEventListener("storage", refresh);
	};
});

const barPct = $derived(
	Math.min(100, Math.max(0, Math.round(st.pct * 10) / 10)),
);

/* ---------- 修行手札 + 音效开关 ---------- */
let showLog = $state(false);
let muted = $state(isMuted());
let logEntries = $state<ReturnType<typeof getCultivationLog>>([]);

/**
 * 必须用原生 <dialog> + showModal()，不能只写 `open` 属性：
 * 只有 showModal() 才把元素送进 top layer，祖先 .onload-animation 上的
 * transform 就不会劫持 fixed 的包含块（否则弹窗会跑到页面下方、只露一半，
 * ::backdrop 也不生效）。顺带白拿焦点循环和 ESC 关闭。
 */
let logEl = $state<HTMLDialogElement | null>(null);

function openLog() {
	logEntries = getCultivationLog().slice().reverse();
	showLog = true;
	// dialog 是常驻 DOM，showModal() 可以直接调
	if (!logEl?.open) logEl?.showModal();
}

function closeLog() {
	logEl?.close();
}

function toggleMute() {
	muted = !muted;
	setMuted(muted);
}

function fmt(ts: number): string {
	const d = new Date(ts);
	const p = (n: number) => String(n).padStart(2, "0");
	return `${d.getMonth() + 1}月${d.getDate()}日 ${p(d.getHours())}:${p(d.getMinutes())}`;
}
</script>

<section class="xp-panel" aria-label="修仙境界">
	<div class="xp-head">
		<span class="xp-eyebrow">修仙境界</span>
		<span class="xp-realm">{st.realm.name}</span>
		<p class="xp-note">{st.realm.note}</p>
	</div>

	<div class="xp-meter">
		<div
			class="xp-bar"
			role="progressbar"
			aria-label="修为进度"
			aria-valuemin={0}
			aria-valuemax={st.totalXp}
			aria-valuenow={st.xp}
		>
			<i style={`width:${barPct}%`}></i>
		</div>
		<p class="xp-nums">
			修为 <b>{st.xp}</b><span class="xp-dim"> / {st.totalXp}</span>
			{#if st.next}
				<span class="xp-dim">· 距</span>「{st.next.name}」<span class="xp-dim"
					>还差</span
				> <b>{st.toNextXp}</b>
			{:else}
				<span class="xp-dim">· 渡劫功成，修行圆满</span>
			{/if}
		</p>
		<p class="xp-rule">
			每勾一条学习清单，按方向重要度得 1~5 点修为——技能越难、方向越核心，涨得越快。
		</p>
	</div>

	<ul class="xp-journey" aria-label="修行路引">
		{#each GRAPH_JOURNEY as g (g.id)}
			<li>
				<a
					class={"xp-stop" + (g.id === here ? " is-here" : "") + (!st.unlocked[g.id] ? " is-locked" : "")}
					href={g.href}
					aria-current={g.id === here ? "page" : undefined}
				>
					<span class="xp-stop-name">{g.name}</span>
					<span class="xp-stop-gate">{g.gateLabel}</span>
				</a>
			</li>
		{/each}
	</ul>

	<div class="xp-acts">
		<button type="button" class="xp-act" aria-expanded={showLog} onclick={openLog}
			>修行手札</button
		>
		<!-- 技能图这几页是 hideSidebars，侧栏那张「修行」卡片不渲染，
		     入口在这里补一份，别让 /skills/ /cs/ /be/ /ag/ 上找不着话本和来信 -->
		<button
			type="button"
			class="xp-act"
			onclick={() => window.dispatchEvent(new CustomEvent(OPEN_SHELF_EVENT))}
		>
			话本楼
		</button>
		<button
			type="button"
			class="xp-act"
			onclick={() => window.dispatchEvent(new CustomEvent(OPEN_INBOX_EVENT))}
		>
			飞剑传书
		</button>
		<button
			type="button"
			class="xp-act"
			onclick={toggleMute}
			aria-pressed={muted}
		>
			{muted ? "🔇 音效已关" : "🔊 音效开启"}
		</button>
	</div>

	<!-- 常驻 DOM，靠 showModal()/close() 开关；别套 {#if}，否则首次 showModal 会扑空 -->
	<dialog
		bind:this={logEl}
		class="xp-log-modal"
		aria-label="修行手札"
		onclose={() => (showLog = false)}
		onclick={(e) => {
			if (e.target === logEl) closeLog();
		}}
	>
		<div class="xp-log-box">
			<header class="xp-log-head">
				<span class="xp-log-title">修行手札</span>
				<button type="button" class="xp-log-close" onclick={closeLog}>收起 ✕</button>
			</header>
			{#if logEntries.length === 0}
				<p class="xp-log-empty">尚无修行记录。去勾掉第一条学习清单，写下你的第一行吧。</p>
			{:else}
				<ul class="xp-log-list">
					{#each logEntries as e, i (i)}
						<li>
							<span class="xp-log-time">{fmt(e.ts)}</span>
							<span class="xp-log-text">{e.verb}「{e.title}」，修为 +{e.xp}</span>
						</li>
					{/each}
				</ul>
			{/if}
			<p class="xp-log-foot">共 {logEntries.length} 条 · 按 Esc 或点空处亦可收起</p>
		</div>
	</dialog>
</section>

<style>
	/* 配色与 SkillGraphSwitch / SkillTree 同源（暖纸 + 金）。改色时几处一起改。 */
	.xp-panel {
		--xp-gold: #c9a44c;
		--xp-gold-dp: #8a6d24;
		--xp-ink: #4a4335;
		--xp-ink-2: #857d6c;
		--xp-panel: #fffdf7;
		--xp-line: rgba(150, 128, 76, 0.22);
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.8rem 1.4rem;
		margin-bottom: 1rem;
		padding: 0.85rem 1rem;
		border-radius: 16px;
		border: 1px solid var(--xp-line);
		background: var(--xp-panel);
	}

	:global(html.dark) .xp-panel {
		--xp-gold: #d9b45f;
		--xp-gold-dp: #a9862f;
		--xp-ink: #e9e1ce;
		--xp-ink-2: #a79d88;
		--xp-panel: #211b13;
		--xp-line: rgba(214, 178, 96, 0.16);
	}

	.xp-head {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		min-width: 11rem;
	}

	.xp-eyebrow {
		font-size: 0.62rem;
		font-weight: 700;
		letter-spacing: 0.18em;
		color: color-mix(in srgb, var(--xp-gold-dp) 88%, transparent);
	}

	.xp-realm {
		font-size: 1.25rem;
		font-weight: 800;
		line-height: 1.2;
		color: var(--xp-ink);
	}

	.xp-note {
		margin: 0;
		font-size: 0.68rem;
		line-height: 1.5;
		color: var(--xp-ink-2);
		max-width: 22rem;
	}

	.xp-meter {
		flex: 1 1 16rem;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.xp-bar {
		height: 8px;
		border-radius: 99px;
		background: color-mix(in srgb, var(--xp-gold) 14%, transparent);
		overflow: hidden;
	}

	.xp-bar i {
		display: block;
		height: 100%;
		border-radius: inherit;
		background: linear-gradient(90deg, color-mix(in srgb, var(--xp-gold) 65%, transparent), var(--xp-gold));
		transition: width 400ms ease;
	}

	.xp-nums {
		margin: 0;
		font-size: 0.72rem;
		color: var(--xp-ink);
		font-variant-numeric: tabular-nums;
	}

	.xp-nums b {
		font-weight: 800;
	}

	.xp-dim {
		color: var(--xp-ink-2);
	}

	.xp-rule {
		margin: 0;
		font-size: 0.62rem;
		line-height: 1.5;
		color: var(--xp-ink-2);
	}

	.xp-journey {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.xp-stop {
		display: flex;
		flex-direction: column;
		gap: 0.05rem;
		padding: 0.4rem 0.7rem;
		border-radius: 11px;
		border: 1px solid color-mix(in srgb, var(--xp-gold) 26%, transparent);
		color: var(--xp-ink-2);
		text-decoration: none;
		line-height: 1.3;
		transition:
			background 180ms ease,
			border-color 180ms ease,
			color 180ms ease,
			opacity 180ms ease;
	}

	.xp-stop:hover {
		background: color-mix(in srgb, var(--xp-gold) 10%, transparent);
		border-color: color-mix(in srgb, var(--xp-gold) 46%, transparent);
		color: var(--xp-ink);
	}

	.xp-stop.is-here {
		background: color-mix(in srgb, var(--xp-gold) 16%, transparent);
		border-color: color-mix(in srgb, var(--xp-gold) 58%, transparent);
		color: var(--xp-ink);
	}

	.xp-stop.is-locked {
		opacity: 0.45;
		border-style: dashed;
	}

	.xp-stop-name {
		font-size: 0.74rem;
		font-weight: 700;
	}

	.xp-stop-gate {
		font-size: 0.6rem;
		font-variant-numeric: tabular-nums;
	}

	/* ===================== 手札 / 音效 ===================== */
	.xp-acts {
		display: flex;
		gap: 0.5rem;
		margin-top: 0.7rem;
	}
	.xp-act {
		padding: 0.32rem 0.78rem;
		border: 1px solid color-mix(in srgb, var(--xp-gold) 36%, transparent);
		border-radius: 99px;
		background: color-mix(in srgb, var(--xp-gold) 8%, transparent);
		font-size: 0.68rem;
		color: var(--xp-ink);
		cursor: pointer;
		transition: border-color 160ms ease, background 160ms ease;
	}
	.xp-act:hover {
		border-color: color-mix(in srgb, var(--xp-gold) 60%, transparent);
		background: color-mix(in srgb, var(--xp-gold) 16%, transparent);
	}

	/* ===================== 手札弹窗 ===================== */
	/* 原生 dialog（showModal 打开）在 top layer 里，UA 样式给了 inset:0 + margin:auto，
	   天然居中；这里只需要把宽高交给内层 .xp-log-box，别再写 position:fixed
	   —— 那会跟 top layer 打架，也是之前「只露一半」的根因。 */
	.xp-log-modal {
		max-width: none;
		max-height: none;
		margin: auto;
		padding: 0;
		border: 0;
		background: transparent;
		overflow: visible;
	}
	.xp-log-modal::backdrop {
		background: color-mix(in srgb, #1a140a 62%, transparent);
		backdrop-filter: blur(3px);
	}
	.xp-log-box {
		display: flex;
		flex-direction: column;
		width: min(30rem, calc(100vw - 2rem));
		max-height: min(78vh, 640px);
		padding: 1.1rem 1.2rem 0.9rem;
		border: 1px solid color-mix(in srgb, var(--xp-gold) 40%, transparent);
		border-radius: 16px;
		background: var(--xp-panel);
		box-shadow: 0 18px 44px rgb(0 0 0 / 0.22);
	}
	.xp-log-head {
		display: flex;
		flex: none;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding-bottom: 0.6rem;
		border-bottom: 1px solid var(--xp-line);
	}
	.xp-log-title {
		font-size: 0.92rem;
		font-weight: 800;
		color: var(--xp-ink);
	}
	.xp-log-close {
		flex: none;
		padding: 0.26rem 0.7rem;
		border: 1px solid color-mix(in srgb, var(--xp-gold) 36%, transparent);
		border-radius: 99px;
		background: transparent;
		font-size: 0.66rem;
		color: var(--xp-ink-2);
		cursor: pointer;
		transition: border-color 160ms ease, color 160ms ease;
	}
	.xp-log-close:hover {
		border-color: color-mix(in srgb, var(--xp-gold) 60%, transparent);
		color: var(--xp-ink);
	}
	.xp-log-empty {
		margin: 0;
		padding: 1rem 0;
		font-size: 0.76rem;
		line-height: 1.7;
		color: var(--xp-ink-2);
	}
	.xp-log-list {
		flex: 1 1 auto;
		min-height: 0;
		overflow-y: auto;
		margin: 0;
		padding: 0.6rem 0 0.2rem;
		list-style: none;
		display: grid;
		align-content: start;
		gap: 0.28rem;
		overscroll-behavior: contain;
	}
	.xp-log-foot {
		flex: none;
		margin: 0;
		padding-top: 0.55rem;
		border-top: 1px solid var(--xp-line);
		font-size: 0.64rem;
		color: var(--xp-ink-2);
		text-align: center;
	}
	.xp-log-list li {
		display: grid;
		grid-template-columns: 6.6rem 1fr;
		gap: 0.5rem;
		align-items: baseline;
		padding: 0.28rem 0.45rem;
		border-radius: 0.5rem;
		font-size: 0.72rem;
		line-height: 1.5;
	}
	.xp-log-list li:nth-child(odd) {
		background: color-mix(in srgb, var(--xp-gold) 7%, transparent);
	}
	.xp-log-time {
		color: var(--xp-ink-2);
		font-variant-numeric: tabular-nums;
	}
	.xp-log-text {
		color: var(--xp-ink);
	}
</style>
