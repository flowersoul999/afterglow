import { BANNER_HEIGHT_EXTEND } from "@/constants/constants";

/**
 * Calculate --banner-height-extend CSS variable.
 * The value must be a multiple of 4 to avoid blurry text.
 */
export function calculateBannerHeightExtend(): void {
	let offset = Math.floor(window.innerHeight * (BANNER_HEIGHT_EXTEND / 100));
	offset = offset - (offset % 4);
	document.documentElement.style.setProperty(
		"--banner-height-extend",
		`${offset}px`,
	);
}

/**
 * Show the banner image by removing initial hidden state classes
 */
export function showBanner(): void {
	requestAnimationFrame(() => {
		// Handle single image banner (desktop)
		const banner = document.getElementById("banner");
		if (banner) {
			banner.classList.remove("opacity-0", "scale-105");
		}

		// Handle mobile single image banner
		const mobileBanner = document.querySelector(
			'.block.lg\\:hidden[alt="Mobile banner image of the blog"]',
		);
		if (mobileBanner) {
			mobileBanner.classList.remove("opacity-0", "scale-105");
			mobileBanner.classList.add("opacity-100");
		}
	});
}

/**
 * Set up the resize handler that recalculates --banner-height-extend
 */
export function initBannerResize(): void {
	window.addEventListener("resize", () => {
		let offset = Math.floor(window.innerHeight * (BANNER_HEIGHT_EXTEND / 100));
		offset = offset - (offset % 4);
		document.documentElement.style.setProperty(
			"--banner-height-extend",
			`${offset}px`,
		);
	});
}
