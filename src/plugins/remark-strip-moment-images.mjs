/**
 * 动态（moments）专用：把正文里的 Markdown 图片从渲染结果里剔除。
 *
 * 为什么需要：2026-10-21 起动态图片写进正文（`![](url)`）以便在 Obsidian 里可见，
 * 但网页端的九宫格 / 视频区由 MomentCard 自己从 `moment.body` 提取后渲染。
 * 若不剔除，`<Content />` 会把同一批图再输出一遍，页面上出现两份。
 *
 * 只对 `src/content/动态/` 下的文件生效，文章页图文混排不受影响。
 * （file.path 由 @astrojs/markdown-remark 设为 file:// URL，中文路径需解码）
 */

/** 判断节点在「删掉图片后」是否为空 */
function isBlank(node) {
	if (node.type === "image" || node.type === "imageReference") return true;
	if (typeof node.value === "string") return node.value.trim() === "";
	const children = node.children;
	if (!Array.isArray(children) || children.length === 0) return true;
	return children.every((child) => isBlank(child));
}

function stripImages(node) {
	if (!Array.isArray(node.children)) return;

	const kept = [];
	for (const child of node.children) {
		// 先递归，让深层的图片（列表 / 引用里的）也被摘掉
		stripImages(child);

		if (child.type === "image" || child.type === "imageReference") continue;
		// 图片独占的段落会被摘空，整段移除，避免留下空 <p> 撑开间距
		const isWrapper =
			child.type === "paragraph" ||
			child.type === "listItem" ||
			child.type === "blockquote";
		if (isWrapper && isBlank(child)) continue;

		kept.push(child);
	}
	node.children = kept;
}

export function remarkStripMomentImages() {
	return (tree, file) => {
		const rawPath = typeof file?.path === "string" ? file.path : "";
		if (!rawPath) return;

		let decoded = rawPath;
		try {
			decoded = decodeURIComponent(rawPath);
		} catch {
			/* 不是合法 URL 编码时按原值处理 */
		}
		const normalized = decoded.replace(/\\/gu, "/");
		if (!normalized.includes("/src/content/动态/")) return;

		stripImages(tree);
	};
}
