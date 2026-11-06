import assert from "node:assert/strict";
import test from "node:test";

type GuestbookRouteModule = {
	GUESTBOOK_PAGE_PATH: string;
	GUESTBOOK_WALINE_PATH: string;
};

let routeModule: GuestbookRouteModule | undefined;
try {
	routeModule = await import("./guestbook-route.ts");
} catch {
	// RED 阶段允许模块尚不存在，下面的断言会明确失败。
}

test("留言板页面与 Waline 数据频道统一使用 /life/guestbook/", () => {
	assert.equal(routeModule?.GUESTBOOK_PAGE_PATH, "/life/guestbook/");
	assert.equal(routeModule?.GUESTBOOK_WALINE_PATH, "/life/guestbook/");
});
