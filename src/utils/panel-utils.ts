/**
 * Set up a click-outside-to-close handler for a floating panel.
 * Skips the nav-menu-panel which has its own close logic.
 */
export function setClickOutsideToClose(panel: string, ignores: string[]): void {
	// Skip fullscreen nav menu - it has its own handling
	if (panel === "nav-menu-panel") return;

	document.addEventListener("click", (event) => {
		const panelDom = document.getElementById(panel);
		if (!panelDom) return;
		const tDom = event.target;
		if (!(tDom instanceof Node)) return;
		for (const ig of ignores) {
			const ie = document.getElementById(ig);
			if (ie === tDom || ie?.contains(tDom)) {
				return;
			}
		}
		panelDom.classList.add("float-panel-closed");
	});
}

/**
 * Initialize all panel close handlers
 */
export function initPanelCloseHandlers(): void {
	// Nav menu is handled by NavMenuPanel.astro itself
	setClickOutsideToClose("search-panel", [
		"search-panel",
		"search-bar",
		"search-switch",
	]);
}
