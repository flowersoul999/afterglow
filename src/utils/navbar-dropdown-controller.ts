/**
 * 顶部导航共享下拉面板控制器。
 *
 * 交互模型：整条导航只有**一个**下拉面板（`[data-navbar-dropdown-panel]`），
 * 悬停哪个带子菜单的导航项，面板就滑到哪一项下方并切换到对应内容页
 * （左右滑动 + 宽高过渡 + 内容交叉淡换 + 指针沿箱沿滑过去）。
 * 滑到无子菜单的项、或离开导航行时收起。
 *
 * 各导航项的 `.dropdown-container` 里只保留触发按钮，内容页由 `Navbar.astro`
 * 集中渲染在面板内，页与项通过 `data-dropdown-index` / `data-dropdown-page` 配对。
 *
 * ⚠️ 面板与导航栏都在 Swup 容器之外、跨导航常驻，所以：
 *   - 点击/键盘委托只需注册一次（`delegationInitialized` guard）；
 *   - 收起时机挂在 `swup:content:replaced` 上，**必须监听 window**（CLAUDE.md §11.4）。
 */

/** 箱体与视口左右边缘、指针与箱体左右边缘的最小留白（px） */
const PANEL_EDGE_INSET = 12;

/** 键盘 Enter/ArrowDown 打开后的「钉住」态：悬停不再抢占，Escape / 外点 / 换页才收起 */
let pinnedIndex: number | null = null;
let delegationInitialized = false;

interface PanelElements {
	panel: HTMLElement;
	box: HTMLElement;
	arrow: HTMLElement;
	pages: Map<number, HTMLElement>;
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

function parseIndex(raw: string | undefined): number | null {
	if (raw === undefined) return null;
	const index = Number.parseInt(raw, 10);
	return Number.isInteger(index) ? index : null;
}

function getPanelElements(): PanelElements | null {
	const panel = document.querySelector<HTMLElement>(
		"[data-navbar-dropdown-panel]",
	);
	if (!panel) return null;
	const box = panel.querySelector<HTMLElement>(".navbar-dropdown-box");
	const arrow = panel.querySelector<HTMLElement>(".navbar-dropdown-arrow");
	if (!box || !arrow) return null;

	const pages = new Map<number, HTMLElement>();
	for (const page of panel.querySelectorAll<HTMLElement>(
		"[data-dropdown-page]",
	)) {
		const index = parseIndex(page.dataset.dropdownPage);
		if (index !== null) pages.set(index, page);
	}
	return { panel, box, arrow, pages };
}

function getItemIndex(item: HTMLElement): number | null {
	return parseIndex(item.dataset.dropdownIndex);
}

/** 面板内当前激活页对应的索引 */
function getActivePageIndex(elements: PanelElements): number | null {
	for (const [index, page] of elements.pages) {
		if (page.classList.contains("is-active")) return index;
	}
	return null;
}

/**
 * 面板定位：箱体水平中心对准导航项中心，指针落在箱体中央；
 * 视口放不下时箱体整体内收，指针沿箱沿滑动保持指向导航项。
 * 宽高切到目标内容页 —— left / width / height 都有过渡，于是「滑过去」这件事
 * 是 CSS 一次播完的，不用 JS 逐帧算。
 */
function positionPanel(
	elements: PanelElements,
	item: HTMLElement,
	page: HTMLElement,
): void {
	const navContainer = item.parentElement;
	if (!navContainer) return;
	const navRect = navContainer.getBoundingClientRect();
	const rect = item.getBoundingClientRect();
	const pageWidth = page.offsetWidth;
	const pageHeight = page.offsetHeight;
	const viewportWidth = document.documentElement.clientWidth;
	const center = rect.left + rect.width / 2;
	const left = clamp(
		center - pageWidth / 2,
		PANEL_EDGE_INSET,
		viewportWidth - pageWidth - PANEL_EDGE_INSET,
	);
	const anchorX = clamp(
		center - left,
		PANEL_EDGE_INSET,
		pageWidth - PANEL_EDGE_INSET,
	);

	elements.panel.style.left = `${left - navRect.left}px`;
	// 指针方块 0.75rem 见方，用 rem 扣一半宽度，跟样式里的尺寸同一口径
	elements.arrow.style.left = `calc(${anchorX}px - 0.375rem)`;
	elements.box.style.width = `${pageWidth}px`;
	elements.box.style.height = `${pageHeight}px`;
}

function freezePanelTransitions(elements: PanelElements): void {
	elements.panel.style.transition = "none";
	elements.arrow.style.transition = "none";
	elements.box.style.transition = "none";
}

function unfreezePanelTransitions(elements: PanelElements): void {
	elements.panel.style.transition = "";
	elements.arrow.style.transition = "";
	elements.box.style.transition = "";
}

function syncTriggerStates(activeIndex: number | null): void {
	for (const container of document.querySelectorAll<HTMLElement>(
		"[data-dropdown]",
	)) {
		const trigger = container.querySelector("[data-dropdown-trigger]");
		const index = getItemIndex(container);
		const isActive = index !== null && index === activeIndex;
		container.classList.toggle("is-dropdown-open", isActive);
		trigger?.setAttribute("aria-expanded", String(isActive));
	}
}

function activatePage(
	elements: PanelElements,
	index: number,
): HTMLElement | null {
	const page = elements.pages.get(index);
	if (!page) return null;
	for (const [pageIndex, candidate] of elements.pages) {
		candidate.classList.toggle("is-active", pageIndex === index);
	}
	// 换页时旧的悬停药丸不该跟着淡进来
	clearNavbarDropdownHighlights(elements.panel);
	return page;
}

/**
 * 悬停 / 聚焦高亮：每页只有一个药丸，靠 translateY 在行之间滑动。
 * 页既是药丸的包含块也是内容项的偏移父级，offsetTop 可直接用。
 */
function highlightNavbarDropdownItem(
	page: HTMLElement,
	item: HTMLElement | null,
): void {
	const pill = page.querySelector<HTMLElement>(".navbar-dropdown-highlight");
	if (!pill) return;
	if (!item) {
		page.classList.remove("is-hovered");
		return;
	}
	pill.style.setProperty("--navbar-dropdown-hl-y", `${item.offsetTop}px`);
	pill.style.setProperty("--navbar-dropdown-hl-h", `${item.offsetHeight}px`);
	page.classList.add("is-hovered");
}

function clearNavbarDropdownHighlights(root: ParentNode): void {
	for (const page of root.querySelectorAll<HTMLElement>(
		".navbar-dropdown-page.is-hovered",
	)) {
		page.classList.remove("is-hovered");
	}
}

/** 由事件目标（悬停或聚焦落点）推导药丸该贴住哪一行 */
function syncNavbarDropdownHighlightFrom(target: EventTarget | null): void {
	if (!(target instanceof Element)) return;
	const page = target.closest<HTMLElement>(".navbar-dropdown-page");
	if (!page) return;
	const item = target.closest<HTMLElement>(".dropdown-item");
	highlightNavbarDropdownItem(
		page,
		item?.closest(".navbar-dropdown-page") === page ? item : null,
	);
}

function openForItem(item: HTMLElement, index: number): void {
	const elements = getPanelElements();
	if (!elements) return;
	const page = activatePage(elements, index);
	if (!page) return;

	const wasOpen = elements.panel.classList.contains("is-open");
	if (!wasOpen) {
		// 收起态下打开不做滑动过渡：面板直接就位后只播淡入，
		// 否则会从上一次关闭时的旧位置滑过来
		freezePanelTransitions(elements);
		positionPanel(elements, item, page);
		void elements.panel.offsetWidth;
		unfreezePanelTransitions(elements);
		elements.panel.classList.add("is-open");
	} else {
		positionPanel(elements, item, page);
	}
	syncTriggerStates(index);
}

export function closeNavbarDropdownPanel(): void {
	pinnedIndex = null;
	const elements = getPanelElements();
	if (!elements) return;
	elements.panel.classList.remove("is-open");
	for (const page of elements.pages.values()) {
		page.classList.remove("is-active");
	}
	clearNavbarDropdownHighlights(elements.panel);
	syncTriggerStates(null);
}

/**
 * 悬停驱动的面板同步：item 传 null 表示鼠标已离开导航行。
 * 钉住态（键盘打开）下悬停不抢占面板。
 */
export function syncNavbarDropdownOnHover(item: HTMLElement | null): void {
	if (pinnedIndex !== null) return;
	const elements = getPanelElements();
	if (!elements) return;
	if (!item) {
		closeNavbarDropdownPanel();
		return;
	}
	const index = getItemIndex(item);
	if (index === null || !elements.pages.has(index)) {
		closeNavbarDropdownPanel();
		return;
	}
	openForItem(item, index);
}

/** 键盘打开（钉住）：Enter / ArrowDown 在触发器上触发 */
export function openNavbarDropdownPinned(item: HTMLElement): void {
	const index = getItemIndex(item);
	if (index === null) return;
	pinnedIndex = index;
	openForItem(item, index);
}

export function isNavbarDropdownPinned(): boolean {
	return pinnedIndex !== null;
}

/** 窗口/布局尺寸变化后，让打开中的面板重新对齐当前导航项 */
export function repositionNavbarDropdown(): void {
	if (pinnedIndex !== null) return;
	const elements = getPanelElements();
	if (!elements?.panel.classList.contains("is-open")) return;
	const index = getActivePageIndex(elements);
	if (index === null) return;
	const item = document.querySelector<HTMLElement>(
		`[data-dropdown-index="${index}"]`,
	);
	const page = elements.pages.get(index);
	if (item && page) positionPanel(elements, item, page);
}

function focusFirstPageItem(index: number): void {
	document
		.querySelector<HTMLElement>(
			`[data-dropdown-page="${index}"] .dropdown-item`,
		)
		?.focus();
}

function focusContainerTrigger(index: number): void {
	document
		.querySelector<HTMLElement>(
			`[data-dropdown-index="${index}"] [data-dropdown-trigger]`,
		)
		?.focus();
}

/**
 * 点击 / 键盘 / 面板悬停的文档级委托。
 * 面板与导航栏常驻，只需注册一次；`pinnedIndex` 在换页时复位。
 */
export function initNavbarDropdownDelegation(): void {
	if (delegationInitialized) return;
	delegationInitialized = true;

	document.addEventListener("keydown", (event: KeyboardEvent) => {
		const target = event.target as HTMLElement | null;
		const trigger = target?.closest?.(
			"[data-dropdown-trigger]",
		) as HTMLElement | null;
		const pageItem = target?.closest?.(".dropdown-item") as HTMLElement | null;

		if (event.key === "Escape") {
			if (pinnedIndex === null) return;
			const index = pinnedIndex;
			closeNavbarDropdownPanel();
			focusContainerTrigger(index);
			return;
		}

		if (trigger) {
			const container = trigger.closest<HTMLElement>("[data-dropdown]");
			const index = container ? getItemIndex(container) : null;
			if (index === null) return;

			if (event.key === "Enter" || event.key === " ") {
				event.preventDefault();
				if (pinnedIndex === index) {
					closeNavbarDropdownPanel();
				} else {
					openNavbarDropdownPinned(trigger);
				}
			} else if (event.key === "ArrowDown") {
				event.preventDefault();
				openNavbarDropdownPinned(trigger);
				focusFirstPageItem(index);
			}
			return;
		}

		if (pageItem) {
			const page = pageItem.closest<HTMLElement>("[data-dropdown-page]");
			if (!page) return;
			const index = parseIndex(page.dataset.dropdownPage);
			if (index === null) return;
			const items = Array.from(
				page.querySelectorAll<HTMLElement>(".dropdown-item"),
			);
			if (event.key === "ArrowDown") {
				event.preventDefault();
				const current = items.indexOf(pageItem);
				items[(current + 1) % items.length]?.focus();
			} else if (event.key === "ArrowUp") {
				event.preventDefault();
				const current = items.indexOf(pageItem);
				items[(current - 1 + items.length) % items.length]?.focus();
			}
		}
	});

	document.addEventListener("click", (event) => {
		const target = event.target as HTMLElement;
		const actionButton = target.closest("[data-action]");
		if (actionButton) {
			const action = actionButton.getAttribute("data-action");
			if (action) window.dispatchEvent(new CustomEvent(action));
		}

		if (target.closest(".dropdown-item")) {
			closeNavbarDropdownPanel();
			(document.activeElement as HTMLElement | null)?.blur?.();
			return;
		}

		// 触发器区域（含导航行内的其他项）交给悬停逻辑，不在此收起
		if (
			!target.closest("[data-dropdown]") &&
			!target.closest("[data-navbar-dropdown-panel]")
		) {
			closeNavbarDropdownPanel();
		}
	});

	// 悬停 / 键盘聚焦驱动的药丸：面板常驻，委托挂在 document 上，
	// 避免初始化时面板还没渲染（或某页没渲染面板）导致一次都绑不上
	document.addEventListener("pointerover", (event) => {
		const pointerEvent = event as PointerEvent;
		if (pointerEvent.pointerType === "touch") return;
		const target = event.target;
		if (!(target instanceof Element)) return;
		if (!target.closest("[data-navbar-dropdown-panel]")) return;
		syncNavbarDropdownHighlightFrom(target);
	});

	document.addEventListener("focusin", (event) => {
		const target = event.target;
		if (!(target instanceof Element)) return;
		if (!target.closest("[data-navbar-dropdown-panel]")) return;
		syncNavbarDropdownHighlightFrom(target);
	});

	document.addEventListener("pointerleave", (event) => {
		const target = event.target;
		if (!(target instanceof Element)) return;
		const panel = target.closest<HTMLElement>("[data-navbar-dropdown-panel]");
		if (panel) clearNavbarDropdownHighlights(panel);
	});

	window.addEventListener("swup:content:replaced", () =>
		closeNavbarDropdownPanel(),
	);
	window.addEventListener("pageshow", () => closeNavbarDropdownPanel());
}
