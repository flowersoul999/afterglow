/* 友链状态检测：逐个 fetch 友链 siteurl 测响应时间，输出 public/friends-status.json
   用法：node scripts/友链状态检测/index.mjs   （结果提交回仓库由 Action 完成） */

import fs from "node:fs";
import path from "node:path";

const FRIENDS_DIR = path.join(import.meta.dirname, "../../src/content/友链");

// 解析 frontmatter 的 siteurl（不引入 gray-matter，简单正则即可）
function readSiteurls() {
	const sites = [];
	for (const f of fs.readdirSync(FRIENDS_DIR).filter((x) => x.endsWith(".md"))) {
		const raw = fs.readFileSync(path.join(FRIENDS_DIR, f), "utf8");
		const m = raw.match(/^siteurl:\s*(.+)$/m);
		if (m) sites.push(m[1].trim().replace(/^["']|["']$/g, ""));
	}
	return sites;
}

// 分档阈值（ms）
const FAST = 800;
const SLOW = 3000;
const TIMEOUT = 8000;

async function check(url) {
	const start = performance.now();
	try {
		const res = await fetch(url, {
			method: "HEAD",
			redirect: "follow",
			signal: AbortSignal.timeout(TIMEOUT),
		});
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		const ms = Math.round(performance.now() - start);
		return { status: ms < FAST ? "fast" : ms < SLOW ? "ok" : "slow", ms };
	} catch {
		// HEAD 失败（部分站点不支持）→ 退化 GET
		try {
			const start2 = performance.now();
			const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(TIMEOUT) });
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const ms = Math.round(performance.now() - start2);
			return { status: ms < FAST ? "fast" : ms < SLOW ? "ok" : "slow", ms };
		} catch {
			return { status: "down", ms: null };
		}
	}
}

const sites = readSiteurls();
const out = { timestamp: new Date().toISOString(), sites: {} };
for (const url of sites) {
	out.sites[url] = await check(url);
	console.log(`${out.sites[url].status.padEnd(5)} ${String(out.sites[url].ms ?? "-").padStart(6)}ms  ${url}`);
}

const outPath = path.join(import.meta.dirname, "../../public/friends-status.json");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n");
console.log(`\n已写入 ${outPath}（${sites.length} 个站点）`);
