/**
 * Initialize custom scrollbar containers for KaTeX display elements.
 * Wraps each KaTeX element in a scrollable container using the browser's
 * native scrollbar.
 */
export function initCustomScrollbar(): void {
	const katexElements = document.querySelectorAll(
		".katex-display:not([data-scrollbar-initialized])",
	) as NodeListOf<HTMLElement>;
	katexElements.forEach((element) => {
		if (!element.parentNode) return;

		const container = document.createElement("div");
		container.className = "katex-display-container";
		element.parentNode.insertBefore(container, element);
		container.appendChild(element);

		// Use browser native scrollbar, no custom styles
		container.style.cssText = `
			overflow-x: auto;
		`;

		element.setAttribute("data-scrollbar-initialized", "true");
	});
}
