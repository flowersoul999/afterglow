<script lang="ts">
/**
 * 突破大典：跨过境界阈值的那一刻，全屏演一出「破境」戏。
 *
 * 监听 aemeath-breakthrough 事件（由 cultivation.ts 在勾选后跨境界时派发）。
 * 显示大字境界名 + 一句台词 + 灵气粒子，配钟鸣音效；点击或 3 秒后自动散去。
 * 不销毁底下的页面，看完即回到你刚才修行的那张图。
 */
import { BREAKTHROUGH_EVENT, type Realm } from "@/data/cultivation";
import { playBreakthrough } from "@/lib/sfx";

/** 大典台词：境界下标 → 一句 */
const RITE_LINE: Record<number, string> = {
	1: "灵台清明，气沉丹田——前端之地的结界，碎了。",
	2: "金丹凝结，脱胎换骨——后端之门，为你而开。",
	3: "元婴大成，神识离体——Agent 之地，今日起归你统辖。",
	4: "化神。再无新地图，因为路已全在你脚下。",
	5: "炼虚合道，身融虚空。",
	6: "法体合一，移山填海。",
	7: "大乘之境，人界已少有敌手。",
	8: "天劫加身——这一关，最后的妖是你自己。",
};

let active = $state<{ realm: Realm; line: string; key: number } | null>(null);
let riteKey = 0;

$effect(() => {
	const onRite = (e: Event) => {
		const detail = (e as CustomEvent<{ realmName: string; to: number }>).detail;
		// 直接用事件里的境界名构造一个最小 Realm 对象用于展示
		const show: Realm = {
			name: detail.realmName,
			minPct: 0,
			note: "",
		};
		active = {
			realm: show,
			line: RITE_LINE[detail.to] ?? "境界又进一重。",
			key: ++riteKey,
		};
		playBreakthrough();
		window.setTimeout(() => {
			if (active && active.key === riteKey) active = null;
		}, 3200);
	};
	window.addEventListener(BREAKTHROUGH_EVENT, onRite as EventListener);
	return () =>
		window.removeEventListener(BREAKTHROUGH_EVENT, onRite as EventListener);
});

function dismiss() {
	active = null;
}
</script>

{#if active}
	<div
		class="rite"
		role="dialog"
		aria-label="突破大典"
		onclick={dismiss}
		onkeydown={(e) => (e.key === "Escape" || e.key === "Enter" ? dismiss() : null)}
		tabindex="0"
	>
		<div class="rite-inner" key={active.key}>
			<span class="rite-eyebrow">突 破</span>
			<h2 class="rite-name">{active.realm.name}</h2>
			<span class="rite-line"></span>
			<p class="rite-line-text">{active.line}</p>
			<p class="rite-hint">（点击继续修行）</p>
		</div>
		<div class="rite-particles" aria-hidden="true">
			{#each Array(14) as _, i (i)}
				<span style={`--i:${i}`}></span>
			{/each}
		</div>
	</div>
{/if}

<style>
	.rite {
		position: fixed;
		inset: 0;
		z-index: 200;
		display: flex;
		align-items: center;
		justify-content: center;
		background: radial-gradient(
			circle at 50% 45%,
			rgb(20 14 6 / 0.55),
			rgb(8 5 2 / 0.86)
		);
		backdrop-filter: blur(4px);
		animation: rite-in 420ms ease both;
	}
	@keyframes rite-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
	.rite-inner {
		text-align: center;
		animation: rite-pop 700ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
	}
	@keyframes rite-pop {
		0% {
			transform: scale(0.6);
			opacity: 0;
			filter: blur(8px);
		}
		40% {
			transform: scale(1.08);
			opacity: 1;
			filter: blur(0);
		}
		100% {
			transform: scale(1);
		}
	}
	.rite-eyebrow {
		display: block;
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.5em;
		color: color-mix(in srgb, #e7d09a 80%, #fff);
	}
	.rite-name {
		margin: 0.5rem 0 0;
		font-size: clamp(2.6rem, 9vw, 5rem);
		font-weight: 900;
		letter-spacing: 0.16em;
		line-height: 1;
		color: #fff4d4;
		text-shadow:
			0 0 18px rgb(201 164 76 / 0.9),
			0 0 42px rgb(201 164 76 / 0.5);
	}
	.rite-line {
		display: block;
		width: clamp(8rem, 30vw, 16rem);
		height: 1px;
		margin: 1rem auto 0.9rem;
		background: linear-gradient(
			90deg,
			transparent,
			color-mix(in srgb, #e7d09a 80%, #fff),
			transparent
		);
	}
	.rite-line-text {
		margin: 0 auto;
		max-width: 26rem;
		padding: 0 1rem;
		font-size: clamp(0.86rem, 2.4vw, 1.05rem);
		line-height: 1.8;
		color: color-mix(in srgb, #f3e6c4 92%, #000);
	}
	.rite-hint {
		margin: 1.2rem 0 0;
		font-size: 0.66rem;
		letter-spacing: 0.1em;
		color: rgb(255 244 212 / 0.55);
	}
	.rite-particles {
		position: absolute;
		inset: 0;
		overflow: hidden;
		pointer-events: none;
	}
	.rite-particles span {
		position: absolute;
		left: 50%;
		top: 50%;
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: #ffe6a0;
		box-shadow: 0 0 8px rgb(255 230 160 / 0.9);
		opacity: 0;
		animation: rite-spark 2000ms ease-out forwards;
		animation-delay: calc(var(--i) * 60ms);
		transform: rotate(calc(var(--i) * 25.7deg)) translateY(0);
	}
	@keyframes rite-spark {
		0% {
			opacity: 0;
			transform: rotate(calc(var(--i) * 25.7deg)) translateY(0) scale(0.4);
		}
		20% {
			opacity: 1;
		}
		100% {
			opacity: 0;
			transform: rotate(calc(var(--i) * 25.7deg)) translateY(-180px)
				scale(1);
		}
	}
</style>
