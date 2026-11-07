<script lang="ts">
/**
 * Tab 呼出轮盘（2026-11-07 从旧博客 old-Jojo-blog/src/components/tab-radial-menu.tsx 移植）
 *
 * 交互：按住 Tab → 鼠标处弹出径向菜单 → 移动鼠标吸附最近项 → 松开 Tab 跳转 / Esc 取消。
 *
 * 与旧站的实现差异（均为适配本站，不是功能削减）：
 * 1. React + motion/react → Svelte 5 runes + 纯 CSS 过渡（本站没有 motion，多引一个动画库不值当）；
 * 2. lucide-react → lucide-svelte（Svelte 里不能用 astro-icon 的图标名）；
 * 3. 半径按视口自适应（旧站固定 140px，小窗口里按钮会顶出屏幕）；
 * 4. Shift+Tab 放行、可编辑元素内放行（见 tabRadialMenuConfig.ignoreEditable）——
 *    旧站一律 preventDefault，连搜索框里都没法用 Tab 换字段；
 * 5. 只在「有精确指针」的设备上启用（手机没有 Tab 键，也没有 mousemove）。
 *
 * ⚠️ 组件挂在 Layout.astro 的 body 上（#swup-container 之外），跨导航不重建；
 * 当前页高亮靠监听 astro:page-load 重新读 pathname（CLAUDE.md §11.4）。
 */

import { navigateToPage } from "@utils/navigation-utils";
import { url as withBaseUrl } from "@utils/url-utils";
import {
	BookOpen,
	Camera,
	FolderGit2,
	GraduationCap,
	House,
	Library,
	MessagesSquare,
	Music,
	Network,
	NotebookPen,
	Sparkles,
	User,
} from "lucide-svelte";
import { onMount } from "svelte";
import { tabRadialMenuConfig } from "@/config";

/** 配置里的 icon 键 → lucide 组件。加新图标只改这里 + 配置文件 */
const ICONS: Record<string, typeof House> = {
	home: House,
	posts: BookOpen,
	moments: NotebookPen,
	album: Camera,
	projects: FolderGit2,
	interview: GraduationCap,
	categories: Network,
	books: Library,
	skills: Sparkles,
	music: Music,
	guestbook: MessagesSquare,
	about: User,
};

const BTN = 64; // 方块按钮尺寸，和样式里的 .trm__tile 保持一致
// 菜单项中心到轮盘圆心的距离。⚠️ 不能照搬旧站的 140：
// 12 项时弧长只有 73px，而按钮就 64px，标签会跟相邻按钮叠在一起（实测截图确认过）。
// 176 时弧长约 92px，按钮之间留出约 28px 空隙，4 字标签也放得下。
const BASE_RADIUS = 176;
const CENTER_DEAD = 30; // 圆心 30px 内不选中，留给中心玻璃圆
const HINT_GAP = 40; // 提示文字距最外侧按钮的垂直距离

const items = tabRadialMenuConfig.items.map((item) => ({
	...item,
	href: withBaseUrl(item.href),
}));

let open = $state(false);
let centerX = $state(0);
let centerY = $state(0);
let radius = $state(BASE_RADIUS);
let active = $state(-1);
let pathname = $state("");

const enabled = tabRadialMenuConfig.enable && items.length > 0;

/** 找离鼠标坐标最近的菜单项下标；鼠标位于中心圆区域内时返回 -1 */
function pickIndex(mx: number, my: number): number {
	if (Math.hypot(mx - centerX, my - centerY) < CENTER_DEAD) return -1;

	let closest = -1;
	let minDist = Number.POSITIVE_INFINITY;
	for (let i = 0; i < items.length; i++) {
		const angle = (i / items.length) * Math.PI * 2 - Math.PI / 2;
		const ix = centerX + Math.cos(angle) * radius;
		const iy = centerY + Math.sin(angle) * radius;
		const d = Math.hypot(mx - ix, my - iy);
		if (d < minDist) {
			minDist = d;
			closest = i;
		}
	}
	return closest;
}

/**
 * 把轮盘中心限制在视口内，避免鼠标靠近屏幕边缘时按钮 / 标签被裁切。
 * 半径也跟着小视口收缩；实在放不下（窗口极窄）就直接居中。
 */
function resolveGeometry(mx: number, my: number) {
	const vw = window.innerWidth;
	const vh = window.innerHeight;
	const r = Math.min(BASE_RADIUS, Math.max(96, Math.min(vw, vh) / 2 - 88));
	const padX = r + 56;
	const padY = r + 76;
	if (vw < padX * 2 || vh < padY * 2) {
		return { x: vw / 2, y: vh / 2, r };
	}
	return {
		x: Math.min(Math.max(mx, padX), vw - padX),
		y: Math.min(Math.max(my, padY), vh - padY),
		r,
	};
}

/** 焦点是否在输入控件内（这类地方要让 Tab 保持原生「下一个字段」行为） */
function isEditableElement(el: Element | null): boolean {
	if (!el) return false;
	const tag = el.tagName;
	if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
	return (el as HTMLElement).isContentEditable === true;
}

function close() {
	open = false;
	active = -1;
}

function goTo(index: number) {
	const item = items[index];
	if (!item) return;
	close();
	if (item.href === pathname) {
		return;
	}
	navigateToPage(item.href);
}

/** 当前页判定：首页只匹配根路径，其余按前缀（与 navbar-active-motion.ts 同规则） */
function isCurrent(href: string): boolean {
	if (!pathname) return false;
	if (href === withBaseUrl("/")) return pathname === href;
	return pathname === href || pathname.startsWith(href);
}

onMount(() => {
	if (!enabled) return;

	// 手机 / 无精确指针设备不启用：没有 Tab 键，也没有 mousemove
	const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
	let pointerOk = finePointer.matches;
	const onPointerModeChange = (e: MediaQueryListEvent) => {
		pointerOk = e.matches;
	};

	const mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
	pathname = window.location.pathname;

	const onMouseMove = (e: MouseEvent) => {
		mouse.x = e.clientX;
		mouse.y = e.clientY;
		// 轮盘打开期间：鼠标移动 → 实时吸附到最近的图标
		if (open) active = pickIndex(e.clientX, e.clientY);
	};

	const onKeyDown = (e: KeyboardEvent) => {
		if (e.key === "Escape") {
			if (!open) return;
			e.preventDefault();
			close();
			return;
		}
		if (e.key !== "Tab") return;
		if (!pointerOk) return;
		// Shift+Tab（反向切换焦点）与带修饰键的组合一律放行，抢过来只会让用户莫名跳页
		if (e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) return;
		// 按住 Tab 不松会连续触发 keydown（e.repeat），轮盘已开也不重复呼出
		if (e.repeat) return;
		// 输入控件里保留原生 Tab 行为（否则搜索框 / 评论框无法切换字段）
		if (
			!open &&
			tabRadialMenuConfig.ignoreEditable &&
			isEditableElement(document.activeElement)
		) {
			return;
		}

		e.preventDefault(); // 其余情况一律阻止浏览器默认的焦点切换
		if (open) return;

		(document.activeElement as HTMLElement | null)?.blur?.();
		const geo = resolveGeometry(mouse.x, mouse.y);
		centerX = geo.x;
		centerY = geo.y;
		radius = geo.r;
		active = -1;
		open = true;
	};

	const onKeyUp = (e: KeyboardEvent) => {
		if (e.key !== "Tab" || !open) return;
		e.preventDefault();
		// 松开 Tab：有选中项就跳转，什么都没选中则收起
		if (active >= 0) goTo(active);
		else close();
	};

	const onPageLoad = () => {
		pathname = window.location.pathname;
		close(); // 换页后残留的打开态要收掉
	};

	const onResize = () => {
		if (!open) return;
		const geo = resolveGeometry(mouse.x, mouse.y);
		centerX = geo.x;
		centerY = geo.y;
		radius = geo.r;
	};

	// capture 阶段拦截，保证输入框等元素抢不走 Tab
	window.addEventListener("mousemove", onMouseMove, { passive: true });
	window.addEventListener("keydown", onKeyDown, { capture: true });
	window.addEventListener("keyup", onKeyUp, { capture: true });
	window.addEventListener("resize", onResize, { passive: true });
	window.addEventListener("blur", close);
	document.addEventListener("astro:page-load", onPageLoad);
	finePointer.addEventListener("change", onPointerModeChange);

	return () => {
		window.removeEventListener("mousemove", onMouseMove);
		window.removeEventListener("keydown", onKeyDown, { capture: true });
		window.removeEventListener("keyup", onKeyUp, { capture: true });
		window.removeEventListener("resize", onResize);
		window.removeEventListener("blur", close);
		document.removeEventListener("astro:page-load", onPageLoad);
		finePointer.removeEventListener("change", onPointerModeChange);
	};
});
</script>

{#if enabled}
	<div
		class="trm"
		class:is-open={open}
		style="--trm-last:{items.length - 1}"
		aria-hidden={!open}
	>
		<div class="trm__scrim"></div>

		<!-- 中心玻璃圆：视觉锚点，也是「圆心不选中」的提示 -->
		<div class="trm__core" style="--x:{centerX}px;--y:{centerY}px"></div>

		{#each items as item, i}
			{@const Icon = ICONS[item.icon] ?? House}
			{@const angle = (i / items.length) * Math.PI * 2 - Math.PI / 2}
			{@const x = centerX + Math.cos(angle) * radius}
			{@const y = centerY + Math.sin(angle) * radius}
			<button
				type="button"
				tabindex="-1"
				class="trm__item"
				class:is-active={active === i}
				class:is-current={isCurrent(item.href)}
				style="--from-x:{centerX - BTN / 2}px;--from-y:{centerY - BTN / 2}px;--to-x:{x - BTN / 2}px;--to-y:{y - BTN / 2}px;--i:{i}"
				onclick={() => goTo(i)}
			>
				<span class="trm__tile"><Icon size={24} strokeWidth={1.8} /></span>
				<span class="trm__label">{item.label}</span>
			</button>
		{/each}

		<p class="trm__hint" style="--x:{centerX}px;--y:{centerY + radius + HINT_GAP}px">
			松开 Tab 跳转 · ESC 取消
		</p>
	</div>
{/if}

<style>
	.trm {
		position: fixed;
		inset: 0;
		/* 压在所有层级令牌之上（--z-toast 是 1080） */
		z-index: 1100;
		pointer-events: none;
		visibility: hidden;
		opacity: 0;
		/* 退出时先把 opacity 过渡完再隐藏，避免退场动画被截断 */
		transition: opacity 0.15s ease, visibility 0s linear 0.15s;

		/* 底下那层 scrim 恒为黑色半透明，所以压在上面的文字 / 玻璃一律用浅色，
		   不跟主题走（暗色主题下 --deep-text 会变白，套上去等于看不见） */
		--trm-ghost: rgb(255 255 255 / 0.94);
		--trm-ghost-dim: rgb(255 255 255 / 0.72);
	}

	.trm.is-open {
		visibility: visible;
		opacity: 1;
		transition: opacity 0.15s ease, visibility 0s;
	}

	.trm__scrim {
		position: absolute;
		inset: 0;
		/* 0.5 而不是旧站的 0.30：本站很多页面铺了花哨的背景图 / 画布，
		   0.30 压不住，12 个按钮会跟背景糊在一起。再补一层轻微模糊把背景推远 */
		background: rgb(0 0 0 / 0.5);
		backdrop-filter: blur(2px);
	}

	/* ── 中心玻璃圆 ── */
	.trm__core {
		position: absolute;
		left: var(--x);
		top: var(--y);
		width: 60px;
		height: 60px;
		margin: -30px 0 0 -30px;
		border: 1px solid rgb(255 255 255 / 0.42);
		border-radius: 50%;
		background: rgb(255 255 255 / 0.22);
		backdrop-filter: blur(6px);
		transform: scale(0.5);
		transition: transform 0.3s cubic-bezier(0.2, 0.9, 0.25, 1.1);
	}

	.trm.is-open .trm__core {
		transform: scale(1);
	}

	/* ── 径向按钮：从圆心爆开，顺时针依次弹出 ── */
	.trm__item {
		position: absolute;
		left: 0;
		top: 0;
		width: 64px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		padding: 0;
		border: 0;
		background: none;
		color: inherit;
		cursor: pointer;
		opacity: 0;
		transform: translate(var(--from-x), var(--from-y)) scale(0.35);
		transition: transform 0.36s cubic-bezier(0.16, 0.84, 0.28, 1.06), opacity 0.2s ease;
		transition-delay: calc(var(--i) * 16ms);
		will-change: transform;
	}

	.trm.is-open .trm__item {
		opacity: 1;
		transform: translate(var(--to-x), var(--to-y)) scale(1);
	}

	/* 关闭时按相反顺序收拢 */
	.trm:not(.is-open) .trm__item {
		transition-delay: calc((var(--trm-last) - var(--i)) * 8ms);
	}

	.trm.is-open .trm__item {
		pointer-events: auto;
	}

	.trm__tile {
		display: flex;
		width: 64px;
		height: 64px;
		align-items: center;
		justify-content: center;
		border: 1px solid var(--border);
		border-radius: 1rem;
		background: var(--page-bg);
		color: var(--deep-text);
		box-shadow: 0 6px 18px rgb(0 0 0 / 0.18);
		transition: transform 0.12s ease, background-color 0.12s ease, color 0.12s ease,
			border-color 0.12s ease;
	}

	/* 当前页：只加一道深描边，不抢「选中项」的视觉权重 */
	.trm__item.is-current .trm__tile {
		border-color: var(--deep-text);
	}

	/* 暗色下 --page-bg 只有 oklch(0.08)，和压暗后的背景几乎同色，
	   提到 --btn-card-bg-active（暗色 = 0.20）才分得出来 */
	:global(:root.dark) .trm__tile {
		background: var(--btn-card-bg-active);
	}

	/* 选中项：反色高亮块，与导航栏的当前项同一套语言 */
	.trm__item.is-active .trm__tile {
		border-color: transparent;
		background: var(--navbar-highlight-bg);
		color: var(--navbar-highlight-text);
		box-shadow: 0 12px 30px rgb(0 0 0 / 0.35);
		transform: scale(1.12);
	}

	.trm__label {
		white-space: nowrap;
		font-size: 0.75rem;
		font-weight: 500;
		line-height: 1.2;
		color: var(--trm-ghost-dim);
		/* 标签落在遮罩上、背后可能是任何背景图，不加阴影在浅色壁纸上会糊掉 */
		text-shadow: 0 1px 4px rgb(0 0 0 / 0.6);
		transition: color 0.12s ease, transform 0.12s ease;
	}

	.trm__item.is-current .trm__label,
	.trm__item.is-active .trm__label {
		color: var(--trm-ghost);
	}

	.trm__item.is-active .trm__label {
		transform: scale(1.08);
	}

	.trm__hint {
		position: absolute;
		left: var(--x);
		top: var(--y);
		margin: 0;
		transform: translateX(-50%);
		white-space: nowrap;
		font-size: 0.75rem;
		color: var(--trm-ghost-dim);
		text-shadow: 0 1px 4px rgb(0 0 0 / 0.6);
		opacity: 0;
		transition: opacity 0.2s ease 0.1s;
	}

	.trm.is-open .trm__hint {
		opacity: 1;
	}

	/* 触屏 / 无精确指针：不渲染交互（JS 侧也不绑键盘，这里只是兜底） */
	@media (hover: none) {
		.trm {
			display: none;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.trm,
		.trm__core,
		.trm__item,
		.trm__tile,
		.trm__label,
		.trm__hint {
			transition: none;
		}

		.trm__item {
			transform: translate(var(--to-x), var(--to-y)) scale(1);
		}
	}
</style>
