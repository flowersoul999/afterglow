<script lang="ts">
/**
 * 修行录面板：给无门禁、不加修为的图（音乐 / 英语 / 理财 …）放在页面顶部。
 *
 * 和 CultivationPanel 的区别：那里显示的是**境界与修为**（会随勾选一路往上涨，
 * 还要算距离下一境界还差多少）；这里显示的是**这张图自己的属性**（音准 / 技法 / 作品）。
 * 修行录不进境界链，所以这里刻意不出现任何「修为」「境界」字样 ——
 * 免得让人以为练音乐能结丹。
 *
 * 数据源和 SkillTree 完全同源：同一批 localStorage 键 + 同一份 PRESET，
 * 勾选时 SkillTree 会写存档，属性条靠 storage/cultivation 事件或 SSR 首屏算出来。
 */
import type { SkillAttr } from "@/data/skills";

interface Props {
	/** 属性定义：id / 显示名 / 短标签 / 说明 */
	attrs: SkillAttr[];
	/** 属性当前值 / 满值 */
	stats: { value: Record<string, number>; max: Record<string, number> };
	/** 已点亮的技能数 / 总技能数 */
	mastered: { lit: number; total: number };
	/** 角色称号 */
	title: { name: string; note: string };
	/** 图的大标题 */
	heading: string;
	/** 一句话说清这张图不计入境界 */
	note: string;
}

const { attrs, stats, mastered, title, heading, note }: Props = $props();

const overall = $derived(
	mastered.total > 0
		? Math.min(100, Math.round((mastered.lit / mastered.total) * 100))
		: 0,
);
</script>

<section class="rec-panel" aria-label="修行录属性">
	<header class="rec-panel__head">
		<div class="rec-panel__who">
			<p class="rec-panel__cap">{heading}</p>
			<h2 class="rec-panel__title">
				{title.name}
				<span class="rec-panel__sub">{title.note}</span>
			</h2>
		</div>
		<div class="rec-panel__pct">
			<b>{mastered.lit}</b>
			<i>/ {mastered.total} 项技能已点亮</i>
		</div>
	</header>

	<div
		class="rec-panel__bar"
		role="progressbar"
		aria-valuenow={overall}
		aria-valuemin="0"
		aria-valuemax="100"
		aria-label="总体进度"
	>
		<span style={`width:${overall}%`}></span>
	</div>

	<ul class="rec-panel__attrs">
		{#each attrs as a (a.id)}
			{@const v = stats.value[a.id] ?? 0}
			{@const m = stats.max[a.id] ?? 1}
			<li class="rec-attr" style={`--rec-c:#${a.color}`}>
				<div class="rec-attr__top">
					<span class="rec-attr__name">{a.name}</span>
					<span class="rec-attr__num">
						<b>{v}</b>
						<i>/ {m}</i>
					</span>
				</div>
				<div class="rec-attr__bar">
					<span style={`width:${m > 0 ? Math.min(100, (v / m) * 100) : 0}%`}
					></span>
				</div>
				<p class="rec-attr__note">{a.note}</p>
			</li>
		{/each}
	</ul>

	<p class="rec-panel__foot">{note}</p>
</section>

<style>
	.rec-panel {
		--rec-line: color-mix(in srgb, var(--text-color) 14%, transparent);
		--rec-ink-2: color-mix(in srgb, var(--text-color) 62%, transparent);
		padding: 0.95rem 1.05rem 0.9rem;
		margin-bottom: 1rem;
		border-radius: 14px;
		border: 1px solid var(--rec-line);
		background: color-mix(in srgb, var(--text-color) 4%, transparent);
	}

	.rec-panel__head {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.rec-panel__cap {
		margin: 0 0 0.2rem;
		font-size: 0.66rem;
		font-weight: 700;
		letter-spacing: 0.14em;
		color: var(--rec-ink-2);
	}

	.rec-panel__title {
		margin: 0;
		display: flex;
		align-items: baseline;
		gap: 0.55rem;
		flex-wrap: wrap;
		font-size: 1.15rem;
		font-weight: 700;
		color: var(--text-color);
	}

	.rec-panel__sub {
		font-size: 0.74rem;
		font-weight: 400;
		color: var(--rec-ink-2);
	}

	.rec-panel__pct {
		display: flex;
		align-items: baseline;
		gap: 0.3rem;
		font-size: 0.78rem;
		color: var(--rec-ink-2);
	}

	.rec-panel__pct b {
		font-size: 1.3rem;
		font-weight: 700;
		color: var(--text-color);
		font-variant-numeric: tabular-nums;
	}

	.rec-panel__pct i {
		font-style: normal;
	}

	.rec-panel__bar {
		height: 7px;
		margin: 0.7rem 0 0.9rem;
		border-radius: 99px;
		background: color-mix(in srgb, var(--text-color) 10%, transparent);
		overflow: hidden;
	}

	.rec-panel__bar span {
		display: block;
		height: 100%;
		border-radius: 99px;
		background: color-mix(in srgb, var(--text-color) 46%, transparent);
		transition: width 320ms ease;
	}

	.rec-panel__attrs {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
		gap: 0.7rem 1.1rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.rec-attr__top {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.rec-attr__name {
		font-size: 0.84rem;
		font-weight: 700;
		color: var(--text-color);
	}

	.rec-attr__num {
		font-size: 0.72rem;
		color: var(--rec-ink-2);
		font-variant-numeric: tabular-nums;
	}

	.rec-attr__num b {
		font-size: 0.95rem;
		font-weight: 700;
		color: color-mix(in srgb, var(--rec-c) 78%, var(--text-color));
	}

	.rec-attr__num i {
		font-style: normal;
	}

	.rec-attr__bar {
		height: 5px;
		margin: 0.28rem 0 0.34rem;
		border-radius: 99px;
		background: color-mix(in srgb, var(--text-color) 10%, transparent);
		overflow: hidden;
	}

	.rec-attr__bar span {
		display: block;
		height: 100%;
		border-radius: 99px;
		background: color-mix(in srgb, var(--rec-c) 72%, transparent);
		transition: width 320ms ease;
	}

	.rec-attr__note {
		margin: 0;
		font-size: 0.7rem;
		line-height: 1.5;
		color: var(--rec-ink-2);
	}

	.rec-panel__foot {
		margin: 0.85rem 0 0;
		padding-top: 0.65rem;
		border-top: 1px dashed var(--rec-line);
		font-size: 0.71rem;
		line-height: 1.6;
		color: var(--rec-ink-2);
	}
</style>
