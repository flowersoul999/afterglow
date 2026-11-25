<script lang="ts">
/**
 * 后台星尘背景
 *
 * 单层 canvas，粒子数按视口面积算（24~72），rAF 驱动缓慢上浮；
 * 粒子颜色读 --admin-star，和深空主题共用一套令牌，不在 JS 里写死颜色。
 * prefers-reduced-motion 下只画一帧静态星空，不启动画。
 * ResizeObserver + cancelAnimationFrame 在卸载时全部清掉，避免后台整页进出时泄漏。
 */
import { onMount } from "svelte";

interface Props {
	/** 主题变了就重读 --admin-star，粒子颜色跟着换 */
	theme: "day" | "night";
}
let { theme }: Props = $props();

let canvas = $state<HTMLCanvasElement>();
let color = $state("oklch(0.55 0.12 285 / 0.42)");

onMount(() => {
	const el = canvas;
	if (!el) return;
	const ctx = el.getContext("2d");
	if (!ctx) return;

	const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

	type Star = {
		x: number;
		y: number;
		radius: number;
		speed: number;
		alpha: number;
		twinkle: number;
	};

	let stars: Star[] = [];
	let width = 0;
	let height = 0;
	let frameId = 0;
	let phase = 0;

	function draw(): void {
		ctx.clearRect(0, 0, width, height);
		ctx.fillStyle = color;
		for (const star of stars) {
			const flicker =
				0.78 + Math.sin(phase * star.twinkle * 60 + star.x) * 0.22;
			ctx.globalAlpha = star.alpha * flicker;
			ctx.beginPath();
			ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
			ctx.fill();
		}
		ctx.globalAlpha = 1;
	}

	function resize(): void {
		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		width = el.clientWidth;
		height = el.clientHeight;
		el.width = Math.round(width * dpr);
		el.height = Math.round(height * dpr);
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

		const count = Math.min(
			72,
			Math.max(24, Math.round((width * height) / 18000)),
		);
		stars = Array.from({ length: count }, () => ({
			x: Math.random() * width,
			y: Math.random() * height,
			radius: Math.random() * 1.15 + 0.35,
			speed: Math.random() * 0.13 + 0.035,
			alpha: Math.random() * 0.42 + 0.2,
			twinkle: Math.random() * 0.018 + 0.005,
		}));
		draw();
	}

	function frame(): void {
		phase += 1;
		for (const star of stars) {
			star.y -= star.speed;
			if (star.y < -2) {
				star.y = height + 2;
				star.x = Math.random() * width;
			}
		}
		draw();
		frameId = requestAnimationFrame(frame);
	}

	resize();
	const observer = new ResizeObserver(resize);
	observer.observe(el);
	if (!reduced) frameId = requestAnimationFrame(frame);

	return () => {
		cancelAnimationFrame(frameId);
		observer.disconnect();
	};
});

$effect(() => {
	theme;
	const value = getComputedStyle(canvas)
		.getPropertyValue("--admin-star")
		.trim();
	if (value) color = value;
});
</script>

<canvas bind:this={canvas} class="admin-starfield" aria-hidden="true"></canvas>
