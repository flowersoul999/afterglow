<script lang="ts">
/**
 * 音乐修行录的属性面板（带响应式刷新）—— 只算属性，不算修为。
 *
 * 为什么单独一个组件而不是写在 music.astro 里：
 * `$state` / `$derived` / `$effect` 只在 Svelte 组件里能跑，
 * .astro 的 frontmatter 是纯 TS，写了类型检查会直接报 ts(8010) / ts(2304)。
 *
 * 数据源和 SkillTree 完全同源：同一个 localStorage 键（aemeath-music-tree）、
 * 同一份 MU_PRESET 兜底，所以面板和图上的水位不会一个亮一个不亮。
 * 属性规则也复用 SkillTree.svelte 里那套（每级 +1、勾满再 +2），这里重算一遍。
 */
import { onMount } from "svelte";
import RecordPanel from "@/components/skills/RecordPanel.svelte";
import { MU_CHECKS } from "@/data/musicChecks";
import {
	MU_ATTRS,
	MU_GROUP_ATTR,
	MU_PRESET,
	MU_SKILLS,
	MU_TITLES,
} from "@/data/musicSkills";

const STORAGE_KEY = "aemeath-music-tree";
/** 属性点规则里的「勾满额外 +2」，与 SkillTree.svelte 的 ATTR_MAX_BONUS 保持一致 */
const ATTR_MAX_BONUS = 2;

/** 每个技能的等级上限 = 它自己的清单条数（与 SkillTree.capOf 同一套规则） */
function capOf(id: string): number {
	return MU_CHECKS[id]?.length ?? 5;
}

/** 某技能当前等级：存档里存的是「勾了哪几项」，长度就是等级；没有存档按出厂预设 */
function levelsOf(): Record<string, number> {
	const out: Record<string, number> = {};
	let stored: unknown = null;
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw) stored = JSON.parse(raw);
	} catch {
		stored = null;
	}
	if (stored != null && typeof stored === "object" && !Array.isArray(stored)) {
		const rec = stored as Record<string, unknown>;
		for (const s of MU_SKILLS) {
			const v = rec[s.id];
			if (typeof v === "number")
				out[s.id] = Math.min(capOf(s.id), Math.max(0, v));
			else if (Array.isArray(v)) out[s.id] = Math.min(capOf(s.id), v.length);
		}
		return out;
	}
	// 没有存档（SSR / 新访客）：按出厂预设，音乐这张图预设全 0
	for (const s of MU_SKILLS)
		out[s.id] = Math.min(capOf(s.id), MU_PRESET[s.id] ?? 0);
	return out;
}

interface Snapshot {
	value: Record<string, number>;
	max: Record<string, number>;
	lit: number;
	total: number;
	title: { name: string; note: string };
}

function compute(): Snapshot {
	const levels = levelsOf();
	const value: Record<string, number> = {};
	const max: Record<string, number> = {};
	for (const a of MU_ATTRS) {
		value[a.id] = 0;
		max[a.id] = 0;
	}
	let points = 0;
	let maxPoints = 0;
	let lit = 0;
	for (const s of MU_SKILLS) {
		const id = MU_GROUP_ATTR[s.group] ?? "ear";
		const lv = levels[s.id] ?? 0;
		const cap = capOf(s.id);
		if (cap > 0 && lv >= cap) lit += 1;
		value[id] += lv + (cap > 0 && lv >= cap ? ATTR_MAX_BONUS : 0);
		max[id] += cap + ATTR_MAX_BONUS;
		points += lv;
		maxPoints += cap;
	}
	const pct = maxPoints > 0 ? (points / maxPoints) * 100 : 0;
	const title =
		[...MU_TITLES].reverse().find((t) => pct >= t.min) ?? MU_TITLES[0];
	return { value, max, lit, total: MU_SKILLS.length, title };
}

let st = $state<Snapshot>({
	value: {},
	max: {},
	lit: 0,
	total: MU_SKILLS.length,
	title: MU_TITLES[0],
});

function refresh() {
	st = compute();
}

// 首屏 + 水合后各算一次
refresh();
onMount(refresh);

// SkillTree 勾选后写的是自己的 localStorage 键，而且修行录不会广播
// aemeath-cultivation-changed（noCultivation 挡住了 persist 里的派发）。
// 所以这里靠 focus / 切回标签页时重算：用户从图上勾完点别处再回来就同步了。
$effect(() => {
	window.addEventListener("focus", refresh);
	document.addEventListener("visibilitychange", refresh);
	return () => {
		window.removeEventListener("focus", refresh);
		document.removeEventListener("visibilitychange", refresh);
	};
});
</script>

<RecordPanel
	attrs={MU_ATTRS}
	stats={{ value: st.value, max: st.max }}
	mastered={{ lit: st.lit, total: st.total }}
	title={st.title}
	heading="音乐修行录"
	note="这张图属于「修行录」：没有境界门禁，不计入修为，也不会给你发飞剑传书。它的进度只有上面三个属性 —— 想练的是音乐本身，不是境界。"
/>
