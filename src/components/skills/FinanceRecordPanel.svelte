<script lang="ts">
/**
 * 理财修行录的属性面板（带响应式刷新）—— 只算属性，不算修为。
 *
 * 结构和 MusicRecordPanel / EnglishRecordPanel 一致（三张图各一份，别合并 ——
 * 以后它们可能各自演化，比如理财这张要加「净资产」这类专属统计）。
 *   · `$state` / `$derived` / `$effect` 只能在 .svelte 里跑，
 *     .astro 的 frontmatter 是纯 TS，写了类型检查直接报 ts(8010) / ts(2304)。
 *   · 数据源和 SkillTree 同源：同一个 localStorage 键（aemeath-finance-tree）、
 *     同一份 FN_PRESET 兜底，所以面板和图上的水位不会一个亮一个不亮。
 *   · 属性规则复用 SkillTree.svelte 那套（每级 +1、勾满再 +2）。
 *
 * 刷新时机：传了 noCultivation，persist 里不会派发 aemeath-cultivation-changed，
 * 所以靠 focus / 切回标签页时重算。
 */
import { onMount } from "svelte";
import RecordPanel from "@/components/skills/RecordPanel.svelte";
import { FN_CHECKS } from "@/data/financeChecks";
import {
	FN_ATTRS,
	FN_GROUP_ATTR,
	FN_PRESET,
	FN_SKILLS,
	FN_TITLES,
} from "@/data/financeSkills";

const STORAGE_KEY = "aemeath-finance-tree";
/** 属性点规则里的「勾满额外 +2」，与 SkillTree.svelte 的 ATTR_MAX_BONUS 一致 */
const ATTR_MAX_BONUS = 2;

/** 每个技能的等级上限 = 它自己的清单条数（与 SkillTree.capOf 同一套规则） */
function capOf(id: string): number {
	return FN_CHECKS[id]?.length ?? 5;
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
		for (const s of FN_SKILLS) {
			const v = rec[s.id];
			if (typeof v === "number")
				out[s.id] = Math.min(capOf(s.id), Math.max(0, v));
			else if (Array.isArray(v)) out[s.id] = Math.min(capOf(s.id), v.length);
		}
		return out;
	}
	// 没有存档（SSR / 新访客）：按出厂预设，理财这张图预设全 0
	for (const s of FN_SKILLS)
		out[s.id] = Math.min(capOf(s.id), FN_PRESET[s.id] ?? 0);
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
	for (const a of FN_ATTRS) {
		value[a.id] = 0;
		max[a.id] = 0;
	}
	let points = 0;
	let maxPoints = 0;
	let lit = 0;
	for (const s of FN_SKILLS) {
		const id = FN_GROUP_ATTR[s.group] ?? "sense";
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
		[...FN_TITLES].reverse().find((t) => pct >= t.min) ?? FN_TITLES[0];
	return { value, max, lit, total: FN_SKILLS.length, title };
}

let st = $state<Snapshot>({
	value: {},
	max: {},
	lit: 0,
	total: FN_SKILLS.length,
	title: FN_TITLES[0],
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
	attrs={FN_ATTRS}
	stats={{ value: st.value, max: st.max }}
	mastered={{ lit: st.lit, total: st.total }}
	title={st.title}
	heading="理财修行录"
	note="这张图属于「修行录」：没有境界门禁，不计入修为，也不会给你发飞剑传书 —— 钱不是修为。它的进度只有上面三个属性，而且这一张的清单大多是能对账的数字：储蓄率是几、储备几个月、费率多少、逾期几次。"
/>
