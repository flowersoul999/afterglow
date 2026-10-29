/**
 * 导航栏「当前页」动效：滑动高亮块 + 浮动图标层（FLIP）。
 *
 * 两个动作都只在「激活项变了」时发生，所以逻辑绑在一起：
 *   1. 高亮块 `.navbar-hover-highlight` 靠 left / width 过渡滑到目标项；
 *   2. 图标不由按钮自己画，而是交给独立浮动层 `.navbar-moving-icon` ——
 *      量出「上一项图标坑位」与「当前项图标坑位」的差值，用 WAAPI 从一个位置
 *      平移到另一个，旧图形淡出、新图形淡入。于是切页时图标会「飞」过去，
 *      而不是原地瞬间换个字。
 *
 * 为什么图标要从按钮里摘出来：图标若跟着文字一起重排，切页时只能硬切；
 * 摘成浮动层后才有位移与交叉淡换的空间，同时按钮宽度也不会因为图标进出而抖。
 *
 * ⚠️ 导航栏在 Swup 容器之外、跨导航常驻，本模块**只初始化一次**（`initialized`
 * guard），换页后由 `swup:content:replaced` 触发 `refreshActiveItem(true)`。
 * 事件派发目标是 window，监听必须挂 window（见 CLAUDE.md §11.4）。
 */

import {
	repositionNavbarDropdown,
	syncNavbarDropdownOnHover,
} from "@/utils/navbar-dropdown-controller";

/** 图标飞过去的时长。参考站 260ms + 这条曲线，起手快、收尾软 */
const NAVBAR_ICON_DURATION = 260;
const NAVBAR_ICON_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";

let abortController: AbortController | null = null;
let navContainer: HTMLElement | null = null;
let hoverBorder: HTMLElement | null = null;
let activeItem: HTMLElement | null = null;

let iconAnimations: Animation[] = [];
let iconAnimationRevision = 0;
let iconResizeObserver: ResizeObserver | null = null;
let iconResizeFrame: number | null = null;

let initialized = false;

/* ───────────────────────── 路径匹配 ───────────────────────── */

/** 去掉尾部斜杠，根路径保留为 "/" */
function normalizePath(p: string): string {
	return p.replace(/\/$/, "") || "/";
}

/** 当前路径是否落在某个 href 之下（含自身） */
function pathMatches(currentPath: string, href: string): boolean {
	const cp = normalizePath(currentPath);
	const hp = normalizePath(href);
	if (hp === "/") return cp === "/";
	return cp === hp || cp.startsWith(`${hp}/`);
}

/**
 * 一个导航项可匹配的全部路径：自身 href、共享面板里本项对应的子菜单 href
 * （二级页面激活时一级也要选中）、以及配置声明的额外前缀。
 */
function getItemPaths(item: HTMLElement): string[] {
	const hrefs: string[] = [];
	const selfLink = item.querySelector(":scope > a") as HTMLAnchorElement | null;
	const selfHref = selfLink?.getAttribute("href");
	if (selfHref) hrefs.push(selfHref);

	const pageIndex = item.dataset.dropdownIndex;
	const page =
		pageIndex !== undefined
			? document.querySelector<HTMLElement>(
					`[data-navbar-dropdown-panel] [data-dropdown-page="${pageIndex}"]`,
				)
			: null;
	page
		?.querySelectorAll<HTMLAnchorElement>(".dropdown-item[href]")
		.forEach((el) => {
			const href = el.getAttribute("href");
			if (href) hrefs.push(href);
		});

	const prefixes =
		item.dataset.activePathPrefixes?.split(/\s+/).filter(Boolean) ?? [];
	return [...hrefs, ...prefixes];
}

/**
 * 按路径找出应激活的导航项。
 * 「最长命中优先」：进 /categories/技术分享/ 时只亮「文章」，不会再让
 * /categories/ 这一级的项一起亮（CLAUDE.md §5.7 明确要求，别退回 some()）。
 */
function findItemByPath(
	container: HTMLElement,
	path: string,
): HTMLElement | null {
	let best: HTMLElement | null = null;
	let bestLen = -1;
	container
		.querySelectorAll<HTMLElement>(":scope > .dropdown-container")
		.forEach((item) => {
			let matched = -1;
			for (const href of getItemPaths(item)) {
				if (!pathMatches(path, href)) continue;
				const len = normalizePath(href).length;
				if (len > matched) matched = len;
			}
			if (matched > bestLen) {
				bestLen = matched;
				best = item;
			}
		});
	return bestLen >= 0 ? best : null;
}

function navItems(): HTMLElement[] {
	if (!navContainer) return [];
	return Array.from(
		navContainer.querySelectorAll<HTMLElement>(":scope > .dropdown-container"),
	);
}

/* ───────────────────────── 高亮块 ───────────────────────── */

function moveHighlight(item: HTMLElement | null): void {
	if (!navContainer || !hoverBorder) return;
	if (!item) {
		hoverBorder.style.opacity = "0";
		return;
	}
	const rect = item.getBoundingClientRect();
	const containerRect = navContainer.getBoundingClientRect();
	hoverBorder.style.width = `${rect.width}px`;
	hoverBorder.style.height = `${rect.height}px`;
	hoverBorder.style.left = `${rect.left - containerRect.left}px`;
	hoverBorder.style.top = `${rect.top - containerRect.top}px`;
}

/* ───────────────────────── 浮动图标（FLIP） ───────────────────────── */

interface IconParts {
	layer: HTMLElement;
	current: HTMLElement;
	next: HTMLElement;
}

interface IconSnapshot {
	rect: DOMRect | null;
	markup: string;
}

function getIconParts(container: HTMLElement): IconParts | null {
	const layer = container.querySelector<HTMLElement>(
		"[data-navbar-moving-icon]",
	);
	const current = layer?.querySelector<HTMLElement>(
		"[data-navbar-icon-current]",
	);
	const next = layer?.querySelector<HTMLElement>("[data-navbar-icon-next]");
	if (!layer || !current || !next) return null;
	return { layer, current, next };
}

/** 每个导航项里那个「隐形的图标坑位」，图标本体由浮动层画 */
function getIconTemplate(item: HTMLElement | null): HTMLElement | null {
	return item?.querySelector<HTMLElement>(".navbar-trigger-icon") ?? null;
}

function getIconMarkup(item: HTMLElement | null): string {
	return getIconTemplate(item)?.innerHTML.trim() || "";
}

function hasRunningIconAnimation(): boolean {
	return iconAnimations.some((animation) => animation.playState === "running");
}

function cancelIconAnimations(): number {
	const revision = ++iconAnimationRevision;
	for (const animation of iconAnimations) animation.cancel();
	iconAnimations = [];
	return revision;
}

/**
 * 记下「此刻图标长什么样、在哪」，供下一次切换做 FLIP 的起点。
 * 若上一次动画还没播完，取目标态那层（不透明度更高的那层）的图形作为起点，
 * 否则连点两次导航会把半截图形当起点。
 */
function captureIconSnapshot(parts: IconParts): IconSnapshot {
	const currentOpacity =
		Number.parseFloat(getComputedStyle(parts.current).opacity) || 0;
	const nextOpacity =
		Number.parseFloat(getComputedStyle(parts.next).opacity) || 0;
	const markup =
		parts.next.innerHTML && nextOpacity > currentOpacity
			? parts.next.innerHTML
			: parts.current.innerHTML;
	const layerOpacity =
		Number.parseFloat(getComputedStyle(parts.layer).opacity) || 0;
	return {
		rect:
			markup && layerOpacity > 0.01
				? parts.layer.getBoundingClientRect()
				: null,
		markup,
	};
}

/** 把浮动层搬到某个图标坑位上，返回该坑位的矩形（空坑返回 null） */
function setIconBox(
	container: HTMLElement,
	layer: HTMLElement,
	template: HTMLElement,
): DOMRect | null {
	const navRect = container.getBoundingClientRect();
	const templateRect = template.getBoundingClientRect();
	if (templateRect.width === 0 || templateRect.height === 0) return null;

	layer.style.left = `${templateRect.left - navRect.left}px`;
	layer.style.top = `${templateRect.top - navRect.top}px`;
	layer.style.width = `${templateRect.width}px`;
	layer.style.height = `${templateRect.height}px`;
	return templateRect;
}

function hideIcon(parts: IconParts): void {
	cancelIconAnimations();
	parts.layer.style.opacity = "0";
	parts.layer.style.transform = "none";
	parts.current.style.opacity = "1";
	parts.next.style.opacity = "0";
	parts.current.innerHTML = "";
	parts.next.innerHTML = "";
}

function showIconImmediately(
	container: HTMLElement,
	parts: IconParts,
	template: HTMLElement,
	markup: string,
): void {
	cancelIconAnimations();
	if (!setIconBox(container, parts.layer, template)) {
		hideIcon(parts);
		return;
	}
	parts.layer.style.opacity = "1";
	parts.layer.style.transform = "none";
	parts.current.innerHTML = markup;
	parts.current.style.opacity = "1";
	parts.next.innerHTML = "";
	parts.next.style.opacity = "0";
}

function finishIconAnimations(
	revision: number,
	animations: Animation[],
	onFinish: () => void,
): void {
	void Promise.all(
		animations.map((animation) => animation.finished.catch(() => undefined)),
	).then(() => {
		if (revision !== iconAnimationRevision) return;
		onFinish();
		for (const animation of animations) animation.cancel();
		iconAnimations = [];
	});
}

/**
 * 把浮动图标从上一项移到下一项。
 *
 * 四种情况：
 *   - 还是同一项：只校正坑位（布局变了但要归位），不播动画；
 *   - 新项没有图标：旧图标淡出；
 *   - 首次出现（没有起点）：直接摆到目标坑位；
 *   - 有起点 + 有目标：位移 + 交叉淡换（真正的 FLIP）。
 */
function syncIcon(
	container: HTMLElement,
	previousItem: HTMLElement | null,
	nextItem: HTMLElement | null,
	snapshot: IconSnapshot,
	animate: boolean,
): void {
	const parts = getIconParts(container);
	if (!parts) return;

	const template = getIconTemplate(nextItem);
	const targetMarkup = getIconMarkup(nextItem);
	const reduceMotion = window.matchMedia(
		"(prefers-reduced-motion: reduce)",
	).matches;
	const canAnimate =
		animate && !reduceMotion && typeof parts.layer.animate === "function";

	if (previousItem === nextItem && nextItem) {
		if (!hasRunningIconAnimation() && template && targetMarkup) {
			showIconImmediately(container, parts, template, targetMarkup);
		}
		return;
	}

	// 新项没有图标：旧的那颗淡出后清空
	if (!template || !targetMarkup) {
		if (!canAnimate || !snapshot.rect || !snapshot.markup) {
			hideIcon(parts);
			return;
		}
		const revision = cancelIconAnimations();
		const navRect = container.getBoundingClientRect();
		parts.layer.style.left = `${snapshot.rect.left - navRect.left}px`;
		parts.layer.style.top = `${snapshot.rect.top - navRect.top}px`;
		parts.layer.style.width = `${snapshot.rect.width}px`;
		parts.layer.style.height = `${snapshot.rect.height}px`;
		parts.layer.style.opacity = "1";
		parts.layer.style.transform = "none";
		parts.current.innerHTML = snapshot.markup;
		parts.current.style.opacity = "1";
		parts.next.innerHTML = "";
		parts.next.style.opacity = "0";
		const fadeOut = parts.layer.animate([{ opacity: 1 }, { opacity: 0 }], {
			duration: 180,
			easing: "ease-out",
			fill: "both",
		});
		iconAnimations = [fadeOut];
		finishIconAnimations(revision, [fadeOut], () => {
			parts.layer.style.opacity = "0";
			parts.current.innerHTML = "";
		});
		return;
	}

	// 首次出现 / 减少动效：直接就位
	if (!canAnimate || !snapshot.rect || !snapshot.markup) {
		showIconImmediately(container, parts, template, targetMarkup);
		return;
	}

	const revision = cancelIconAnimations();
	const targetRect = setIconBox(container, parts.layer, template);
	if (!targetRect) {
		hideIcon(parts);
		return;
	}

	parts.layer.style.opacity = "1";
	parts.layer.style.transform = "none";
	parts.current.innerHTML = snapshot.markup;
	parts.current.style.opacity = "1";
	parts.next.innerHTML = targetMarkup;
	parts.next.style.opacity = "0";

	// 起点 = 当前（目标）坑位 + 反向位移量，从旧位置滑回 0
	const deltaX = snapshot.rect.left - targetRect.left;
	const deltaY = snapshot.rect.top - targetRect.top;
	const movement = parts.layer.animate(
		[
			{ transform: `translate3d(${deltaX}px, ${deltaY}px, 0)` },
			{ transform: "translate3d(0, 0, 0)" },
		],
		{
			duration: NAVBAR_ICON_DURATION,
			easing: NAVBAR_ICON_EASING,
			fill: "both",
		},
	);
	const outgoing = parts.current.animate([{ opacity: 1 }, { opacity: 0 }], {
		duration: NAVBAR_ICON_DURATION,
		easing: "ease-in-out",
		fill: "both",
	});
	const incoming = parts.next.animate([{ opacity: 0 }, { opacity: 1 }], {
		duration: NAVBAR_ICON_DURATION,
		easing: "ease-in-out",
		fill: "both",
	});
	const animations = [movement, outgoing, incoming];
	iconAnimations = animations;
	finishIconAnimations(revision, animations, () => {
		parts.layer.style.transform = "none";
		parts.current.innerHTML = targetMarkup;
		parts.current.style.opacity = "1";
		parts.next.innerHTML = "";
		parts.next.style.opacity = "0";
	});
}

/* ───────────────────────── 位置同步 ───────────────────────── */

/** 布局变了（字体加载、窗口缩放、侧栏开合）后把浮动图标挪回坑位，不播动画 */
function scheduleIconPositionSync(): void {
	if (iconResizeFrame !== null) return;
	iconResizeFrame = requestAnimationFrame(() => {
		iconResizeFrame = null;
		if (hasRunningIconAnimation()) return;
		if (!navContainer) return;
		const parts = getIconParts(navContainer);
		const template = getIconTemplate(activeItem);
		if (parts && template) setIconBox(navContainer, parts.layer, template);
		repositionNavbarDropdown();
	});
}

/* ───────────────────────── 对外接口 ───────────────────────── */

/**
 * 重新判定激活项并同步高亮块 / 图标。
 * `animate = true` 时图标带位移过渡（Swup 换页后调用），首次加载传 false。
 */
export function refreshActiveItem(animate = false): void {
	if (!navContainer) return;

	const next = findItemByPath(navContainer, window.location.pathname);
	const previous = activeItem?.isConnected ? activeItem : null;

	const iconParts = getIconParts(navContainer);
	const snapshot = iconParts
		? captureIconSnapshot(iconParts)
		: { rect: null, markup: "" };

	for (const item of navItems()) {
		item.classList.toggle("nav-item-active", item === next);
	}
	activeItem = next;

	syncIcon(navContainer, previous, next, snapshot, animate);

	if (next) {
		navContainer.classList.add("nav-has-active");
		requestAnimationFrame(() => moveHighlight(next));
	} else {
		navContainer.classList.remove("nav-has-active");
		if (hoverBorder) hoverBorder.style.opacity = "0";
	}
}

/**
 * 装上悬停滑动高亮与图标 FLIP。导航栏常驻，只需调用一次；
 * 重复调用会被 `initialized` 挡掉（热更新/重复挂载都安全）。
 */
export function initNavbarActiveMotion(): void {
	if (initialized) return;

	navContainer = document.querySelector<HTMLElement>(
		"[data-navbar-nav] .navbar-nav",
	);
	hoverBorder = document.querySelector<HTMLElement>("[data-hover-border]");
	if (!navContainer || !hoverBorder) return;

	initialized = true;
	abortController = new AbortController();
	const { signal } = abortController;
	const container = navContainer;
	const border = hoverBorder;

	for (const item of navItems()) {
		item.addEventListener(
			"mouseenter",
			() => {
				moveHighlight(item);
				syncNavbarDropdownOnHover(item);
			},
			{ signal },
		);
	}

	container.addEventListener(
		"mouseenter",
		() => {
			border.style.opacity = "1";
		},
		{ signal },
	);

	container.addEventListener(
		"mouseleave",
		() => {
			// 回落到当前页的激活项，且必须按 URL 现算：点击导航项后 Swup 立刻 pushState，
			// 但容器替换与 content:replaced 还没到，DOM 上的 .nav-item-active 仍是旧页的。
			// 直接读它就会在鼠标移出时把高亮闪回原页那一项，等导航完成再跳回来。
			moveHighlight(findItemByPath(container, window.location.pathname));
			// 面板是导航行的子节点，悬停进面板不会触发 mouseleave；只有真正离开才收起
			syncNavbarDropdownOnHover(null);
		},
		{ signal },
	);

	iconResizeObserver = new ResizeObserver(scheduleIconPositionSync);
	iconResizeObserver.observe(container);
	window.addEventListener("resize", scheduleIconPositionSync, {
		passive: true,
		signal,
	});

	refreshActiveItem(false);
}

/** 解绑（正常流程用不到，留给彻底销毁导航栏的场景） */
export function destroyNavbarActiveMotion(): void {
	abortController?.abort();
	abortController = null;
	iconResizeObserver?.disconnect();
	iconResizeObserver = null;
	if (iconResizeFrame !== null) {
		cancelAnimationFrame(iconResizeFrame);
		iconResizeFrame = null;
	}
	cancelIconAnimations();
	initialized = false;
	activeItem = null;
}
