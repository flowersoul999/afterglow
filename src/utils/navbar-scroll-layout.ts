/**
 * 导航栏滚动收缩布局：往下滚过 80px 左右两个椭圆段收成小球、贴到中段两侧；
 * 回到 40px 以内再张开。中段（紧凑导航椭圆）始终不动。
 *
 * 为什么收缩态的位置要用 JS 按 px 算：左右两段是绝对定位，收缩后要贴住
 * **中段**而不是容器边缘，而中段宽度由导航项数量决定（构建期才有值）。
 * 这个位置写不进 CSS，只能量。
 *
 * ⚠️ 本模块只初始化一次（导航栏常驻），换页后由 `swup:content:replaced`
 * 重算一次 —— 换页后滚动条可能消失，容器可用宽度变了。
 */

const SCROLL_IN = 80;
const SCROLL_OUT = 40;
/** 收缩态小球与中段椭圆之间的间隙 */
const COMPACT_GAP = 8;

interface NavbarElements {
	navbar: HTMLElement;
	wrapper: HTMLElement | null;
	segments: HTMLElement;
	center: HTMLElement;
	left: HTMLElement;
	right: HTMLElement;
}

let initialized = false;

export function initNavbarScrollLayout(): void {
	if (initialized) return;

	const navbar = document.getElementById("navbar");
	if (!navbar) return;
	const segments = navbar.querySelector<HTMLElement>(".navbar-segments");
	const center = navbar.querySelector<HTMLElement>(".navbar-seg--center");
	const left = navbar.querySelector<HTMLElement>(".navbar-seg--left");
	const right = navbar.querySelector<HTMLElement>(".navbar-seg--right");
	if (!segments || !center || !left || !right) return;

	initialized = true;

	const el: NavbarElements = {
		navbar,
		wrapper: document.getElementById("navbar-wrapper"),
		segments,
		center,
		left,
		right,
	};

	let layoutFrame: number | null = null;

	function updateCompactLayout(): void {
		const isScrolled = el.navbar.classList.contains("scrolled");

		// 移动端不收缩：左右两段回到 flex 排列，清掉 JS 写过的内联定位
		if (window.matchMedia("(max-width: 1023px)").matches) {
			el.left.style.left = "";
			el.left.style.transform = "";
			el.right.style.left = "";
			el.right.style.right = "";
			el.right.style.transform = "";
			return;
		}

		const segmentsRect = el.segments.getBoundingClientRect();
		const centerRect = el.center.getBoundingClientRect();
		const leftRect = el.left.getBoundingClientRect();
		const rightRect = el.right.getBoundingClientRect();

		// 右段首次定位时禁用过渡，避免从 right:0 滑到收缩位的那一下
		const isFirstRightPosition = el.right.style.right === "";
		if (isFirstRightPosition) el.right.style.transition = "none";

		el.left.style.transform = "translateY(-50%)";
		el.right.style.transform = "translateY(-50%)";

		if (isScrolled) {
			// 收缩态：左右段贴到中间椭圆两侧。右段用 right 定位，算出来再大也只是
			// 往左偏，不会被推出容器（用 left 定位时算错就直接溢出屏幕）。
			// right 是「右段右边缘到容器右边缘」的距离，所以要减掉右段自身宽度。
			const maxRight = Math.max(0, segmentsRect.width - rightRect.width);
			const desiredRight =
				segmentsRect.right - centerRect.right - COMPACT_GAP - rightRect.width;
			el.right.style.right = `${Math.min(Math.max(desiredRight, 0), maxRight)}px`;
			el.left.style.left = `${Math.max(
				0,
				centerRect.left - segmentsRect.left - COMPACT_GAP - leftRect.width,
			)}px`;
		} else {
			// 展开态：右段贴住容器右边缘。这里用纯 right: 0，不按 px 换算，
			// 于是滚动条出现、字体加载、换页导致的宽度变化都不会让它跑到页面外。
			el.left.style.left = "0px";
			el.right.style.right = "0px";
		}

		if (isFirstRightPosition) {
			// 强制一帧重排后再恢复过渡，否则「禁用过渡」这个改动本身会被合批吞掉
			void el.right.offsetHeight;
			el.right.style.transition = "";
		}
	}

	// 收缩态的位置是 JS 按 px 算的，容器可用宽度变了（滚动条出现/消失、
	// 换页后内容变高）就得重算；window.resize 抓不到这一类变化
	function scheduleLayoutUpdate(): void {
		if (layoutFrame !== null) return;
		layoutFrame = requestAnimationFrame(() => {
			layoutFrame = null;
			updateCompactLayout();
		});
	}

	function syncCompactState(): void {
		const y = window.scrollY;
		const wasScrolled = el.navbar.classList.contains("scrolled");
		let nextScrolled = wasScrolled;

		if (y > SCROLL_IN) nextScrolled = true;
		else if (y < SCROLL_OUT) nextScrolled = false;

		el.navbar.classList.toggle("scrolled", nextScrolled);
		el.wrapper?.classList.toggle("navbar-scrolled", nextScrolled);

		if (wasScrolled !== nextScrolled || nextScrolled) scheduleLayoutUpdate();
	}

	let scrollFrame: number | null = null;
	window.addEventListener(
		"scroll",
		() => {
			if (scrollFrame !== null) return;
			scrollFrame = requestAnimationFrame(() => {
				scrollFrame = null;
				syncCompactState();
			});
		},
		{ passive: true },
	);

	window.addEventListener("resize", scheduleLayoutUpdate, { passive: true });

	// 只盯「容器宽度」：滚动条出现/消失、窗口变化都会让它变。
	// 不监听左右段自身 —— 收缩动画进行中它们的尺寸每帧都在变，
	// 那时重算反而会打断 left / right 的过渡动画。
	if (typeof ResizeObserver !== "undefined") {
		const observer = new ResizeObserver(scheduleLayoutUpdate);
		[el.segments, el.navbar, el.wrapper].forEach((node) => {
			if (node) observer.observe(node);
		});
	}

	window.addEventListener("load", scheduleLayoutUpdate);
	window.addEventListener("swup:content:replaced", () => {
		syncCompactState();
		scheduleLayoutUpdate();
	});

	syncCompactState();
	requestAnimationFrame(updateCompactLayout);
}
