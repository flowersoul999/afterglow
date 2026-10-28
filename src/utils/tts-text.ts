import { ttsConfig } from "@/config/ttsConfig";

const SKIP_SELECTORS: string[] = [
	"pre",
	"table",
	"sup",
	"a.anchor",
	".anchor-icon",
	"[data-pagefind-ignore]",
	".expressive-code",
	".katex",
	".katex-display",
	"script",
	"style",
	"button",
	"svg",
	"nav",
	".toc",
	".table-of-contents",
	"[data-tts-skip]",
];

const BLOCK_TAGS = new Set([
	"DIV",
	"SECTION",
	"ARTICLE",
	"MAIN",
	"ASIDE",
	"HEADER",
	"FOOTER",
	"P",
	"UL",
	"OL",
	"LI",
	"BLOCKQUOTE",
	"FIGURE",
	"FIGCAPTION",
	"H1",
	"H2",
	"H3",
	"H4",
	"H5",
	"H6",
	"DL",
	"DT",
	"DD",
	"DETAILS",
	"SUMMARY",
]);

const EMOJI_PATTERN =
	/(?:[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]|\u{FE0F}|\u{200D})/gu;

function cleanText(raw: string): string {
	return raw.replace(EMOJI_PATTERN, "").replace(/\s+/g, " ").trim();
}

function walk(element: Element, out: string[]): void {
	const children = Array.from(element.children);
	const hasBlockChild = children.some((child) => BLOCK_TAGS.has(child.tagName));
	if (!hasBlockChild) {
		const text = cleanText(element.textContent ?? "");
		if (text) {
			out.push(text);
		}
		return;
	}
	for (const node of Array.from(element.childNodes)) {
		if (node.nodeType === Node.TEXT_NODE) {
			const text = cleanText(node.textContent ?? "");
			if (text) {
				out.push(text);
			}
			continue;
		}
		if (node.nodeType === Node.ELEMENT_NODE) {
			const child = node as Element;
			if (child.tagName === "BR") {
				continue;
			}
			walk(child, out);
		}
	}
}

export interface ExtractedReadableText {
	text: string;
	truncated: boolean;
}

export function extractReadableText(
	root: ParentNode | null,
): ExtractedReadableText {
	if (!(root instanceof Element)) {
		return { text: "", truncated: false };
	}
	const clone = root.cloneNode(true) as Element;
	for (const selector of SKIP_SELECTORS) {
		for (const element of Array.from(clone.querySelectorAll(selector))) {
			element.remove();
		}
	}
	const blocks: string[] = [];
	walk(clone, blocks);
	const full = blocks.join("\n");
	return {
		text: full.slice(0, ttsConfig.maxChars),
		truncated: full.length > ttsConfig.maxChars,
	};
}

export function splitForSpeech(text: string): string[] {
	const limit = Math.max(1, ttsConfig.speechChunkChars);
	const sentences = text.split(/(?<=[。！？!?；;，,\n])/);
	const chunks: string[] = [];
	let current = "";
	for (const sentence of sentences) {
		if (current && current.length + sentence.length > limit) {
			chunks.push(current);
			current = "";
		}
		current += sentence;
		while (current.length > limit) {
			chunks.push(current.slice(0, limit));
			current = current.slice(limit);
		}
	}
	if (current) {
		chunks.push(current);
	}
	return chunks.filter((chunk) => chunk.trim().length > 0);
}
