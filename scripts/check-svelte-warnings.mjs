// 检查 Svelte 组件编译器警告（修复时循环验证用）
// 用法：node scripts/check-svelte-warnings.mjs [文件]
import { readFileSync } from "node:fs";
import { compile } from "svelte/compiler";

const targets = process.argv.slice(2);
const ALL = [
	"src/components/controls/SearchModal.svelte",
	"src/components/controls/ArchivePanel.svelte",
	"src/components/comment/CommentSidebarMobile.svelte",
	"src/components/features/GuestbookChat.svelte",
	"src/components/features/GuestbookChatComposer.svelte",
	"src/components/features/LogoLoop.svelte",
	"src/components/features/music-visualizer/LyricsOverlay.svelte",
	"src/components/features/music-visualizer/ThreeScene.svelte",
	"src/components/features/music-visualizer/VisualizerControls.svelte",
];
const files = targets.length ? targets : ALL;

let total = 0;
for (const f of files) {
	const src = readFileSync(f, "utf8");
	const { warnings } = compile(src, { filename: f });
	if (warnings.length) {
		console.log(`=== ${f} ===`);
		for (const w of warnings) {
			const line = typeof w.start === "number" ? src.slice(0, w.start).split("\n").length : "?";
			console.log(`  [${line}:${w.code}] ${w.message.split("\n")[0].slice(0, 110)}`);
			total++;
		}
	}
}
console.log(`\n共 ${total} 条警告`);
