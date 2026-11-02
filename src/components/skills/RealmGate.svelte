<script lang="ts">
/**
 * 修仙结界：当前图的境界不够时，盖在技能图上方把它挡住。
 *
 * 境界够了（或访客点了放行）就什么都不渲染——组件平时是隐形的。
 * 结界不销毁底下的技能图，只是挡住交互：一旦破境，图原样就在那里。
 * 「我是路过的凡人」只对当前标签页放行（sessionStorage），刷新前有效。
 *
 * ⚠️ 这里必须用原生 `<dialog>` + `showModal()`，不能退回 `div` + `position: fixed`：
 * 页面外层 `.onload-animation`（Astro 入场动画）带 `transform`，祖先一旦有 transform，
 * fixed 的包含块就不再是视口，遮罩会变成「跟整张卡片一样高」，卡片落到屏幕外，
 * 必须往下滚很久才看得见（实测遮罩 top=864 h=1906、卡片中心离视口中心偏 1393px）。
 * `showModal()` 把元素渲染进 top layer，完全不参与祖先的包含块计算，一劳永逸。
 */
import {
	CULTIVATION_EVENT,
	type CultivationState,
	GRAPH_JOURNEY,
	type GraphId,
	journeyOf,
	letVisitorThrough,
	REALMS,
	snapshot,
} from "@/data/cultivation";

interface Props {
	/** 要把守的图 */
	graph: GraphId;
}

let { graph }: Props = $props();

const g = $derived(journeyOf(graph));
const needed = $derived(REALMS[g.realmIndex].name);

let st = $state<CultivationState>(snapshot());
let gateEl = $state<HTMLDialogElement | null>(null);

const locked = $derived(!st.unlocked[graph]);

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

// 解锁后（或放行后）把还开着的 dialog 关掉，否则会一直锁着页面
$effect(() => {
	if (!locked && gateEl?.open) gateEl.close();
});

// 首次出现时打开。dialog 挂上来之后要等一拍才能 showModal
$effect(() => {
	if (locked && gateEl && !gateEl.open) {
		queueMicrotask(() => {
			if (gateEl && !gateEl.open) gateEl.showModal();
		});
	}
});

const pctText = $derived(Math.round(st.pct));
</script>

{#if locked}
	<dialog
		bind:this={gateEl}
		class="realm-gate"
		aria-label="修仙结界"
		onclose={() => {
			// 只有「放行」才该关；若仍未解锁则立刻重新打开，别让人绕过结界
			if (!st.unlocked[graph]) gateEl?.showModal();
		}}
	>
		<div class="rg-card">
			<span class="rg-eyebrow">修仙结界</span>
			<p class="rg-title">此地灵气太盛，非「{needed}」不可妄入</p>
			<p class="rg-desc">
				「{g.name}」需修至 <b>{needed}</b> 方可修炼。你如今是
				<b>{st.realm.name}</b>，修为 {st.xp} / {st.totalXp}（{pctText}%）。
			</p>
			<p class="rg-hint">
				回 <a href={GRAPH_JOURNEY[0].href}>{GRAPH_JOURNEY[0].name}</a>
				打坐去吧——每勾一条学习清单都有修为进账，{needed}一到，此地自开。
			</p>
			<button
				type="button"
				class="rg-bypass"
				onclick={() => {
					letVisitorThrough();
					gateEl?.close();
				}}
			>
				我是路过的凡人，只想看看图长什么样
			</button>
		</div>
	</dialog>
{/if}

<style>
	/* 与 CultivationPanel / SkillGraphSwitch 同一套暖纸+金配色 */
	.realm-gate {
		--rg-gold: #c9a44c;
		--rg-gold-dp: #8a6d24;
		--rg-ink: #4a4335;
		--rg-ink-2: #857d6c;
		--rg-panel: #fffdf7;
		/* dialog 默认样式要重置：它自带 fixed 定位、max-width、边框和背景色 */
		position: fixed;
		inset: 0;
		width: 100%;
		max-width: none;
		height: 100%;
		max-height: none;
		margin: 0;
		padding: 1.5rem;
		border: none;
		background: color-mix(in srgb, var(--rg-panel) 82%, transparent);
		backdrop-filter: blur(7px);
		-webkit-backdrop-filter: blur(7px);
		color: var(--rg-ink);
		overflow: hidden;
		box-sizing: border-box;
	}
	/* showModal() 才有的伪元素；不用它时保持透明，避免遮掉未锁的页面 */
	.realm-gate::backdrop {
		background: transparent;
	}
	/* display:flex 居中：dialog 打开时默认是 none，靠 open 属性上的 flex 撑开 */
	.realm-gate[open] {
		display: flex;
		align-items: center;
		justify-content: center;
	}

	:global(html.dark) .realm-gate {
		--rg-gold: #d9b45f;
		--rg-gold-dp: #a9862f;
		--rg-ink: #e9e1ce;
		--rg-ink-2: #a79d88;
		--rg-panel: #211b13;
	}

	.rg-card {
		max-width: 26rem;
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
		text-align: center;
		padding: 1.4rem 1.5rem;
		border-radius: 16px;
		border: 1px solid color-mix(in srgb, var(--rg-gold) 34%, transparent);
		background: color-mix(in srgb, var(--rg-panel) 88%, transparent);
		box-shadow: 0 12px 34px rgb(0 0 0 / 0.1);
	}

	.rg-eyebrow {
		font-size: 0.62rem;
		font-weight: 700;
		letter-spacing: 0.2em;
		color: color-mix(in srgb, var(--rg-gold-dp) 88%, transparent);
	}

	.rg-title {
		margin: 0;
		font-size: 1.05rem;
		font-weight: 800;
		color: var(--rg-ink);
	}

	.rg-desc,
	.rg-hint {
		margin: 0;
		font-size: 0.76rem;
		line-height: 1.7;
		color: var(--rg-ink-2);
		font-variant-numeric: tabular-nums;
	}

	.rg-desc b {
		color: var(--rg-ink);
		font-weight: 800;
	}

	.rg-hint a {
		color: color-mix(in srgb, var(--rg-gold-dp) 92%, transparent);
		font-weight: 700;
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	.rg-bypass {
		margin-top: 0.3rem;
		align-self: center;
		padding: 0.42rem 0.9rem;
		font-size: 0.68rem;
		border-radius: 99px;
		border: 1px dashed color-mix(in srgb, var(--rg-gold) 46%, transparent);
		background: transparent;
		color: var(--rg-ink-2);
		cursor: pointer;
		transition:
			color 180ms ease,
			border-color 180ms ease,
			background 180ms ease;
	}

	.rg-bypass:hover {
		color: var(--rg-ink);
		border-color: color-mix(in srgb, var(--rg-gold) 70%, transparent);
		background: color-mix(in srgb, var(--rg-gold) 10%, transparent);
	}
</style>
