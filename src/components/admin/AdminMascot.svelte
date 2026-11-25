<script lang="ts">
/**
 * 后台原创看板娘：星娘「小曜」
 *
 * 纯 SVG，不引外部图片或第三方角色。配色全部读 --admin-* 令牌，
 * 与深空主题同源。鼠标移动时只改 CSS 自定义属性，不触发 Svelte 重渲染；
 * reduced-motion 下不注册监听，静态展示。
 */
import { onMount } from "svelte";

let root = $state<HTMLDivElement>();

onMount(() => {
	const el = root;
	if (!el) return;
	if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

	function move(event: MouseEvent): void {
		const rect = el.getBoundingClientRect();
		const dx = (event.clientX - rect.left) / rect.width - 0.5;
		const dy = (event.clientY - rect.top) / rect.height - 0.5;
		el.style.setProperty("--mx", `${(dx * 14).toFixed(1)}px`);
		el.style.setProperty("--my", `${(dy * 10).toFixed(1)}px`);
	}

	window.addEventListener("mousemove", move, { passive: true });
	return () => window.removeEventListener("mousemove", move);
});
</script>

<div class="admin-mascot" bind:this={root} aria-hidden="true">
	<svg class="admin-mascot__svg" viewBox="0 0 200 200">
		<defs>
			<path
				id="admin-mascot-star"
				d="M0 -9 L2 -2.8 L8.6 -2.8 L3.3 1 L5.3 7.3 L0 3.4 L-5.3 7.3 L-3.3 1 L-8.6 -2.8 L-2 -2.8 Z"
			/>
		</defs>

		<circle
			class="admin-mascot__orbit"
			cx="100"
			cy="100"
			r="76"
			fill="none"
			stroke="var(--admin-violet)"
			stroke-width="1"
			stroke-dasharray="3 12"
			opacity="0.4"
		/>
		<circle cx="100" cy="96" r="50" fill="var(--admin-halo)" />
		<use
			class="admin-mascot__spark"
			href="#admin-mascot-star"
			x="38"
			y="56"
			fill="var(--admin-gold)"
		/>
		<use
			class="admin-mascot__spark admin-mascot__spark--late"
			href="#admin-mascot-star"
			x="164"
			y="84"
			fill="var(--admin-cyan)"
		/>
		<use
			class="admin-mascot__spark admin-mascot__spark--early"
			href="#admin-mascot-star"
			x="148"
			y="152"
			fill="var(--admin-violet)"
		/>

		<path
			d="M72 72 Q48 84 54 116 Q60 100 76 96Z"
			fill="var(--admin-mascot-hair-light)"
		/>
		<path
			d="M128 72 Q152 84 146 116 Q140 100 124 96Z"
			fill="var(--admin-mascot-hair-light)"
		/>
		<path
			d="M84 116 Q100 108 116 116 L128 150 Q100 158 72 150Z"
			fill="var(--admin-mascot-dress)"
			stroke="var(--admin-violet)"
			stroke-width="0.8"
		/>
		<circle
			cx="100"
			cy="80"
			r="33"
			fill="var(--admin-mascot-skin)"
			stroke="var(--admin-violet)"
			stroke-width="0.8"
		/>
		<path
			d="M68 76 Q64 44 100 43 Q136 44 132 76 Q126 60 114 57 Q100 70 86 57 Q74 60 68 76Z"
			fill="var(--admin-mascot-hair)"
		/>
		<ellipse
			class="admin-mascot__eye"
			cx="89"
			cy="83"
			rx="3.2"
			ry="5"
			fill="var(--admin-mascot-ink)"
		/>
		<ellipse
			class="admin-mascot__eye"
			cx="111"
			cy="83"
			rx="3.2"
			ry="5"
			fill="var(--admin-mascot-ink)"
		/>
		<ellipse cx="80" cy="92" rx="5" ry="2.4" fill="var(--admin-mascot-blush)" />
		<ellipse cx="120" cy="92" rx="5" ry="2.4" fill="var(--admin-mascot-blush)" />
		<path
			d="M96 96 Q100 100 104 96"
			fill="none"
			stroke="var(--admin-mascot-ink)"
			stroke-width="1.5"
			stroke-linecap="round"
		/>
		<use href="#admin-mascot-star" x="126" y="54" fill="var(--admin-gold)" />
	</svg>
</div>
