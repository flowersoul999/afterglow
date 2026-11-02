<script lang="ts">
/**
 * 英语修行录的属性面板（带响应式刷新）—— 只算属性，不算修为。
 *
 * 结构和 MusicRecordPanel 完全一样（复制过来的，两张图以后可能各自演化）：
 *   · `$state` / `$derived` / `$effect` 只能在 .svelte 里跑，
 *     .astro 的 frontmatter 是纯 TS，写了类型检查直接报 ts(8010) / ts(2304)。
 *   · 数据源和 SkillTree 同源：同一个 localStorage 键（aemeath-english-tree）、
 *     同一份 EN_PRESET 兜底，所以面板和图上的水位不会一个亮一个不亮。
 *   · 属性规则复用 SkillTree.svelte 那套（每级 +1、勾满再 +2）。
 *
 * 刷新时机：SkillTree 传了 noCultivation，persist 里**不会**派发
 * aemeath-cultivation-changed，所以这里靠 focus / 切回标签页时重算。
 */
import { onMount } from "svelte";
import RecordPanel from "@/components/skills/RecordPanel.svelte";
import { EN_CHECKS } from "@/data/englishChecks";
import {
	EN_ATTRS,
	EN_GROUP_ATTR,
	EN_PRESET,
	EN_SKILLS,
	EN_TITLES,
} from "@/data/englishSkills";

const STORAGE_KEY = "aemeath-english-tree";
/** 属性点规则里的「勾满额外 +2」，与 SkillTree.svelte 的 ATTR_MAX_BONUS 一致 */
const ATTR_MAX_BONUS = 2;

/** 每个技能的等级上限 = 它自己的清单条数（与 SkillTree.capOf 同一套规则） */
function capOf(id: string): number {
	return EN_CHECKS[id]?.length ?? 5;
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
		for (const s of EN_SKILLS) {
			const v = rec[s.id];
			if (typeof v === "number")
				out[s.id] = Math.min(capOf(s.id), Math.max(0, v));
			else if (Array.isArray(v)) out[s.id] = Math.min(capOf(s.id), v.length);
		}
		return out;
	}
	// 没有存档（SSR / 新访客）：按出厂预设，英语这张图预设全 0
	for (const s of EN_SKILLS)
		out[s.id] = Math.min(capOf(s.id), EN_PRESET[s.id] ?? 0);
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
	for (const a of EN_ATTRS) {
		value[a.id] = 0;
		max[a.id] = 0;
	}
	let points = 0;
	let maxPoints = 0;
	let lit = 0;
	for (const s of EN_SKILLS) {
		const id = EN_GROUP_ATTR[s.group] ?? "vocab";
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
		[...EN_TITLES].reverse().find((t) => pct >= t.min) ?? EN_TITLES[0];
	return { value, max, lit, total: EN_SKILLS.length, title };
}

let st = $state<Snapshot>({
	value: {},
	max: {},
	lit: 0,
	total: EN_SKILLS.length,
	title: EN_TITLES[0],
});

function refresh() {
	st = compute();
}

refresh();
onMount(refresh);

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
	attrs={EN_ATTRS}
	stats={{ value: st.value, max: st.max }}
	mastered={{ lit: st.lit, total: st.total }}
	title={st.title}
	heading="英语修行录"
	note="这张图属于「修行录」：没有境界门禁，不计入修为，也不会给你发飞剑传书。它的进度只有上面四个属性 —— 背多少词不重要，能不能用出来才重要。"
/>
