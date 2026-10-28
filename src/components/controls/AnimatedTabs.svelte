<script lang="ts">
/**
 * 骷髅开关组件 - 用于切换列表/网格布局
 */
interface Props {
	activeTab: "list" | "grid";
	class?: string;
}

let { activeTab = $bindable("list"), class: className = "" }: Props = $props();

let checkboxRef = $state<HTMLInputElement | null>(null);

function syncCheckbox() {
	if (checkboxRef) {
		checkboxRef.checked = activeTab === "grid";
	}
}

function handleChange() {
	const newLayout = checkboxRef?.checked ? "grid" : "list";
	activeTab = newLayout;
	localStorage.setItem("postListLayout", newLayout);
	window.dispatchEvent(
		new CustomEvent("layoutChange", { detail: { layout: newLayout } }),
	);
}

function initFromStorage() {
	const saved = localStorage.getItem("postListLayout");
	if (saved === "list" || saved === "grid") {
		activeTab = saved;
	}
	syncCheckbox();
}

$effect(() => {
	initFromStorage();
	if (typeof document === "undefined") return;
	document.addEventListener("astro:page-load", initFromStorage);
	return () => {
		document.removeEventListener("astro:page-load", initFromStorage);
	};
});
</script>

<label class="skull-switch {className}" aria-label="切换文章卡片/列表视图" title="切换文章卡片/列表视图">
	<input
		bind:this={checkboxRef}
		type="checkbox"
		checked={activeTab === "grid"}
		onchange={handleChange}
	/>
	<span class="thumb">
		<span class="cranium"></span>
		<span class="mouth"></span>
	</span>
	<span class="arm-wrapper">
		<span class="arm">
			<span class="bone"></span>
			<span class="bone"></span>
			<span class="hand">
				<span class="bone"></span>
				<span class="bone"></span>
				<span class="bone"></span>
				<span class="bone"></span>
			</span>
			<span class="big"></span>
		</span>
	</span>
</label>

<style>
.skull-switch {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 5rem;
    height: 2.5rem;
    background: #141414;
    border-radius: 1.25rem;
    overflow: hidden;
    box-shadow: 0 0 0.1rem 0.1rem #000000, 0 0 0.5rem 0.1rem #0b0b10 inset;
    cursor: pointer;
    flex-shrink: 0;
}

.skull-switch input { display: none; }

.thumb {
    position: absolute;
    width: 2.1875rem;
    height: 2.1875rem;
    top: 0.15625rem;
    left: calc(100% - 2.33331rem);
    border-radius: 1.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1;
    animation: move-skull-left 0.5s ease-in-out 0.5s forwards;
}

.skull-switch input:checked ~ .thumb {
    left: 0.15625rem;
    animation: move-skull-right 0.5s ease-in-out 0.5s forwards;
}

@keyframes move-skull-right {
    0% { left: 0.15625rem; }
    100% { left: calc(100% - 2.33331rem); }
}

@keyframes move-skull-left {
    0% { left: calc(100% - 2.33331rem); }
    100% { left: 0.15625rem; }
}

.thumb > * {
    position: absolute;
    filter: drop-shadow(0px 1px 1px #000);
    animation: unselected 1.5s ease-in-out 0s reverse forwards;
}

.skull-switch input:checked ~ .thumb * {
    animation: selected 1.5s ease-in-out 0s forwards;
}

@keyframes selected {
    0%, 50% { filter: drop-shadow(0px 1px 1px #000) brightness(1); }
    50.01%, 100% { filter: drop-shadow(0px 1px 1px #000) brightness(1.875); }
}

@keyframes unselected {
    0%, 50% { filter: drop-shadow(0px 1px 1px #000) brightness(1); }
    50.01%, 100% { filter: drop-shadow(0px 1px 1px #000) brightness(1.875); }
}

.cranium {
    background: linear-gradient(180deg, #888 0 54%, transparent 0 94%, #888 0 100%),
        radial-gradient(circle at 75% 69%, transparent 0 0.21875rem, #888 calc(0.21875rem + 1px) 0.6058rem, transparent calc(0.6058rem + 1px) 100%),
        radial-gradient(circle at 25% 69%, transparent 0 0.21875rem, #888 calc(0.21875rem + 1px) 0.6058rem, transparent calc(0.6058rem + 1px) 100%);
    width: 100%;
    height: 1.75rem;
    left: 0;
    top: 0;
    border-radius: 1.25rem 1.25rem 0.6875rem 0.6875rem;
}

.cranium:before {
    content: "";
    position: absolute;
    width: 0.15625rem;
    height: 0.15625rem;
    bottom: -0.09375rem;
    left: 0.9375rem;
    background: #888;
    border-radius: 100%;
    box-shadow: 0.15625rem 0 0 0 #888;
}

.cranium:after {
    content: "";
    position: absolute;
    width: 0.65625rem;
    height: 0.1875rem;
    bottom: -0.11875rem;
    left: 0.75rem;
    background: radial-gradient(circle at 90% 10%, #888 0 0.125rem, transparent calc(0.125rem + 1px) 100%),
        radial-gradient(circle at 10% 10%, #888 0 0.125rem, transparent calc(0.125rem + 1px) 100%);
    border-radius: 0.125rem;
}

.mouth {
    border: 0.10625rem solid transparent;
    border-bottom-color: #888;
    width: 1.46875rem;
    left: 0.35625rem;
    height: 0.75rem;
    top: 1.40625rem;
    background: radial-gradient(circle at 35% 98%, #888 0 0.08125rem, transparent calc(0.08125rem + 1px) 100%),
        radial-gradient(circle at 45% 100%, #888 0 0.08125rem, transparent calc(0.08125rem + 1px) 100%),
        radial-gradient(circle at 55% 100%, #888 0 0.08125rem, transparent calc(0.08125rem + 1px) 100%),
        radial-gradient(circle at 65% 98%, #888 0 0.08125rem, transparent calc(0.08125rem + 1px) 100%);
    background-repeat: no-repeat;
    border-radius: 100%;
}

.mouth:before, .mouth:after {
    content: "";
    position: absolute;
    border-radius: 100%;
    background: #888;
    width: 0.0875rem;
    height: 0.0875rem;
    left: 0.05rem;
    bottom: 0.03125rem;
}
.mouth:after { left: 1.130625rem; }

@keyframes check-on {
    0% { right: -65%; }
    25%, 33% { right: 0%; }
    66%, 80% { right: -50%; }
    100% { right: -65%; }
}

@keyframes check-off {
    0% { right: -65%; }
    25%, 33% { right: 0%; }
    66%, 80% { right: -50%; }
    100% { right: -65%; }
}

.arm-wrapper {
    position: absolute;
    width: 100%;
    height: 100%;
    border-radius: 1.25rem;
    overflow: hidden;
    right: -65%;
    animation: check-off 1.5s ease-in-out 0s reverse forwards;
}

.skull-switch input:checked ~ .arm-wrapper {
    animation: check-on 1.5s ease-in-out 0s forwards;
}

.arm {
    position: absolute;
    width: 2rem;
    height: 0.625rem;
    right: 2%;
    top: calc(50% - 0.3125rem);
    border-radius: 0.03125rem;
}

.bone {
    background: #fff;
    width: 1rem;
    height: 0.25rem;
    position: absolute;
    transform: rotate(0deg);
    top: 0.1875rem;
    right: -0.5rem;
}

.bone:before, .bone:after, .big:before, .big:after {
    content: "";
    background: #fff;
    width: 0.1875rem;
    height: 0.1875rem;
    position: absolute;
    left: -0.0625rem;
    top: -0.0625rem;
    border-radius: 100%;
    box-shadow: 1rem 0 0 0 #fff;
}

.bone:after { top: calc(100% - 0.125rem); }

.arm > .bone + .bone {
    top: 0.1875rem;
    left: 0.0625rem;
    height: 0.10625rem;
    width: 1.3125rem;
    box-shadow: 0 0.14375rem 0 0 #fff;
}
.arm > .bone + .bone:before, .arm > .bone + .bone:after {
    box-shadow: 1.26875rem 0 0 0 #fff;
}
.arm > .bone + .bone:after { top: 100%; }

.hand {
    position: absolute;
    background: radial-gradient(circle at 91% 29%, #fff 0.0625rem, transparent calc(0.0625rem + 1px) 100%),
        radial-gradient(circle at 92% 49%, #fff 0.0625rem, transparent calc(0.0625rem + 1px) 100%),
        radial-gradient(circle at 91% 69%, #fff 0.0625rem, transparent calc(0.0625rem + 1px) 100%),
        radial-gradient(circle at 76% 21%, #fff 0.0625rem, transparent calc(0.0625rem + 1px) 100%),
        radial-gradient(circle at 78% 39%, #fff 0.0625rem, transparent calc(0.0625rem + 1px) 100%),
        radial-gradient(circle at 79% 58%, #fff 0.0625rem, transparent calc(0.0625rem + 1px) 100%),
        radial-gradient(circle at 78% 78%, #fff 0.0625rem, transparent calc(0.0625rem + 1px) 100%);
    width: 0.875rem;
    height: 0.625rem;
    left: -0.875rem;
    z-index: 0;
}

.hand .bone, .big {
    width: 0.375rem;
    left: 0.16875rem;
    height: 0.09375rem;
    border-radius: 0.0625rem 0 0 0.0625rem;
}

.hand .bone:before, .hand .bone:after, .big:before, .big:after {
    width: 0.1rem;
    height: 0.1rem;
    top: -0.03125rem;
    left: 0.28125rem;
    box-shadow: none;
}
.hand .bone:after, .big:after { top: 0.015625rem; }

.hand .bone:nth-child(1) { transform: rotate(5deg) translateY(-0.125rem) translateX(0.01875rem); filter: drop-shadow(-0.375rem 0 0px #fff); }
.hand .bone:nth-child(2) { transform: rotate(0deg) translateX(0.0625rem); filter: drop-shadow(-0.375rem 0 0px #fff); }
.hand .bone:nth-child(3) { transform: rotate(-2deg) translateY(0.14375rem) translateX(0.0625rem); filter: drop-shadow(-0.375rem 0 0px #fff); }
.hand .bone:nth-child(4) { transform: rotate(-5deg) translateY(0.2875rem) translateX(0.0625rem); filter: drop-shadow(-0.375rem 0 0px #fff); }

.big {
    background: #fff;
    height: 0.125rem !important;
    position: absolute;
    left: -0.53125rem !important;
    top: 0.14375rem;
    z-index: 1;
    filter: drop-shadow(-0.3125rem 0 0px #fff) drop-shadow(0 0 1px #000);
}
</style>
