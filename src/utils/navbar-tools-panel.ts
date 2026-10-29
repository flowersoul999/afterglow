/**
 * 导航栏右段「工具面板」：桌面端悬停 / 聚焦工具按钮后浮出的一只小箱子
 * （搜索 / 公告 / 主题三段滑块）。
 *
 * 三个细节值得留在这里当文档：
 *   1. **为什么面板不挂在右段里**：右段滚动后会收缩成小球并 `overflow: hidden`，
 *      挂在里面会被裁掉。所以面板是 `.navbar-segments` 的直接子元素，
 *      水平位置由本模块实测（箱体中心对准按钮，视口放不下时整体内收、
 *      指针沿箱沿滑动）。`--tools-anchor-x` 同时给指针位移和缩放原点用，
 *      动画只跑 opacity / transform，不触发布局。
 *   2. **悬停不是点击**：鼠标从按钮移向面板会经过一段空白，所以按钮与面板上
 *      各挂 enter/leave，中间用 260ms 延迟糊住，否则面板会闪收。
 *   3. **主题切换会打乱指针命中**：切主题若走 View Transitions，指针事件会被
 *      快照层转交，面板可能收到一次假的 mouseleave。所以收起前用坐标复核。
 *
 * 导航栏常驻 → 只初始化一次；换页只需收起。
 */

import { DARK_MODE, LIGHT_MODE, SYSTEM_MODE } from "@/constants/constants";
import { requestSearchModalToggle } from "@/utils/search-modal-controller";
import { getStoredTheme, setTheme } from "@/utils/setting-utils";

const TOOLS_CLOSE_DELAY = 260;
/** 面板与视口左右边缘、指针与箱体左右边缘共用的最小留白 */
const TOOLS_EDGE_INSET = 12;

let initialized = false;

function clampValue(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

export function initNavbarToolsPanel(): void {
	if (initialized) return;

	const toolsButton = document.getElementById("nav-tools-btn");
	const toolsPanel = document.getElementById("nav-tools-panel");
	const toolsBox = document.querySelector<HTMLElement>(
		"#nav-tools-panel .nav-tools-box",
	);
	if (!toolsButton || !toolsPanel || !toolsBox) return;

	initialized = true;

	const button = toolsButton;
	const panel = toolsPanel;
	const box = toolsBox;

	let closeTimer: number | null = null;
	let repositionFrame = 0;
	let pointerInside = false;

	const isOpen = (): boolean => panel.classList.contains("is-open");

	function cancelClose(): void {
		if (closeTimer !== null) {
			window.clearTimeout(closeTimer);
			closeTimer = null;
		}
	}

	/* ───────────── 定位 ───────────── */

	function positionPanel(): void {
		const segments = button.closest(".navbar-segments");
		if (!segments) return;
		const segmentsRect = segments.getBoundingClientRect();
		const buttonRect = button.getBoundingClientRect();
		const panelWidth = panel.offsetWidth;
		const viewportWidth = document.documentElement.clientWidth;
		const center = buttonRect.left + buttonRect.width / 2;

		const left = clampValue(
			center - panelWidth / 2,
			TOOLS_EDGE_INSET,
			viewportWidth - panelWidth - TOOLS_EDGE_INSET,
		);
		const anchorX = clampValue(
			center - left,
			TOOLS_EDGE_INSET,
			panelWidth - TOOLS_EDGE_INSET,
		);

		panel.style.left = `${left - segmentsRect.left}px`;
		panel.style.setProperty("--tools-anchor-x", `${anchorX}px`);
	}

	/* ───────────── 悬停药丸 ───────────── */

	const highlight = panel.querySelector<HTMLElement>(".nav-tools-highlight");
	const rows = Array.from(
		panel.querySelectorAll<HTMLElement>("[data-nav-tools-stop]"),
	);
	// 展开错峰的行序号写在内联属性上：高亮药丸也是箱体子元素，
	// 用 nth-child 数不出来
	rows.forEach((row, index) => {
		row.style.setProperty("--tools-row-index", String(index));
	});

	let highlightedRow: HTMLElement | null = null;

	function highlightRow(row: HTMLElement | null): void {
		if (!highlight) return;
		highlightedRow = row;
		if (!row) {
			highlight.classList.remove("is-on");
			return;
		}
		highlight.style.setProperty("--tools-hl-y", `${row.offsetTop}px`);
		highlight.style.setProperty("--tools-hl-h", `${row.offsetHeight}px`);
		highlight.classList.add("is-on");
	}

	function rowOf(target: EventTarget | null): HTMLElement | null {
		if (!(target instanceof Element)) return null;
		return target.closest<HTMLElement>("[data-nav-tools-stop]");
	}

	// 悬停即高亮，但不抢键盘焦点：pointerover 只挪药丸
	box.addEventListener("pointerover", (event) => {
		if (event.pointerType === "touch") return;
		const row = rowOf(event.target);
		if (row === highlightedRow) return;
		highlightRow(row);
	});
	box.addEventListener("pointerleave", () => highlightRow(null));
	// 键盘路径：焦点落在哪一行，药丸就跟到哪一行
	box.addEventListener("focusin", (event) => highlightRow(rowOf(event.target)));

	/* ───────────── 开合 ───────────── */

	function open(): void {
		cancelClose();
		if (isOpen()) return;
		positionPanel();
		panel.classList.add("is-open");
		button.setAttribute("aria-expanded", "true");
	}

	function close(): void {
		cancelClose();
		if (!isOpen()) return;
		panel.classList.remove("is-open");
		button.setAttribute("aria-expanded", "false");
		highlightRow(null);
	}

	function scheduleClose(): void {
		if (closeTimer !== null) return;
		closeTimer = window.setTimeout(() => {
			closeTimer = null;
			close();
		}, TOOLS_CLOSE_DELAY);
	}

	button.addEventListener("mouseenter", open);
	button.addEventListener("mouseleave", scheduleClose);

	panel.addEventListener("mouseenter", () => {
		pointerInside = true;
		cancelClose();
	});
	panel.addEventListener("mouseleave", (event) => {
		const rect = panel.getBoundingClientRect();
		const stillInside =
			event.clientX >= rect.left &&
			event.clientX <= rect.right &&
			event.clientY >= rect.top &&
			event.clientY <= rect.bottom;
		// 主题切换的视图过渡会把指针命中转交给快照层，指针没离开也会补发
		// mouseleave；按坐标确认后再收起
		if (
			stillInside &&
			document.documentElement.classList.contains("is-theme-transitioning")
		) {
			return;
		}
		pointerInside = false;
		scheduleClose();
	});

	// 键盘路径：聚焦展开，焦点离开按钮与面板后延迟收起。
	// 主题切换期间可能把焦点甩回 body 冒出 focusout，指针还在面板里时不据此收起
	button.addEventListener("focusin", open);
	button.addEventListener("focusout", (event) => {
		const next = event.relatedTarget;
		if (next instanceof Node && panel.contains(next)) return;
		if (pointerInside) return;
		scheduleClose();
	});
	panel.addEventListener("focusout", (event) => {
		const next = event.relatedTarget;
		if (next instanceof Node && (panel.contains(next) || button.contains(next)))
			return;
		if (pointerInside) return;
		scheduleClose();
	});

	// 点击开合兜底（触屏 / 键盘 Enter）
	button.addEventListener("click", (event) => {
		event.stopPropagation();
		if (isOpen()) close();
		else open();
	});

	// 行点击的收合规则：主题三段滑块保持展开（选完要看滑块反馈），
	// 其余行（搜索 / 公告）点完即收起
	panel.addEventListener("click", (event) => {
		const target = event.target;
		if (!(target instanceof Element)) return;
		if (target.closest('[data-nav-tools-stop="group"]')) return;
		if (target.closest("[data-nav-tools-stop]")) close();
	});

	// 收缩小球随滚动位移，面板锚点会失效，滚动即收起
	window.addEventListener(
		"scroll",
		() => {
			// 主题滑块选完要留在面板里看反馈：切换时代码主题属性跟着变，
			// 页面高度抖动会冒出一次 scroll，此时锚点其实没动
			if (pointerInside) return;
			if (isOpen()) close();
		},
		{ passive: true },
	);

	window.addEventListener(
		"resize",
		() => {
			if (!isOpen()) return;
			// 连续 resize 合并到一帧内只量测一次
			if (repositionFrame !== 0) return;
			repositionFrame = window.requestAnimationFrame(() => {
				repositionFrame = 0;
				positionPanel();
			});
		},
		{ passive: true },
	);

	document.addEventListener("click", (event) => {
		const target = event.target;
		if (!(target instanceof Node)) return;
		if (button.contains(target) || panel.contains(target)) return;
		if (isOpen()) close();
	});

	/* ───────────── 主题三段滑块 ───────────── */

	const segments = panel.querySelector<HTMLElement>(".nav-tools-segments");
	const themeButtons = Array.from(
		panel.querySelectorAll<HTMLElement>("[data-nav-tools-theme]"),
	);

	if (segments && themeButtons.length > 0) {
		const segmentRoot = segments;
		const buttons = themeButtons;

		function syncThemeSegments(): void {
			const current = getStoredTheme();
			const at = buttons.findIndex(
				(themeButton) => themeButton.dataset.navToolsTheme === current,
			);
			buttons.forEach((themeButton, index) => {
				themeButton.setAttribute("aria-checked", String(index === at));
			});
			// 滑块位移只改一个自定义属性，实际移动交给 transform
			segmentRoot.style.setProperty(
				"--nav-tools-seg-index",
				String(Math.max(0, at)),
			);
		}

		segmentRoot.addEventListener("click", (event) => {
			const target = event.target;
			if (!(target instanceof Element)) return;
			const themeButton = target.closest<HTMLElement>("[data-nav-tools-theme]");
			const value = themeButton?.dataset.navToolsTheme;
			if (
				value !== LIGHT_MODE &&
				value !== DARK_MODE &&
				value !== SYSTEM_MODE
			) {
				return;
			}
			event.stopPropagation();
			setTheme(value);
			// setTheme 只在外观真的改变时才动 DOM，theme-change 也只由系统偏好触发：
			// 从 system 点到与当前外观一致的一格时两者都不会回调，滑块必须自己同步
			syncThemeSegments();
		});

		syncThemeSegments();
		window.addEventListener("theme-change", syncThemeSegments);
	}

	/* ───────────── 搜索行的快捷键提示 ───────────── */

	const modifier = panel.querySelector<HTMLElement>(
		"[data-nav-tools-modifier]",
	);
	if (modifier && /Mac|iPhone|iPad|iPod/.test(navigator.userAgent)) {
		modifier.textContent = "⌘";
	}

	/* ───────────── 公告弹窗（原生 dialog，外壳复用 privacy-modal） ───────────── */

	const announcementModal = document.getElementById(
		"nav-announcement-modal",
	) as HTMLDialogElement | null;
	const announcementTrigger = document.getElementById("nav-tools-announcement");

	function isAnnouncementOpen(): boolean {
		return announcementModal?.open ?? false;
	}

	function openAnnouncement(): void {
		if (!announcementModal || isAnnouncementOpen()) return;
		close();
		announcementModal.showModal();
		// showModal 只 inert，不锁滚动；公告正文自身仍要能滚
		document.body.style.overflow = "hidden";
	}

	function closeAnnouncement(restoreFocus: boolean): void {
		if (!announcementModal || !isAnnouncementOpen()) return;
		announcementModal.close();
		document.body.style.overflow = "";
		// 触发器在工具面板里，面板此刻已收起；close() 的自动回焦可能落到隐藏节点上
		if (restoreFocus) announcementTrigger?.focus();
	}

	announcementTrigger?.addEventListener("click", (event) => {
		event.stopPropagation();
		openAnnouncement();
	});

	// 遮罩、关闭按钮与底部确认按钮共用 data-nav-announcement-close。
	// 判 target 用 Element 而不是 HTMLElement —— 关闭按钮里包着 svg，
	// 点中图形时 target 是 SVGElement，用 HTMLElement 过滤会整个漏掉
	announcementModal?.addEventListener("click", (event) => {
		const target = event.target;
		if (
			target instanceof Element &&
			target.closest("[data-nav-announcement-close]")
		) {
			closeAnnouncement(false);
		}
	});

	// 兜底：任何路径关掉弹窗都还原背景滚动（含浏览器自行处理的 Esc）
	announcementModal?.addEventListener("close", () => {
		document.body.style.overflow = "";
	});
	announcementModal?.addEventListener("cancel", (event) => {
		event.preventDefault();
		closeAnnouncement(true);
	});

	/* ───────────── Escape 与换页 ───────────── */

	document.addEventListener("keydown", (event) => {
		if (event.key !== "Escape") return;
		if (isAnnouncementOpen()) {
			event.preventDefault();
			closeAnnouncement(true);
			return;
		}
		if (isOpen()) {
			event.preventDefault();
			close();
			button.focus();
		}
	});

	window.addEventListener("swup:content:replaced", () => {
		close();
		closeAnnouncement(false);
	});

	/* ───────────── 搜索 ───────────── */

	document.getElementById("navbar")?.addEventListener("click", (event) => {
		const target = event.target;
		if (!(target instanceof Element)) return;
		const trigger = target.closest("[data-nav-search-trigger]");
		if (!trigger) return;
		event.stopPropagation();
		close();
		requestSearchModalToggle();
	});
}
