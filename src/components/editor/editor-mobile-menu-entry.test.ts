import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const componentPath = new URL(
	"./EditorMobileMenuEntry.svelte",
	import.meta.url,
);
const mobileMenuPath = new URL(
	"../layout/MobileMenuSheet.astro",
	import.meta.url,
);
const mobileDockPath = new URL("../layout/MobileDock.astro", import.meta.url);
const editorCssPath = new URL(
	"../../styles/components/editor.css",
	import.meta.url,
);

test("手机站长入口位于导航菜单底部，并从手机资料卡隐藏", () => {
	assert.equal(
		existsSync(componentPath),
		true,
		"应提供独立的手机导航菜单站长入口组件",
	);

	const component = readFileSync(componentPath, "utf8");
	const mobileMenu = readFileSync(mobileMenuPath, "utf8");
	const mobileDock = readFileSync(mobileDockPath, "utf8");
	const editorCss = readFileSync(editorCssPath, "utf8");

	assert.match(component, />GitHub 登录</u);
	assert.match(component, /href="\/admin"/u);
	assert.match(component, /openMomentCreate/u);
	assert.match(component, /editor\.logout/u);
	assert.match(component, /mobile-menu-sheet:close/u);

	// 2026-11-26 起登录对所有人开放：入口必须有「访客已登录」的第三态，
	// 而且那一态不能出现任何编辑入口
	assert.match(component, /\$editor\.loggedIn/u, "访客登录态要有独立分支");
	const guestBranch = component.split("$editor.loggedIn")[1] ?? "";
	assert.match(guestBranch, /editor-mobile-menu__me/u);
	assert.doesNotMatch(
		guestBranch.split("editor-mobile-menu__actions")[0] ?? "",
		/href="\/admin"/u,
		"访客态不该出现后台链接",
	);

	assert.match(
		mobileMenu,
		/<EditorMobileMenuEntry client:load \/>/u,
		"手机菜单弹窗底部应挂载站长入口",
	);
	assert.match(
		mobileDock,
		/mobile-menu-sheet:close/u,
		"手机菜单控制器应响应组件发出的关闭事件",
	);
	assert.match(
		editorCss,
		/@media \(max-width: 1023px\)[\s\S]*?\.nav-profile \.editor-nav--card[\s\S]*?display:\s*none/u,
		"手机端资料卡中的旧入口应隐藏",
	);
});
