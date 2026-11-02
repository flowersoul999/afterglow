<script lang="ts">
/**
 * 通用技能图（前端 / 计算机基础 / 后端 / Agent 开发 共用）
 *
 * 形态：按「前置依赖」自动分层的技能图，不是树也不是清单。
 *   每一层的技术份量相同；方块上是真实技术 logo；
 *   连线 = requires 里声明的真实前置关系，全部从浅层指向深层，绝不乱指。
 *
 * 亮度：按「完成比例」用四重信号同时表达 —— 方块内的水位高度、logo 饱和度、
 *       描边亮度、勾满的外发光。一条没勾还会打斜纹并虚线描边。
 *       比例的分母就是该技能自己的清单条数，所以 3 条和 8 条读起来一样直观。
 *
 * 解锁：requires 里所有技能都 ≥1 级，本技能才可点。未解锁时点击会抖动并提示。
 *
 * 排列：层由依赖深度算出，层内顺序用「父节点序号的重心」迭代排序，尽量少交叉。
 *       位置交给 CSS 弹性布局，箭头在 DOM 渲染后实测坐标再画，所以任何屏宽都不会错位。
 */
import { onMount, tick } from "svelte";
// Astro 会把图片 import 转成 ImageMetadata 对象（{ src, width, height, format }）。
// 在 .astro 里 Astro 编译器会自动取 URL，但在 Svelte 里直接塞进 src 会渲染成 "[object Object]"，
// 所以这里必须自己取 .src。
import avatarMeta from "@/assets/images/jojo-avatar.webp";
import { profileConfig } from "@/config/profileConfig";
import {
	type GraphId,
	recordSlay,
	recordUnlearn,
	snapshot,
	unlockEgg,
} from "@/data/cultivation";
import { DWELL_STORY } from "@/data/cultivationStories";
import { earnChapterForSkill, syncMaxedSkills } from "@/data/saga";
import { SKILL_CHECKS as FE_CHECKS } from "@/data/skillChecks";
import {
	ATTR_MAP as FE_ATTR_MAP,
	ATTRS as FE_ATTRS,
	GROUP_ATTR as FE_GROUP_ATTR,
	GROUPS as FE_GROUPS,
	LEVELS as FE_LEVELS,
	MAX_LEVEL as FE_MAX_LEVEL,
	PRESET as FE_PRESET,
	SKILLS as FE_SKILLS,
	TOTAL_SKILLS as FE_TOTAL_SKILLS,
	type Skill,
} from "@/data/skills";
import {
	GROUP_COLORS as FE_GROUP_COLORS,
	TECH_ICONS as FE_TECH_ICONS,
	type IconState,
	iconColor as tintIcon,
} from "@/data/techIcons";
import { isMuted, playCombo, playSlay } from "@/lib/sfx";

/** 前端技能图的角色称号阶梯；别的图可以自己传一套 */
const FE_TITLES = [
	{ min: 0, name: "初识前端", note: "地基还没打完，慢慢来" },
	{ min: 10, name: "略有小成", note: "能照着文档做出东西了" },
	{ min: 25, name: "独当一面", note: "能扛需求，也能自己排错" },
	{ min: 40, name: "炉火纯青", note: "知道什么场景不该用什么" },
	{ min: 58, name: "一方宗师", note: "能带人，也能定规范" },
	{ min: 75, name: "登峰造极", note: "造轮子，影响一整个生态" },
];

/**
 * 这是一个「通用技能图」组件，站内几张图共用它（前端 / 计算机基础 / 后端 / Agent 开发）。
 * 下面的默认值就是前端技能图，所以 /skills/ 页面一行都不用改；
 * 想开新图，照着 src/data/csSkills.ts 备一套数据传进来即可。
 *
 * 等级不再固定 0-5：**每个技能的等级上限 = 它自己的学习清单条数**
 * （简单概念 3 条、硬核概念 8 条都行），所以技能点、水位比例、属性上限全部现算。
 */
let {
	skills: SKILLS = FE_SKILLS,
	groups: GROUPS = FE_GROUPS,
	attrs: ATTRS = FE_ATTRS,
	groupAttr: GROUP_ATTR = FE_GROUP_ATTR,
	attrMap: ATTR_MAP = FE_ATTR_MAP,
	levels: LEVELS = FE_LEVELS,
	/** 只作兜底：技能没配清单时按它算上限 */
	maxLevel: MAX_LEVEL = FE_MAX_LEVEL,
	checks: SKILL_CHECKS = FE_CHECKS,
	preset: PRESET = FE_PRESET,
	totalSkills: TOTAL_SKILLS = FE_TOTAL_SKILLS,
	icons: TECH_ICONS = FE_TECH_ICONS,
	groupColors: GROUP_COLORS = FE_GROUP_COLORS,
	storageKey: STORAGE_KEY = "aemeath-skill-tree",
	/** 图的大标题 */
	heading: HEADING = "前端技能图",
	/** 角色称号阶梯：按总掌握度百分比给 */
	titles: TITLES = FE_TITLES,
	/**
	 * 修行录开关：**不入门禁、不加修为、不发传书、不领话本签**。
	 *
	 * 用于英语 / 理财 / 睡眠 / 音乐这类图 —— 它们和四张修行路图没有先后关系，
	 * 硬塞进境界链会出现「背完单词但没结丹所以英语图不让我进」的荒谬门禁。
	 * 传 true 后：跳过 recordSlay / recordUnlearn / earnChapterForSkill / syncMaxedSkills，
	 * 只保留属性点、勾选、音效、飘字与页面内的一切交互（属性点才是这类图的唯一进度）。
	 */
	noCultivation: NO_CULTIVATION = false,
} = $props();

/** 由 storageKey 反推这是哪张修行图（recordSlay 需要它来算修为/剧情） */
const KEY_TO_GRAPH: Record<string, GraphId> = {
	"aemeath-cs-tree": "cs",
	"aemeath-skill-tree": "fe",
	"aemeath-backend-tree": "be",
	"aemeath-agent-tree": "ag",
	"aemeath-music-tree": "mu",
	"aemeath-english-tree": "en",
	"aemeath-finance-tree": "fn",
};
/** 修行录图的图 id：只用来做存储键反查，不参与任何修为/境界计算 */
const currentGraph: GraphId = KEY_TO_GRAPH[STORAGE_KEY] ?? "cs";

/** 修行录图的飘字：没有修为可给，改成给属性点，动词也从修行路那套里借 */
function attrPop(el: HTMLElement, skill: Skill) {
	const id = GROUP_ATTR[skill.group] ?? "dex";
	const lv = (done[skill.id] ?? []).length;
	const gain = lv + (lv >= capOf(skill.id) ? 2 : 0);
	const a = ATTR_MAP[id];
	spawnXp(el, gain, a?.short ?? "点", skill.short, false);
}

/** 图标配色：把这张图自己的图标表与方向配色喂进去 */
function iconColor(id: string, group: string, state: IconState, dark: boolean) {
	return tintIcon(id, group, state, dark, TECH_ICONS, GROUP_COLORS);
}

const avatarUrl = avatarMeta.src;
const SKILL_MAP: Record<string, Skill> = Object.fromEntries(
	SKILLS.map((s) => [s.id, s]),
);
const GROUP_MAP: Record<string, (typeof GROUPS)[number]> = Object.fromEntries(
	GROUPS.map((g) => [g.id, g]),
);

/** 每个方向有多少个技能 —— 用来算方向的满点上限与平均值 */
const GROUP_SIZE: Record<string, number> = (() => {
	const m: Record<string, number> = {};
	for (const s of SKILLS) m[s.group] = (m[s.group] ?? 0) + 1;
	return m;
})();

/* ===================== 图结构（静态，只算一次） ===================== */

/** 反向索引：谁依赖我 */
const CHILDREN: Record<string, string[]> = {};
for (const s of SKILLS) {
	for (const r of s.requires) {
		if (!CHILDREN[r]) CHILDREN[r] = [];
		CHILDREN[r].push(s.id);
	}
}

/** 依赖深度：没有前置就是第 0 层 */
const DEPTH: Record<string, number> = (() => {
	const memo: Record<string, number> = {};
	const calc = (id: string): number => {
		if (memo[id] !== undefined) return memo[id];
		memo[id] = 0;
		const req = SKILL_MAP[id]?.requires ?? [];
		memo[id] = req.length === 0 ? 0 : Math.max(...req.map(calc)) + 1;
		return memo[id];
	};
	for (const s of SKILLS) calc(s.id);
	return memo;
})();

const ROW_COUNT = Math.max(...Object.values(DEPTH)) + 1;

/**
 * 分层 + 层内排序。
 * 上下各扫一遍、用「父 / 子节点在本层的序号重心」重排，反复几轮把连线交叉压下来。
 * 版式因此完全由依赖关系决定，加一条 requires 就会自己长出新的一层。
 */
const ROWS: Skill[][] = (() => {
	const rows: Skill[][] = Array.from({ length: ROW_COUNT }, () => []);
	for (const s of SKILLS) rows[DEPTH[s.id]].push(s);
	const pos = new Map<string, number>();
	const sync = () => {
		for (const r of rows) {
			r.forEach((s, i) => {
				pos.set(s.id, i);
			});
		}
	};
	sync();
	for (let pass = 0; pass < 8; pass++) {
		const down = pass % 2 === 0;
		const seq = rows.map((_, i) => i);
		if (!down) seq.reverse();
		for (const ri of seq) {
			const row = rows[ri];
			const bary = (s: Skill) => {
				const refs = down ? s.requires : (CHILDREN[s.id] ?? []);
				if (refs.length === 0) return pos.get(s.id) ?? 0;
				let sum = 0;
				for (const id of refs) sum += pos.get(id) ?? 0;
				return sum / refs.length;
			};
			const scored = row.map((s, i) => ({ s, b: bary(s), i }));
			scored.sort((a, b) => a.b - b.b || a.i - b.i);
			rows[ri] = scored.map((x) => x.s);
			sync();
		}
	}
	return rows;
})();

/** 全部连线：from 是前置，to 是后置 */
const EDGES = SKILLS.flatMap((s) =>
	s.requires.map((r) => ({ from: r, to: s.id })),
);

/** 给每条线分配 3 条横向轨道之一，避免所有折线的横段叠在一起 */
const TRACK: Record<string, number> = Object.fromEntries(
	EDGES.map((e, i) => [`${e.from}>${e.to}`, i % 3]),
);

/**
 * 每个方块给一点纵向错位，打散「一层一条直线」的网格感。
 * 幅度控制在 ±10px，不会串层；箭头是渲染后实测坐标画的，所以错位不影响连线精度。
 */
const JITTER: Record<string, number> = Object.fromEntries(
	SKILLS.map((s) => {
		let h = 0;
		for (let i = 0; i < s.id.length; i++)
			h = (h * 31 + s.id.charCodeAt(i)) % 9973;
		return [s.id, (h % 21) - 10];
	}),
);

/* ===================== 学习进度 ===================== */
/**
 * 进度模型：每个技能有 5 个学习项，「已勾选的项索引」是唯一的状态源。
 *   技能等级 = 已勾选数（0-5）—— 勾一项涨一级，勾满就是 Lv5。
 * 不直接存等级数字，是为了让「单独取消某一项」这种操作精确可逆。
 */
const PRESET_DONE: Record<string, number[]> = Object.fromEntries(
	SKILLS.map((s) => {
		const n = Math.min(totalOf(s.id), Math.max(0, PRESET[s.id] ?? 0));
		return [s.id, Array.from({ length: n }, (_, i) => i)];
	}),
);

let done = $state<Record<string, number[]>>({ ...PRESET_DONE });

/** 这个技能有几项可勾 */
function totalOf(id: string): number {
	return SKILL_CHECKS[id]?.length ?? 0;
}

function checksOf(id: string): [string, string][] {
	return SKILL_CHECKS[id] ?? [];
}

/**
 * 这个技能的等级上限 = 它自己的清单条数。
 * 清单没配的技能兜底用 maxLevel（正常数据不会走到这儿，自检脚本会拦住）。
 */
function capOf(id: string): number {
	return totalOf(id) || MAX_LEVEL;
}

/**
 * 等级称号按「完成比例」取，而不是按绝对级数：
 * 清单 3 条和 8 条的人读到的是同一套称号，勾满就是 LEVELS 的最后一档（精通）。
 */
function levelTier(id: string, lv: number): number {
	const cap = capOf(id);
	if (lv <= 0) return 0;
	if (lv >= cap) return MAX_LEVEL - 1;
	const r = lv / cap;
	if (r < 0.4) return 1;
	if (r < 0.7) return 2;
	return 3;
}

/** 全部技能的清单都勾满能有多少技能点 */
const MAX_POINTS = SKILLS.reduce((n, s) => n + capOf(s.id), 0);

/** 每个方向的满点上限 = 方向内所有技能的清单条数之和 —— 用来算方向进度条 */
const GROUP_MAX: Record<string, number> = (() => {
	const m: Record<string, number> = {};
	for (const s of SKILLS) m[s.group] = (m[s.group] ?? 0) + capOf(s.id);
	return m;
})();

/** 等级 = 已勾选数（上限是这个技能自己的清单条数），面板、水位、连线、属性全从这里读 */
const levels = $derived.by(() => {
	const m: Record<string, number> = {};
	for (const s of SKILLS)
		m[s.id] = Math.min(capOf(s.id), (done[s.id] ?? []).length);
	return m;
});

function persist() {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(done));
		// 广播给修仙面板 / 结界：修为变了，境界可能升（或解锁新图）
		// 修行录图不改修为，别去惊动境界面板。
		if (!NO_CULTIVATION)
			window.dispatchEvent(new CustomEvent("aemeath-cultivation-changed"));
	} catch {
		/* 隐私模式下写不进去也无所谓 */
	}
}

/** 归一化：去重、排序、丢掉越界索引 */
function clean(list: unknown, total: number): number[] {
	if (!Array.isArray(list)) return [];
	const set = new Set<number>();
	for (const v of list) {
		const i = Math.round(Number(v));
		if (Number.isFinite(i) && i >= 0 && i < total) set.add(i);
	}
	return [...set].sort((a, b) => a - b);
}

/**
 * 读取本地进度，认三种格式：
 *   新：{ id: [0,1,2] }  已勾选的项索引
 *   旧：{ id: 3 }        等级数字 → 换算成「勾了前 3 项」
 *   更早：[id, ...]      已点亮的 id 列表 → 每个按 2 级算
 */
function readStored() {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return;
		const parsed: unknown = JSON.parse(raw);
		const next: Record<string, number[]> = {};
		if (Array.isArray(parsed)) {
			const ids = new Set(SKILLS.map((s) => s.id));
			for (const id of parsed)
				if (typeof id === "string" && ids.has(id))
					next[id] = clean([0, 1], totalOf(id));
		} else if (parsed && typeof parsed === "object") {
			for (const s of SKILLS) {
				const v = (parsed as Record<string, unknown>)[s.id];
				if (Array.isArray(v)) {
					next[s.id] = clean(v, totalOf(s.id));
				} else if (typeof v === "number") {
					const n = Math.min(totalOf(s.id), Math.max(0, Math.round(v)));
					next[s.id] = Array.from({ length: n }, (_, i) => i);
				}
			}
		}
		if (Object.keys(next).length) done = next;
	} catch {
		/* 数据坏了就用预设 */
	}
}

/* ===================== 主题 ===================== */
let dark = $state(false);

/* ===================== 布局测量 ===================== */
type Box = { x: number; y: number; w: number; h: number };
let canvasEl = $state<HTMLDivElement | null>(null);
let scrollEl = $state<HTMLDivElement | null>(null);
let overflowing = $state(false);
let boxes = $state<Record<string, Box>>({});
let canvasSize = $state({ w: 0, h: 0 });

function measure() {
	const el = canvasEl;
	if (!el) return;
	const base = el.getBoundingClientRect();
	const next: Record<string, Box> = {};
	for (const tile of el.querySelectorAll<HTMLElement>("[data-id]")) {
		const r = tile.getBoundingClientRect();
		next[tile.dataset.id as string] = {
			x: r.left - base.left,
			y: r.top - base.top,
			w: r.width,
			h: r.height,
		};
	}
	boxes = next;
	canvasSize = { w: base.width, h: base.height };
	if (scrollEl) overflowing = scrollEl.scrollWidth > scrollEl.clientWidth + 1;
}

/* ===================== 交互状态 ===================== */
let hoverId = $state<string | null>(null);
let shakeId = $state<string | null>(null);
let toast = $state("");
/** 本页是否产生过至少一次修行（入定彩蛋判定用） */
let didSlay = false;
let rootEl = $state<HTMLDivElement | null>(null);

/* ---------- 修行动作反馈：飘字 + 连悟横幅 ---------- */
let xpFloats = $state<
	{
		key: number;
		x: number;
		y: number;
		amount: number;
		verb: string;
		title: string;
		isSecret: boolean;
	}[]
>([]);
let comboFlash = $state<{ n: number; tier: string | null; key: number } | null>(
	null,
);
let fxKey = 0;

function spawnXp(
	el: HTMLElement,
	amount: number,
	verb: string,
	title: string,
	isSecret: boolean,
) {
	const r = el.getBoundingClientRect();
	const base = rootEl?.getBoundingClientRect();
	const key = ++fxKey;
	xpFloats = [
		...xpFloats,
		{
			key,
			x: r.left - (base?.left ?? 0) + r.width / 2,
			y: r.top - (base?.top ?? 0) + r.height / 2,
			amount,
			verb,
			title,
			isSecret,
		},
	];
	setTimeout(() => {
		xpFloats = xpFloats.filter((f) => f.key !== key);
	}, 1100);
}

function spawnCombo(n: number, tier: string | null) {
	const key = ++fxKey;
	comboFlash = { n, tier, key };
	setTimeout(() => {
		if (comboFlash && comboFlash.key === key) comboFlash = null;
	}, 1200);
}

/* ---------- 悬停浮层：跟着方块走，永远不出屏 ---------- */
let tipEl = $state<HTMLDivElement | null>(null);
let tipPos = $state({ x: 0, y: 0, above: false, ready: false });

/**
 * 找 position:fixed 的「包含块」。
 * 主题的 #content-wrapper 上有 transform: translateZ(0)（GPU 合成用），
 * 只要祖先里有一个 transform / filter / will-change，fixed 就不再相对视口定位，
 * 而是相对那个祖先。这里把祖先的矩形算出来，后面统一换算，位置才不会偏。
 */
function fixedContainingBlock(el: HTMLElement | null) {
	let p = el?.parentElement ?? null;
	while (p && p !== document.body && p !== document.documentElement) {
		const cs = getComputedStyle(p);
		if (
			cs.transform !== "none" ||
			cs.filter !== "none" ||
			cs.perspective !== "none" ||
			cs.willChange === "transform" ||
			cs.contain.includes("paint") ||
			cs.contain.includes("layout")
		) {
			const r = p.getBoundingClientRect();
			return { x: r.left, y: r.top, w: r.width, h: r.height };
		}
		p = p.parentElement;
	}
	return { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight };
}

function placeTip() {
	const el = canvasEl;
	const id = hoverId;
	if (!el || !id) {
		tipPos = { ...tipPos, ready: false };
		return;
	}
	const tile = el.querySelector<HTMLElement>(`.sk-tile[data-id="${id}"]`);
	if (!tile) {
		tipPos = { ...tipPos, ready: false };
		return;
	}
	const r = tile.getBoundingClientRect();
	const w = tipEl?.offsetWidth || 276;
	const h = tipEl?.offsetHeight || 250;

	// 坐标统一换算到「包含块坐标系」里。
	// 注意要从浮层自身往上找，不能从方块往上找 —— 方块所在的 .sk-cell 悬停时
	// 有 translateY(-3px)，那是方块的包含块，跟浮层完全无关。
	const cb = fixedContainingBlock(tipEl ?? el);
	const left = r.left - cb.x;
	const top = r.top - cb.y;
	const bottom = r.bottom - cb.y;
	// 包含块可能比视口大，可视区间取两者交集
	const visTop = Math.max(0, cb.y) - cb.y;
	const visBottom = Math.min(window.innerHeight, cb.y + cb.h) - cb.y;
	const visLeft = Math.max(0, cb.x) - cb.x;
	const visRight = Math.min(window.innerWidth, cb.x + cb.w) - cb.x;
	const gap = 12;
	const pad = 10;

	// 默认挂下方；下方放不下就翻到上方；上下都放不下就夹在可视区里
	let above = false;
	let y = bottom + gap;
	if (y + h > visBottom - pad) {
		above = true;
		y = top - gap - h;
	}
	if (y < visTop + pad) {
		above = false;
		y = Math.max(visTop + pad, Math.min(visBottom - h - pad, bottom + gap));
	}

	const minX = visLeft + pad;
	const maxX = visRight - w - pad;
	const x = Math.max(
		minX,
		Math.min(left + r.width / 2 - w / 2, Math.max(minX, maxX)),
	);

	tipPos = { x, y, above, ready: true };
}

/** 悬停目标、等级、滚动、缩放任何一种变化，浮层都要重新贴位 */
$effect(() => {
	void hoverId;
	void levels;
	void tipEl;
	if (!hoverId) return;
	tick().then(() => placeTip());
});

/** 悬浮时点亮的整条链路：自己 + 所有前置 + 所有后置 */
const focusSet = $derived.by(() => {
	const set = new Set<string>();
	if (!hoverId) return set;
	set.add(hoverId);
	const up = [...(SKILL_MAP[hoverId]?.requires ?? [])];
	while (up.length) {
		const c = up.pop() as string;
		if (set.has(c)) continue;
		set.add(c);
		up.push(...(SKILL_MAP[c]?.requires ?? []));
	}
	const down = [...(CHILDREN[hoverId] ?? [])];
	while (down.length) {
		const c = down.pop() as string;
		if (set.has(c)) continue;
		set.add(c);
		down.push(...(CHILDREN[c] ?? []));
	}
	return set;
});

/* ===================== 派生数据 ===================== */
function stateOf(s: Skill): "locked" | "ready" | "learning" | "max" {
	if (!s.requires.every((r) => (levels[r] ?? 0) > 0)) return "locked";
	const lv = levels[s.id] ?? 0;
	if (lv >= capOf(s.id)) return "max";
	if (lv > 0) return "learning";
	return "ready";
}

/**
 * 图标配色只分三态：有点数 → 鲜艳品牌色；没点数 → 灰（锁定态更淡）。
 * 灰是刻意的：一眼就能看出哪些学了、哪些没学。
 */
function iconState(s: Skill): IconState {
	if ((levels[s.id] ?? 0) > 0) return "lit";
	return stateOf(s) === "locked" ? "locked" : "unlit";
}

const stats = $derived.by(() => {
	const groupPoints: Record<string, number> = {};
	const groupMaxed: Record<string, number> = {};
	let points = 0;
	let lit = 0;
	let maxed = 0;
	let untouched = 0;
	for (const s of SKILLS) {
		const lv = levels[s.id] ?? 0;
		points += lv;
		if (lv > 0) lit++;
		if (lv >= capOf(s.id)) maxed++;
		if (lv < 3) untouched++;
		groupPoints[s.group] = (groupPoints[s.group] ?? 0) + lv;
		if (lv >= capOf(s.id)) groupMaxed[s.group] = (groupMaxed[s.group] ?? 0) + 1;
	}
	const pct = Math.round((points / MAX_POINTS) * 100);
	let title = TITLES[0];
	for (const t of TITLES) if (pct >= t.min) title = t;
	return {
		points,
		lit,
		maxed,
		untouched,
		pct,
		title,
		groupPoints,
		groupMaxed,
		litGroups: GROUPS.filter((g) => (groupPoints[g.id] ?? 0) > 0).length,
		maxedGroups: GROUPS.filter((g) => (groupMaxed[g.id] ?? 0) > 0).length,
	};
});

/* ===================== 角色属性 ===================== */

/**
 * 属性点规则（只在这里定义）：
 *   每升 1 级 → 所属方向的属性 +1；把这个技能的清单全部勾完，再额外 +2。
 */
function attrIdOf(s: Skill): string {
	return GROUP_ATTR[s.group] ?? "dex";
}

/** 这个技能当前贡献了多少属性点 */
function attrGain(s: Skill): number {
	const lv = levels[s.id] ?? 0;
	return lv + (lv >= capOf(s.id) ? 2 : 0);
}

/** 满级后再多给多少 —— 提示浮层里要显示 */
const ATTR_MAX_BONUS = 2;

const attrStats = $derived.by(() => {
	const value: Record<string, number> = {};
	const max: Record<string, number> = {};
	const count: Record<string, number> = {};
	const maxed: Record<string, number> = {};
	for (const a of ATTRS) {
		value[a.id] = 0;
		max[a.id] = 0;
		count[a.id] = 0;
		maxed[a.id] = 0;
	}
	for (const s of SKILLS) {
		const id = attrIdOf(s);
		const lv = levels[s.id] ?? 0;
		count[id] = (count[id] ?? 0) + 1;
		max[id] = (max[id] ?? 0) + capOf(s.id) + ATTR_MAX_BONUS;
		value[id] = (value[id] ?? 0) + attrGain(s);
		if (lv >= capOf(s.id)) maxed[id] = (maxed[id] ?? 0) + 1;
	}
	return { value, max, count, maxed };
});

/** 连线：起点是前置方块底边中心，终点是后置方块顶边中心，中间走直角折线 */
const wires = $derived.by(() => {
	const out: {
		key: string;
		d: string;
		head: string;
		state: "on" | "half" | "off";
		hot: boolean;
		dim: boolean;
	}[] = [];
	for (const e of EDGES) {
		const p = boxes[e.from];
		const c = boxes[e.to];
		if (!p || !c) continue;
		const x1 = p.x + p.w / 2;
		const y1 = p.y + p.h;
		const x2 = c.x + c.w / 2;
		const y2 = c.y;
		const dy = y2 - y1;
		if (dy <= 3) continue;
		const t = [0.36, 0.5, 0.64][TRACK[`${e.from}>${e.to}`] ?? 0];
		const ym = y1 + dy * t;
		let d: string;
		if (Math.abs(x2 - x1) < 6) {
			d = `M ${x1} ${y1} V ${y2}`;
		} else {
			const dir = Math.sign(x2 - x1);
			const r = Math.min(9, Math.abs(x2 - x1) / 2, dy / 3);
			d =
				`M ${x1} ${y1} V ${ym - r} Q ${x1} ${ym} ${x1 + dir * r} ${ym}` +
				` H ${x2 - dir * r} Q ${x2} ${ym} ${x2} ${ym + r} V ${y2}`;
		}
		const fromLv = levels[e.from] ?? 0;
		const toLv = levels[e.to] ?? 0;
		const hot = focusSet.has(e.from) && focusSet.has(e.to);
		out.push({
			key: `${e.from}>${e.to}`,
			d,
			head: `M ${x2 - 4.4} ${y2 - 6.2} L ${x2} ${y2} L ${x2 + 4.4} ${y2 - 6.2}`,
			state: fromLv > 0 && toLv > 0 ? "on" : fromLv > 0 ? "half" : "off",
			hot,
			dim: !!hoverId && !hot,
		});
	}
	return out;
});

const active = $derived(hoverId ? SKILL_MAP[hoverId] : null);
const dirty = $derived(
	SKILLS.some(
		(s) => (done[s.id] ?? []).join(",") !== PRESET_DONE[s.id].join(","),
	),
);

/* ===================== 操作 ===================== */
function flash(msg: string) {
	toast = msg;
	setTimeout(() => {
		if (toast === msg) toast = "";
	}, 2600);
}

/** 前置没点亮就抖一下并提示；返回 true 表示这次操作被拦下了 */
function blocked(s: Skill): boolean {
	if (stateOf(s) !== "locked") return false;
	const missing = s.requires.filter((r) => (levels[r] ?? 0) <= 0);
	shakeId = s.id;
	setTimeout(() => {
		if (shakeId === s.id) shakeId = null;
	}, 480);
	flash(`先点亮：${missing.map((r) => SKILL_MAP[r]?.short ?? r).join(" · ")}`);
	return true;
}

function writeDone(id: string, list: number[]) {
	const cap = capOf(id);
	const before = Math.min(cap, (done[id] ?? []).length);
	done = { ...done, [id]: list };
	persist();
	// 「彻底点亮一个技能」= 勾满它自己的清单 → 挣得话本的下一回（幂等）
	// 修行录图不领签：话本共 240 回，软技能往里塞只会打乱主线回目的发放节奏。
	if (!NO_CULTIVATION && cap > 0 && list.length >= cap && before < cap)
		earnChapterForSkill(currentGraph, id);
}

/** 勾上 / 取消某一项 —— 弹窗里逐项点的就是这个 */
function toggle(s: Skill, i: number, el?: EventTarget | null) {
	if (blocked(s)) return;
	const cur = done[s.id] ?? [];
	if (cur.includes(i)) {
		writeDone(
			s.id,
			cur.filter((x) => x !== i),
		);
		// 取消 = 道心小劫 / 心猿意马 等彩蛋判定（修行录图不参与）
		if (!NO_CULTIVATION) recordUnlearn(currentGraph, s.id);
		return;
	}
	const label = checksOf(s.id)[i]?.[0] ?? s.short;
	if (NO_CULTIVATION) {
		// 修行录：没有修为可给，给的是这一项对应方向的属性点
		writeDone(
			s.id,
			[...cur, i].sort((a, b) => a - b),
		);
		didSlay = true;
		if (el instanceof HTMLElement) {
			attrPop(el, s);
			el.classList.add("sk-check-slain");
			setTimeout(() => el.classList.remove("sk-check-slain"), 600);
		}
		playSlay();
		return;
	}
	const beforeRealm = snapshot().realmIndex;
	writeDone(
		s.id,
		[...cur, i].sort((a, b) => a - b),
	);
	// 这一次「修行」：给修为、记日志、连悟、触发隐藏剧情
	const res = recordSlay({
		graph: currentGraph,
		skillId: s.id,
		index: i,
		title: label,
		beforeRealm,
	});
	didSlay = true;
	if (el instanceof HTMLElement) {
		spawnXp(el, res.xpGained, res.action, label, res.isSecret);
		el.classList.add("sk-check-slain");
		setTimeout(() => el.classList.remove("sk-check-slain"), 600);
	}
	playSlay();
	if (res.combo >= 2) {
		spawnCombo(res.combo, res.comboTier);
		playCombo(res.combo);
	}
}

/** 左键：按从易到难的顺序勾下一项（已经中间挖空时，优先补上第一个空位） */
function stepUp(s: Skill) {
	if (blocked(s)) return;
	const cur = done[s.id] ?? [];
	const total = totalOf(s.id);
	if (total === 0) return;
	const free = Array.from({ length: total }, (_, i) => i).find(
		(i) => !cur.includes(i),
	);
	if (free === undefined) {
		flash(`${s.short} 的 ${total} 项已经全部学完了`);
		return;
	}
	writeDone(
		s.id,
		[...cur, free].sort((a, b) => a - b),
	);
}

/** 右键：退掉最后勾上的那一项 */
function stepDown(s: Skill) {
	const cur = done[s.id] ?? [];
	if (!cur.length) return;
	writeDone(
		s.id,
		cur.filter((x) => x !== Math.max(...cur)),
	);
	// 退掉 = 道心 / 心猿意马 彩蛋判定（修行录图不参与）
	if (!NO_CULTIVATION) recordUnlearn(currentGraph, s.id);
}

function resetToPreset() {
	done = Object.fromEntries(SKILLS.map((s) => [s.id, [...PRESET_DONE[s.id]]]));
	persist();
	flash("已恢复出厂预设");
}

function clearAll() {
	done = Object.fromEntries(SKILLS.map((s) => [s.id, []]));
	persist();
	flash("已全部清零，从头再来");
}

/* ===================== 学习清单弹窗 ===================== */
/**
 * 用原生 <dialog> + showModal()：它会渲染到 top layer，
 * 不受主题 #content-wrapper 上那个 transform 的影响（fixed 定位会受影响，dialog 不会），
 * 顺带白拿焦点循环、ESC 关闭和 ::backdrop。
 */
let openId = $state<string | null>(null);
let dialogEl = $state<HTMLDialogElement | null>(null);
const openSkill = $derived(openId ? (SKILL_MAP[openId] ?? null) : null);

function openPanel(s: Skill) {
	if (blocked(s)) return;
	if (openId === s.id && dialogEl?.open) return;
	openId = s.id;
	tick().then(() => {
		if (!dialogEl?.open) dialogEl?.showModal();
	});
}

function closePanel() {
	dialogEl?.close();
}

/* ===================== 生命周期 ===================== */
function scheduleMeasure() {
	requestAnimationFrame(() => measure());
}

onMount(() => {
	dark = document.documentElement.classList.contains("dark");
	const mo = new MutationObserver(() => {
		dark = document.documentElement.classList.contains("dark");
	});
	mo.observe(document.documentElement, {
		attributes: true,
		attributeFilter: ["class"],
	});

	readStored();
	scheduleMeasure();

	// 存量补课：进页面时已经满级的技能，把对应章节一次性记为「已挣得」
	// （发放仍是一次一回，由 pumpSaga 保证顺序，不会灌屏）
	// 修行录图不领签也不发飞剑传书，压根不碰这套。
	if (!NO_CULTIVATION) {
		const alreadyMaxed = SKILLS.filter(
			(s) => (done[s.id] ?? []).length >= capOf(s.id) && capOf(s.id) > 0,
		).map((s) => s.id);
		if (alreadyMaxed.length) syncMaxedSkills(currentGraph, alreadyMaxed);
	}

	const ro = new ResizeObserver(() => measure());
	const el = canvasEl;
	if (el) {
		ro.observe(el);
		for (const child of el.children) ro.observe(child);
	}
	window.addEventListener("resize", scheduleMeasure);
	// 浮层用的是包含块坐标，页面或技能图一滚就得重新贴位；用 rAF 节流，别每个事件都算
	let tipRaf = 0;
	const onScroll = () => {
		if (!hoverId || tipRaf) return;
		tipRaf = requestAnimationFrame(() => {
			tipRaf = 0;
			placeTip();
		});
	};
	window.addEventListener("scroll", onScroll, true);
	window.addEventListener("resize", onScroll);
	document.fonts?.ready.then(() => measure()).catch(() => {});

	// 入定彩蛋：单页停留满 5 分钟且有过修行 → 触发一次（修行录图不发飞剑传书）
	const dwellTimer = setTimeout(
		() => {
			if (didSlay && !NO_CULTIVATION) unlockEgg(DWELL_STORY);
		},
		5 * 60 * 1000,
	);

	return () => {
		mo.disconnect();
		ro.disconnect();
		window.removeEventListener("resize", scheduleMeasure);
		window.removeEventListener("scroll", onScroll, true);
		window.removeEventListener("resize", onScroll);
		if (tipRaf) cancelAnimationFrame(tipRaf);
		clearTimeout(dwellTimer);
	};
});

/** 渲染完成后再量一次，箭头才跟得上布局 */
$effect(() => {
	void canvasEl;
	void ROWS;
	scheduleMeasure();
});
</script>

<div class="sk-root" bind:this={rootEl}>
	<!-- ===================== 头部 ===================== -->
	<header class="sk-head">
		<div class="sk-head-l">
			<p class="sk-eyebrow">SKILL GRAPH</p>
			<h2 class="sk-title">{HEADING}</h2>
			<p class="sk-desc">
				每一层的技术份量相同，方块上是真实的技术 logo。连线代表真实的前置关系——
				上面点亮了，下面才解锁。<b>左键点方块</b>会打开它的学习清单，一项项勾，
				勾一项涨一级；悬停可以看到它的整条学习链路。
			</p>
		</div>
		<div class="sk-stats">
			<div class="sk-stat">
				<span class="sk-stat-num">{stats.points}<em>/{MAX_POINTS}</em></span>
				<span class="sk-stat-cap">技能点</span>
			</div>
			<div class="sk-stat">
				<span class="sk-stat-num">{stats.pct}<em>%</em></span>
				<span class="sk-stat-cap">总掌握度</span>
			</div>
			<div class="sk-stat">
				<span class="sk-stat-num">{stats.lit}<em>/{TOTAL_SKILLS}</em></span>
				<span class="sk-stat-cap">已点亮</span>
			</div>
			<div class="sk-stat">
				<span class="sk-stat-num">{stats.litGroups}<em>/{GROUPS.length}</em></span>
				<span class="sk-stat-cap">已开启方向</span>
			</div>
		</div>
	</header>

	<!-- ===================== 图例 + 操作 ===================== -->
	<div class="sk-bar">
		<ul class="sk-legend">
			<li class="is-locked"><i></i>未解锁</li>
			<li class="is-ready"><i></i>可开始</li>
			<li class="is-learning"><i></i>学习中</li>
			<li class="is-max"><i></i>已精通</li>
			<li class="is-wire"><i></i>前置已打通</li>
		</ul>
		<div class="sk-acts">
			<button class="sk-act" disabled={!dirty} onclick={resetToPreset}>恢复预设</button>
			<button class="sk-act" onclick={clearAll}>全部清零</button>
		</div>
	</div>

	<!-- ===================== 技能图 ===================== -->
	<div class="sk-stage">
		<div class="sk-scroll" bind:this={scrollEl}>
			<div class="sk-canvas" bind:this={canvasEl}>
				<svg
					class="sk-wires"
					width={canvasSize.w}
					height={canvasSize.h}
					viewBox={`0 0 ${canvasSize.w} ${canvasSize.h}`}
					aria-hidden="true"
				>
					{#each wires as w (w.key)}
						<g
							class="sk-wire"
							class:on={w.state === "on"}
							class:half={w.state === "half"}
							class:hot={w.hot}
							class:dim={w.dim}
						>
							<path class="sk-wire-track" d={w.d}></path>
							<path class="sk-wire-glow" d={w.d}></path>
							<path class="sk-wire-line" d={w.d}></path>
							<path class="sk-wire-head" d={w.head}></path>
						</g>
					{/each}
				</svg>

				{#each ROWS as row, ri (ri)}
					<div class="sk-row">
						{#each row as s (s.id)}
							{@const lv = levels[s.id] ?? 0}
							{@const st = stateOf(s)}
							<div
								class="sk-cell"
								class:hot={focusSet.has(s.id)}
								class:dim={!!hoverId && !focusSet.has(s.id)}
								style={`--gc:${GROUP_COLORS[s.group] ?? "#9a8f78"};--jy:${JITTER[s.id] ?? 0}px`}
							>
								<button
									type="button"
									class="sk-tile"
									class:shake={shakeId === s.id}
									data-id={s.id}
									data-lv={lv}
									data-state={st}
									data-done={(done[s.id] ?? []).length}
									aria-label={`${s.name}，清单 ${(done[s.id] ?? []).length}/${totalOf(s.id)} 项，等级 ${lv}`}
									onmouseenter={() => (hoverId = s.id)}
									onmouseleave={() => (hoverId = null)}
									onfocus={() => (hoverId = s.id)}
									onblur={() => (hoverId = null)}
									onclick={() => openPanel(s)}
									oncontextmenu={(e) => {
										e.preventDefault();
										stepDown(s);
									}}
								>
									<span class="sk-face">
										<span
											class="sk-water"
											style={`height:${(lv / capOf(s.id)) * 100}%`}
										></span>
										<svg class="sk-logo" viewBox="0 0 24 24" aria-hidden="true">
											<path
												d={TECH_ICONS[s.id]?.d ?? ""}
												fill={iconColor(s.id, s.group, iconState(s), dark)}
											></path>
										</svg>
										<span class="sk-lv">{lv}</span>
										{#if st === "locked"}
											<span class="sk-lockmark">需前置</span>
										{/if}
									</span>
								</button>
								<span class="sk-name">{s.short}</span>
							</div>
						{/each}
					</div>
				{/each}
			</div>
		</div>
		{#if overflowing}
			<p class="sk-scroll-hint">技能图比屏幕宽，左右滑动可以看完整</p>
		{/if}
	</div>

	<!-- ===================== 底部：角色面板 + 详情 ===================== -->
	<footer class="sk-foot">
		<div class="sk-hero">
			<div class="sk-portrait">
				<img src={avatarUrl} alt={profileConfig.name} />
				<span class="sk-portrait-lv">{stats.pct}%</span>
			</div>
			<div class="sk-hero-info">
				<p class="sk-hero-name">
					{profileConfig.name} <b>{stats.title.name}</b>
				</p>
				<p class="sk-hero-note">{stats.title.note}</p>
				<ul class="sk-attrs">
					{#each ATTRS as a (a.id)}
						{@const v = attrStats.value[a.id] ?? 0}
						{@const m = attrStats.max[a.id] ?? 1}
						<li style={`--ac:#${a.color}`}>
							<span class="sk-attr-cap">{a.short}</span>
							<b>{v}<em>/{m}</em></b>
							<span class="sk-attr-bar">
								<span style={`width:${m ? Math.round((v / m) * 100) : 0}%`}></span>
							</span>
						</li>
					{/each}
				</ul>
			</div>
		</div>

		<div class="sk-detail">
			{#if active}
				{@const lv = levels[active.id] ?? 0}
				{@const st = stateOf(active)}
				<div class="sk-detail-head">
					<svg class="sk-detail-logo" viewBox="0 0 24 24" aria-hidden="true">
						<path
							d={TECH_ICONS[active.id]?.d ?? ""}
							fill={iconColor(active.id, active.group, iconState(active), dark)}
						></path>
					</svg>
					<div>
						<p class="sk-detail-name">
							{active.name}
							<span
								class="sk-detail-group"
								style={`--gc:${GROUP_COLORS[active.group] ?? "#9a8f78"}`}
							>
								{GROUP_MAP[active.group]?.short ?? ""}
							</span>
						</p>
						<p class="sk-detail-lv">
							等级 <b>{lv}</b> / {capOf(active.id)} · {LEVELS[levelTier(active.id, lv)]?.name}
							{#if st === "locked"}<i class="sk-tag-warn">未解锁</i>{/if}
							{#if st === "max"}<i class="sk-tag-max">已精通</i>{/if}
						</p>
					</div>
				</div>
				<p class="sk-detail-note">{active.note}</p>
				{#if active.requires.length}
					<p class="sk-detail-sub">
						前置：{active.requires
							.map((r) => `${SKILL_MAP[r]?.short ?? r}(${levels[r] ?? 0})`)
							.join(" · ")}
					</p>
				{:else}
					<p class="sk-detail-sub">前置：无，这是起点</p>
				{/if}
				{#if CHILDREN[active.id]?.length}
					<p class="sk-detail-sub">
						解锁：{CHILDREN[active.id].map((c) => SKILL_MAP[c]?.short ?? c).join(" · ")}
					</p>
				{/if}
				{#if checksOf(active.id).length}
					<ul class="sk-detail-tips">
						{#each checksOf(active.id) as [title, note], i (i)}
							{@const on = (done[active.id] ?? []).includes(i)}
							<li class:on>
								<i aria-hidden="true">{on ? "✓" : "○"}</i>
								<b>{title}</b>
								<span>{note}</span>
							</li>
						{/each}
					</ul>
				{/if}
				<p class="sk-detail-judge">
					{#if lv >= capOf(active.id)}
						<em>已全部学完</em>{LEVELS[MAX_LEVEL - 1]?.judge ?? ""}
					{:else}
						{@const next = checksOf(active.id).findIndex(
							(_, i) => !(done[active.id] ?? []).includes(i),
						)}
						<em>下一项</em>
						{next >= 0 ? checksOf(active.id)[next][0] : ""}
						· 勾上后到 Lv{Math.min(capOf(active.id), lv + 1)}
					{/if}
				</p>
			{:else}
				<p class="sk-detail-hint">
					把鼠标移到任意方块上，这里会显示它的说明、学习清单与解锁项，技能图里会同步高亮整条链路。
				</p>
				<ul class="sk-detail-tips">
					<li><i>1</i><b>左键点方块</b><span>打开它的学习清单，一项项勾</span></li>
					<li><i>2</i><b>勾一项涨一级</b><span>方块水位上升、属性与总统计实时跟着变</span></li>
					<li><i>3</i><b>右键退一项</b><span>勾错了不用进弹窗，右键点一下就行</span></li>
					<li><i>4</i><b>虚线斜纹方块</b><span>前置还没点亮，先把它上面的技术学了</span></li>
				</ul>
			{/if}
		</div>

		<!-- ===================== 总统计 ===================== -->
		<section class="sk-summary">
			<div class="sk-summary-head">
				<h3>总统计</h3>
				<p>按方向看进度：条越满，这块越扎实；最右边是它喂养的属性。</p>
			</div>

			<ul class="sk-summary-list">
				{#each GROUPS as g (g.id)}
					{@const gp = stats.groupPoints[g.id] ?? 0}
					{@const gsize = GROUP_SIZE[g.id] ?? 1}
					{@const gmax = GROUP_MAX[g.id] ?? 1}
					{@const gpct = gmax ? Math.round((gp / gmax) * 100) : 0}
					{@const gattr = ATTR_MAP[GROUP_ATTR[g.id] ?? "dex"]}
					<li
						class="sk-sum-row"
						style={`--gc:${GROUP_COLORS[g.id] ?? "#9a8f78"};--ac:#${gattr?.color ?? "7a6a4a"}`}
					>
						<span class="sk-sum-name">{g.name}</span>
						<span class="sk-sum-bar"><span style={`width:${gpct}%`}></span></span>
						<span class="sk-sum-val">{gp}<em>/{gmax}</em></span>
						<span class="sk-sum-pct">{gpct}%</span>
						<span class="sk-sum-maxed">满级 {stats.groupMaxed[g.id] ?? 0}/{gsize}</span>
						<span class="sk-sum-attr">{gattr?.short}</span>
					</li>
				{/each}
			</ul>

			<div class="sk-summary-foot">
				<ul class="sk-summary-nums">
					<li><b>{stats.points}</b><span>技能点<em>满 {MAX_POINTS}</em></span></li>
					<li><b>{stats.pct}%</b><span>总掌握度<em>{stats.title.name}</em></span></li>
					<li><b>{stats.lit}<em>/{TOTAL_SKILLS}</em></b><span>已点亮<em>还有 {TOTAL_SKILLS - stats.lit} 个没碰</em></span></li>
					<li><b>{stats.maxed}</b><span>已学完<em>清单全勾完的技能数</em></span></li>
					<li><b>{stats.litGroups}<em>/{GROUPS.length}</em></b><span>已开启方向<em>至少点亮 1 个</em></span></li>
					<li><b>{stats.maxedGroups}</b><span>学完的方向<em>整块清单都勾满</em></span></li>
				</ul>
				<p class="sk-summary-note">
					技术是学不完的，能学完的只有「今天这一块」。把上面的条一条条填满，比收藏一百篇文章都管用。
				</p>
			</div>
		</section>
	</footer>

	<!-- ===================== 悬停浮层 ===================== -->
	{#if active}
		{@const alv = levels[active.id] ?? 0}
		{@const aattr = ATTR_MAP[attrIdOf(active)]}
		{@const missing = active.requires.filter((r) => (levels[r] ?? 0) <= 0)}
		<div
			class="sk-tip"
			class:above={tipPos.above}
			class:ready={tipPos.ready}
			bind:this={tipEl}
			style={`left:${tipPos.x}px;top:${tipPos.y}px`}
			role="tooltip"
		>
			<div class="sk-tip-head">
				<svg class="sk-tip-logo" viewBox="0 0 24 24" aria-hidden="true">
					<path
						d={TECH_ICONS[active.id]?.d ?? ""}
						fill={iconColor(active.id, active.group, iconState(active), dark)}
					></path>
				</svg>
				<div class="sk-tip-title">
					<p class="sk-tip-name">
						{active.name}
						<span
							class="sk-tip-group"
							style={`--gc:${GROUP_COLORS[active.group] ?? "#9a8f78"}`}
						>
							{GROUP_MAP[active.group]?.short ?? ""}
						</span>
					</p>
					<p class="sk-tip-lv">
						等级 <b>{alv}</b> / {capOf(active.id)} · {LEVELS[levelTier(active.id, alv)]?.name}
					</p>
				</div>
				<span class="sk-tip-pct">{Math.round((alv / capOf(active.id)) * 100)}%</span>
			</div>

			<p class="sk-tip-note">{active.note}</p>

			{#if checksOf(active.id).length}
				<p class="sk-tip-cap sk-tip-cap-list">
					学习清单
					<em>{(done[active.id] ?? []).length}/{totalOf(active.id)}</em>
				</p>
				<ul class="sk-tip-tips">
					{#each checksOf(active.id) as [title], i (i)}
						<li class:on={(done[active.id] ?? []).includes(i)}>
							<i aria-hidden="true">{(done[active.id] ?? []).includes(i) ? "✓" : "○"}</i
							>{title}
						</li>
					{/each}
				</ul>
			{/if}

			<div class="sk-tip-rewards">
				<span class="sk-tip-cap">属性</span>
				<span class="sk-tip-gain" style={`--ac:#${aattr?.color ?? "7a6a4a"}`}>
					+1 {aattr?.name ?? ""}<em>/级</em>
				</span>
				{#if alv >= capOf(active.id)}
					<span class="sk-tip-gain is-bonus" style={`--ac:#${aattr?.color ?? "7a6a4a"}`}>
						学完再 +{ATTR_MAX_BONUS}
					</span>
				{/if}
			</div>

			<p class="sk-tip-rel">
				<span class="sk-tip-cap">前置</span>
				{#if active.requires.length}
					{#each active.requires as r, i (r)}
						{#if i > 0}<i class="sk-tip-sep">·</i>{/if}
						<span class:ok={(levels[r] ?? 0) > 0} class:need={(levels[r] ?? 0) <= 0}>
							{SKILL_MAP[r]?.short ?? r}<em>({levels[r] ?? 0})</em>
						</span>
					{/each}
				{:else}
					<span class="ok">无，这是起点</span>
				{/if}
			</p>

			{#if CHILDREN[active.id]?.length}
				<p class="sk-tip-rel">
					<span class="sk-tip-cap">解锁</span>
					<span class="sk-tip-kids">
						{CHILDREN[active.id].map((c) => SKILL_MAP[c]?.short ?? c).join(" · ")}
					</span>
				</p>
			{/if}

			{#if missing.length}
				<p class="sk-tip-locked">
					先点亮 {missing.map((r) => SKILL_MAP[r]?.short ?? r).join(" · ")}，才能学它
				</p>
			{:else}
				<p class="sk-tip-open">
					{active.requires.length ? "前置已打通" : "起点技能"} · 左键打开学习清单
				</p>
			{/if}
		</div>
	{/if}

	<!-- ===================== 学习清单弹窗 ===================== -->
	<dialog
		class="sk-modal"
		bind:this={dialogEl}
		aria-labelledby="sk-modal-name"
		onclose={() => (openId = null)}
		onclick={(e) => {
			if (e.target === dialogEl) closePanel();
		}}
	>
		{#if openSkill}
			{@const m = openSkill}
			{@const mlv = levels[m.id] ?? 0}
			{@const mdone = done[m.id] ?? []}
			{@const mtotal = totalOf(m.id)}
			{@const mlist = checksOf(m.id)}
			{@const mattr = ATTR_MAP[attrIdOf(m)]}
			{@const pips = Array.from({ length: mtotal }, (_, i) => i)}
			<div class="sk-modal-box">
				<header class="sk-modal-head">
					<svg class="sk-modal-logo" viewBox="0 0 24 24" aria-hidden="true">
						<path
							d={TECH_ICONS[m.id]?.d ?? ""}
							fill={iconColor(m.id, m.group, iconState(m), dark)}
						></path>
					</svg>
					<div class="sk-modal-title">
						<p class="sk-modal-name" id="sk-modal-name">
							{m.name}
							<span
								class="sk-modal-group"
								style={`--gc:${GROUP_COLORS[m.group] ?? "#9a8f78"}`}
							>
								{GROUP_MAP[m.group]?.short ?? ""}
							</span>
						</p>
						<p class="sk-modal-note">{m.note}</p>
					</div>
					<div class="sk-modal-lv">
						<b>Lv{mlv}</b>
						<span>{LEVELS[levelTier(m.id, mlv)]?.name}</span>
						<span class="sk-modal-pips">
							{#each pips as p (p)}
								<i class:on={p < mlv}></i>
							{/each}
						</span>
					</div>
				</header>

				<div class="sk-modal-prog">
					<span class="sk-modal-cap">学习清单</span>
					<span class="sk-modal-prog-num">
						<b>{mdone.length}</b>/{mtotal} 项
					</span>
					<span class="sk-modal-prog-bar">
						<span
							style={`width:${mtotal ? (mdone.length / mtotal) * 100 : 0}%`}
						></span>
					</span>
					<span class="sk-modal-prog-hint">勾一项涨一级，勾满就是 Lv{mtotal}</span>
				</div>

				<ul class="sk-modal-list">
					{#each mlist as [title, note], i (i)}
						{@const on = mdone.includes(i)}
						<li>
						<button
							type="button"
							class="sk-check"
							class:on
							data-ci={i}
							aria-pressed={on}
							onclick={(e) => toggle(m, i, e.currentTarget)}
						>
								<span class="sk-check-box" aria-hidden="true"
									>{on ? "✓" : ""}</span
								>
								<span class="sk-check-txt">
									<b>{title}</b>
									<em>{note}</em>
								</span>
							</button>
						</li>
					{/each}
				</ul>

				<footer class="sk-modal-foot">
					<div class="sk-modal-rel">
						<p>
							<span class="sk-modal-cap">前置</span>
							{#if m.requires.length}
								{m.requires
									.map((r) => `${SKILL_MAP[r]?.short ?? r}·${levels[r] ?? 0}`)
									.join(" · ")}
							{:else}
								无，这是起点
							{/if}
						</p>
						{#if CHILDREN[m.id]?.length}
							<p>
								<span class="sk-modal-cap">解锁</span>
								<span class="sk-modal-kids">
									{CHILDREN[m.id]
										.map((c) => SKILL_MAP[c]?.short ?? c)
										.join(" · ")}
								</span>
							</p>
						{/if}
					</div>
					<div class="sk-modal-acts">
						<span
							class="sk-modal-gain"
							style={`--ac:#${mattr?.color ?? "7a6a4a"}`}
						>
							+{attrGain(m)} {mattr?.name ?? ""}
							<em>{mlv >= capOf(m.id) ? `学完 +${ATTR_MAX_BONUS}` : "每项 +1"}</em>
						</span>
						<button
							type="button"
							class="sk-modal-btn"
							disabled={!mdone.length}
							onclick={() => stepDown(m)}
						>
							退一项
						</button>
						<button
							type="button"
							class="sk-modal-btn is-primary"
							onclick={closePanel}
						>
							完成
						</button>
					</div>
				</footer>
			</div>
		{/if}
	</dialog>

	{#if toast}
		<p class="sk-toast">{toast}</p>
	{/if}

	<!-- ===================== 修行动作飘字 + 连悟横幅 ===================== -->
	{#if comboFlash}
		<div class="sk-combo" key={comboFlash.key}>
			<span class="sk-combo-n">{comboFlash.n}</span>
			<span class="sk-combo-txt"
				>{comboFlash.tier ?? "连悟"} ×{comboFlash.n}</span
			>
		</div>
	{/if}
	{#each xpFloats as f (f.key)}
		<div
			class="sk-xp-float"
			style={`left:${f.x}px;top:${f.y}px`}
			class:is-secret={f.isSecret}
		>
			{#if f.isSecret}
				<span class="sk-xp-secret">✦ 发现机缘 ✦</span>
			{:else}
				<span class="sk-xp-verb">{f.verb}</span>
				<span class="sk-xp-name">「{f.title}」</span>
			{/if}
			<span class="sk-xp-amt">+{f.amount} 修为</span>
		</div>
	{/each}
</div>

<style>
	/* ===================== 设计令牌 ===================== */
	.sk-root {
		position: relative;
		--gold: #c9a44c;
		--gold-lt: #e7d09a;
		--gold-dp: #8a6d24;
		--ink: #4a4335;
		--ink-2: #857d6c;
		--face-1: #fffefa;
		--face-2: #f5eedc;
		--panel-1: #fffdf7;
		--panel-2: #f8f2e5;
		--grid: rgba(150, 128, 76, 0.1);
		--wire: rgba(176, 146, 78, 0.5);
		--line: rgba(150, 128, 76, 0.22);
		/* 亮色 logo（JS 黄这类）在浅色面板上容易糊，给一层极淡的投影提形状 */
		--logo-shadow: drop-shadow(0 0.5px 1px rgba(74, 67, 53, 0.32));
		color: var(--ink);
	}

	:global(html.dark) .sk-root {
		--gold: #d9b45f;
		--gold-lt: #f0dda8;
		--gold-dp: #a9862f;
		--ink: #e9e1ce;
		--ink-2: #a79d88;
		--face-1: #2c251a;
		--face-2: #1c1710;
		--panel-1: #211b13;
		--panel-2: #17130d;
		--grid: rgba(216, 186, 116, 0.07);
		--wire: rgba(214, 178, 96, 0.4);
		--line: rgba(214, 178, 96, 0.16);
		--logo-shadow: none;
	}

	/* ===================== 头部 ===================== */
	.sk-head {
		display: flex;
		flex-wrap: wrap;
		gap: 1.4rem 2rem;
		align-items: flex-end;
		justify-content: space-between;
	}
	.sk-eyebrow {
		margin: 0 0 0.2rem;
		font-size: 0.62rem;
		font-weight: 700;
		letter-spacing: 0.24em;
		color: color-mix(in srgb, var(--gold-dp) 88%, transparent);
	}
	.sk-title {
		margin: 0;
		font-size: clamp(1.4rem, 2.6vw, 1.9rem);
		font-weight: 800;
		letter-spacing: 0.01em;
	}
	.sk-desc {
		max-width: 46rem;
		margin: 0.5rem 0 0;
		font-size: 0.82rem;
		line-height: 1.72;
		color: var(--ink-2);
	}
	.sk-stats {
		display: flex;
		gap: clamp(0.9rem, 2.4vw, 2rem);
	}
	.sk-stat {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}
	.sk-stat-num {
		font-size: clamp(1.1rem, 2vw, 1.42rem);
		font-weight: 800;
		line-height: 1.1;
		color: var(--gold-dp);
		font-variant-numeric: tabular-nums;
	}
	.sk-stat-num em {
		font-style: normal;
		font-size: 0.62em;
		font-weight: 600;
		opacity: 0.6;
	}
	.sk-stat-cap {
		font-size: 0.66rem;
		color: var(--ink-2);
	}

	/* ===================== 图例条 ===================== */
	.sk-bar {
		display: flex;
		flex-wrap: wrap;
		gap: 0.7rem 1.2rem;
		align-items: center;
		justify-content: space-between;
		margin-top: 1.1rem;
		padding: 0.6rem 0.85rem;
		border: 1px solid var(--line);
		border-radius: 0.85rem;
		background: var(--panel-2);
	}
	.sk-legend {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem 1rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.sk-legend li {
		display: inline-flex;
		align-items: center;
		gap: 0.36rem;
		font-size: 0.68rem;
		color: var(--ink-2);
	}
	.sk-legend i {
		display: block;
		width: 13px;
		height: 13px;
		border-radius: 4px;
		border: 1px solid var(--line);
		background: var(--face-1);
	}
	.sk-legend .is-locked i {
		border-style: dashed;
		background: repeating-linear-gradient(
			45deg,
			transparent 0 3px,
			color-mix(in srgb, var(--ink-2) 22%, transparent) 3px 5px
		);
	}
	.sk-legend .is-ready i {
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--gold) 45%, transparent);
	}
	.sk-legend .is-learning i {
		background: linear-gradient(
			180deg,
			var(--face-1) 42%,
			color-mix(in srgb, var(--gold) 26%, var(--face-1))
		);
	}
	.sk-legend .is-max i {
		border-color: var(--gold);
		background: linear-gradient(
			180deg,
			color-mix(in srgb, var(--gold) 40%, var(--face-1)),
			var(--gold)
		);
		box-shadow: 0 0 7px color-mix(in srgb, var(--gold) 55%, transparent);
	}
	.sk-legend .is-wire i {
		width: 18px;
		height: 2px;
		border: 0;
		border-radius: 2px;
		background: var(--wire);
	}
	.sk-acts {
		display: flex;
		gap: 0.5rem;
	}
	.sk-act {
		padding: 0.3rem 0.72rem;
		border: 1px solid var(--line);
		border-radius: 0.5rem;
		background: var(--face-1);
		font-size: 0.68rem;
		color: var(--ink);
		cursor: pointer;
		transition: border-color 160ms ease, color 160ms ease;
	}
	.sk-act:hover:not(:disabled) {
		border-color: var(--gold);
		color: var(--gold-dp);
	}
	.sk-act:disabled {
		opacity: 0.4;
		cursor: default;
	}

	/* ===================== 画布 ===================== */
	.sk-stage {
		position: relative;
		margin-top: 1rem;
		border: 1px solid var(--line);
		border-radius: 1rem;
		background: linear-gradient(158deg, var(--panel-1), var(--panel-2));
		overflow: hidden;
	}
	.sk-stage::before {
		content: "";
		position: absolute;
		inset: 0;
		background-image: radial-gradient(var(--grid) 1px, transparent 1px);
		background-size: 22px 22px;
		pointer-events: none;
	}
	.sk-scroll {
		position: relative;
		overflow-x: auto;
		overflow-y: hidden;
		scrollbar-width: thin;
	}
	.sk-canvas {
		/* 列宽：最宽的一层有 16 个方块，按它定最小宽度 */
		--tile: 54px;
		--gx: 18px;
		--gy: 44px;
		position: relative;
		display: flex;
		flex-direction: column;
		gap: var(--gy);
		min-width: calc(var(--tile) * 16 + var(--gx) * 15 + 2.4rem);
		padding: 1.5rem 1.2rem 1.7rem;
	}

	/* 每层一行，居中；方块之间留出连线走线的空隙 */
	.sk-row {
		position: relative;
		z-index: 1;
		display: flex;
		flex-wrap: nowrap;
		gap: var(--gx);
		justify-content: center;
	}
	.sk-cell {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.3rem;
		flex: none;
		transform: translateY(var(--jy, 0px));
		transition: opacity 220ms ease, transform 220ms ease;
	}
	.sk-cell.hot {
		transform: translateY(calc(var(--jy, 0px) - 3px));
	}
	.sk-cell.dim {
		opacity: 0.34;
	}

	/* ===================== 方块 ===================== */
	.sk-tile {
		position: relative;
		width: var(--tile);
		height: var(--tile);
		padding: 2px;
		border: 0;
		border-radius: 15px;
		background: linear-gradient(158deg, var(--gold-lt), var(--gold) 46%, var(--gold-dp));
		box-shadow:
			0 2px 5px color-mix(in srgb, var(--gold-dp) 30%, transparent),
			inset 0 1px 0 color-mix(in srgb, #fff 45%, transparent);
		cursor: pointer;
		transition: transform 180ms ease, box-shadow 220ms ease;
	}
	.sk-tile:hover {
		transform: translateY(-2px);
		box-shadow:
			0 6px 16px color-mix(in srgb, var(--gold-dp) 34%, transparent),
			inset 0 1px 0 color-mix(in srgb, #fff 55%, transparent);
	}
	.sk-tile:focus-visible {
		outline: 2px solid var(--gold-dp);
		outline-offset: 3px;
	}
	.sk-face {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		border-radius: 13px;
		background: linear-gradient(180deg, var(--face-1), var(--face-2));
		overflow: hidden;
	}
	/* 水位：level 越高填得越满，这就是「亮度」的主信号。刻意压低不透明度，别糊住 logo */
	.sk-water {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		background: linear-gradient(
			180deg,
			color-mix(in srgb, var(--gc) 26%, transparent),
			color-mix(in srgb, var(--gc) 58%, transparent)
		);
		opacity: 0.42;
		transition: height 300ms cubic-bezier(0.4, 0, 0.2, 1);
	}
	.sk-logo {
		position: relative;
		width: 64%;
		height: 64%;
		filter: var(--logo-shadow);
		transition: transform 200ms ease;
	}
	.sk-tile:hover .sk-logo {
		transform: scale(1.08);
	}
	.sk-lv {
		position: absolute;
		right: 3px;
		bottom: 2px;
		min-width: 15px;
		padding: 0 3px;
		border-radius: 5px;
		background: color-mix(in srgb, var(--gold-dp) 82%, #000);
		font-size: 0.58rem;
		font-weight: 800;
		line-height: 1.45;
		text-align: center;
		color: #fbf3dd;
		font-variant-numeric: tabular-nums;
	}
	.sk-lockmark {
		position: absolute;
		top: 2px;
		left: 3px;
		font-size: 0.46rem;
		color: color-mix(in srgb, var(--ink-2) 92%, transparent);
	}

	/* 未解锁：虚线描边 + 斜纹遮罩 */
	.sk-tile[data-state="locked"] {
		background: none;
		border: 1px dashed color-mix(in srgb, var(--ink-2) 45%, transparent);
		box-shadow: none;
	}
	.sk-tile[data-state="locked"] .sk-face {
		background:
			repeating-linear-gradient(
				45deg,
				transparent 0 4px,
				color-mix(in srgb, var(--ink-2) 13%, transparent) 4px 7px
			),
			var(--face-2);
	}
	/* 可开始：金色描边，提示「这个现在就能点」 */
	.sk-tile[data-state="ready"] {
		box-shadow:
			0 2px 5px color-mix(in srgb, var(--gold-dp) 30%, transparent),
			0 0 0 2px color-mix(in srgb, var(--gold) 24%, transparent);
	}
	/* 精通：强光晕 */
	.sk-tile[data-state="max"] {
		box-shadow:
			0 3px 9px color-mix(in srgb, var(--gold-dp) 40%, transparent),
			0 0 16px color-mix(in srgb, var(--gold) 62%, transparent),
			inset 0 1px 0 color-mix(in srgb, #fff 60%, transparent);
	}
	.sk-tile.shake {
		animation: sk-shake 420ms ease;
	}
	@keyframes sk-shake {
		0%,
		100% {
			transform: translateX(0);
		}
		20% {
			transform: translateX(-4px);
		}
		40% {
			transform: translateX(4px);
		}
		60% {
			transform: translateX(-3px);
		}
		80% {
			transform: translateX(2px);
		}
	}

	.sk-name {
		position: relative;
		z-index: 2;
		max-width: calc(var(--tile) + var(--gx));
		padding: 0.05rem 0.28rem;
		border-radius: 0.3rem;
		/* 实心底衬：把从方块底部垂下来的连线挡在名字后面，不然字会被金线穿过 */
		background: var(--panel-1);
		font-size: 0.62rem;
		line-height: 1.25;
		color: var(--ink-2);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.sk-cell.hot .sk-name {
		color: var(--gold-dp);
		font-weight: 700;
	}
	/* 焦点方块单独套一圈金环，一眼看出链路是从它出发的 */
	.sk-cell.hot .sk-tile {
		box-shadow:
			0 0 0 2px var(--gold-dp),
			0 0 18px color-mix(in srgb, var(--gold) 60%, transparent),
			inset 0 1px 0 color-mix(in srgb, #fff 55%, transparent);
	}

	/* ===================== 连线 ===================== */
	.sk-wires {
		position: absolute;
		top: 0;
		left: 0;
		z-index: 0;
		pointer-events: none;
		overflow: visible;
	}
	.sk-wire {
		transition: opacity 200ms ease;
	}
	.sk-wire path {
		fill: none;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	/* 离线：很淡的灰，只是告诉你「这里以后会连上」 */
	.sk-wire .sk-wire-track {
		stroke: color-mix(in srgb, var(--ink-2) 17%, transparent);
		stroke-width: 5;
	}
	.sk-wire .sk-wire-glow {
		stroke: none;
	}
	.sk-wire .sk-wire-line {
		stroke: color-mix(in srgb, var(--ink-2) 26%, transparent);
		stroke-width: 1.6;
	}
	.sk-wire .sk-wire-head {
		stroke: color-mix(in srgb, var(--ink-2) 34%, transparent);
		stroke-width: 1.7;
	}
	/* 前置点亮但后置没点：半亮 */
	.sk-wire.half .sk-wire-track {
		stroke: color-mix(in srgb, var(--gold) 20%, transparent);
	}
	.sk-wire.half .sk-wire-line {
		stroke: color-mix(in srgb, var(--gold) 58%, transparent);
	}
	.sk-wire.half .sk-wire-head {
		stroke: color-mix(in srgb, var(--gold) 72%, transparent);
	}
	/* 两头都点亮：金色实线。刻意压暗，避免 140 条线一起抢戏 */
	.sk-wire.on .sk-wire-track {
		stroke: color-mix(in srgb, var(--gold-dp) 15%, transparent);
	}
	.sk-wire.on .sk-wire-line {
		stroke: color-mix(in srgb, var(--gold) 74%, transparent);
		stroke-width: 1.5;
	}
	.sk-wire.on .sk-wire-head {
		stroke: color-mix(in srgb, var(--gold) 80%, transparent);
		stroke-width: 1.6;
	}
	/* 悬浮链路：加粗 + 发光，这时候才让它成为主角 */
	.sk-wire.hot .sk-wire-track {
		stroke: color-mix(in srgb, var(--gold) 30%, transparent);
	}
	.sk-wire.hot .sk-wire-glow {
		stroke: color-mix(in srgb, var(--gold) 32%, transparent);
		stroke-width: 7;
	}
	.sk-wire.hot .sk-wire-line,
	.sk-wire.hot .sk-wire-head {
		stroke: color-mix(in srgb, var(--gold-dp) 95%, #000 5%);
		stroke-width: 2.3;
	}
	.sk-wire.dim {
		opacity: 0.16;
	}

	.sk-scroll-hint {
		margin: 0;
		padding: 0 0 0.6rem;
		font-size: 0.66rem;
		text-align: center;
		color: var(--ink-2);
	}

	/* ===================== 底部面板 ===================== */
	.sk-foot {
		display: grid;
		grid-template-columns: minmax(0, 20rem) minmax(0, 1fr);
		gap: 1rem;
		margin-top: 1rem;
	}
	.sk-hero,
	.sk-detail {
		padding: 0.95rem 1.05rem;
		border: 1px solid var(--line);
		border-radius: 1rem;
		background: linear-gradient(160deg, var(--panel-1), var(--panel-2));
	}
	.sk-hero {
		display: flex;
		gap: 0.95rem;
		align-items: center;
	}
	.sk-portrait {
		position: relative;
		flex: none;
		width: 66px;
		height: 66px;
	}
	.sk-portrait img {
		width: 100%;
		height: 100%;
		border: 2px solid var(--gold);
		border-radius: 14px;
		object-fit: cover;
		box-shadow: 0 4px 14px color-mix(in srgb, var(--gold-dp) 30%, transparent);
	}
	.sk-portrait-lv {
		position: absolute;
		right: -7px;
		bottom: -7px;
		min-width: 34px;
		padding: 0.06rem 0.26rem;
		border: 1px solid var(--gold-dp);
		border-radius: 7px;
		background: linear-gradient(180deg, #3a2f16, #221b0c);
		font-size: 0.6rem;
		font-weight: 800;
		text-align: center;
		color: color-mix(in srgb, var(--gold-lt) 92%, #fff);
		font-variant-numeric: tabular-nums;
	}
	.sk-hero-info {
		min-width: 0;
	}
	.sk-hero-name {
		margin: 0;
		font-size: 0.86rem;
		color: var(--ink-2);
	}
	.sk-hero-name b {
		margin-left: 0.3rem;
		font-size: 1.02rem;
		color: var(--gold-dp);
	}
	.sk-hero-note {
		margin: 0.28rem 0 0.6rem;
		font-size: 0.72rem;
		color: var(--ink-2);
	}
	/* ===================== 角色属性（魅力 / 灵巧 / 硬核） ===================== */
	.sk-attrs {
		display: grid;
		gap: 0.36rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.sk-attrs li {
		display: grid;
		grid-template-columns: 2rem 3rem minmax(0, 1fr);
		align-items: center;
		gap: 0.4rem;
	}
	.sk-attr-cap {
		font-size: 0.62rem;
		color: var(--ink-2);
		white-space: nowrap;
	}
	.sk-attrs b {
		font-size: 0.8rem;
		color: color-mix(in srgb, var(--ac) 76%, var(--ink));
		font-variant-numeric: tabular-nums;
	}
	.sk-attrs b em {
		font-style: normal;
		font-size: 0.6rem;
		font-weight: 500;
		opacity: 0.55;
	}
	.sk-attr-bar {
		display: block;
		height: 5px;
		border-radius: 99px;
		background: color-mix(in srgb, var(--ink) 11%, transparent);
		overflow: hidden;
	}
	.sk-attr-bar > span {
		display: block;
		height: 100%;
		border-radius: 99px;
		background: linear-gradient(
			90deg,
			color-mix(in srgb, var(--ac) 55%, transparent),
			var(--ac)
		);
		transition: width 420ms cubic-bezier(0.4, 0, 0.2, 1);
	}

	.sk-detail-head {
		display: flex;
		gap: 0.7rem;
		align-items: center;
	}
	.sk-detail-logo {
		flex: none;
		width: 30px;
		height: 30px;
	}
	.sk-detail-name {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		margin: 0;
		font-size: 0.94rem;
		font-weight: 800;
	}
	.sk-detail-group {
		padding: 0.04rem 0.36rem;
		border-radius: 99px;
		background: color-mix(in srgb, var(--gc) 18%, transparent);
		font-size: 0.6rem;
		font-weight: 600;
		color: color-mix(in srgb, var(--gc) 88%, var(--ink));
	}
	.sk-detail-lv {
		margin: 0.16rem 0 0;
		font-size: 0.68rem;
		color: var(--ink-2);
	}
	.sk-detail-lv b {
		color: var(--gold-dp);
	}
	.sk-tag-warn,
	.sk-tag-max {
		margin-left: 0.35rem;
		padding: 0.02rem 0.34rem;
		border-radius: 99px;
		font-size: 0.6rem;
		font-style: normal;
	}
	.sk-tag-warn {
		background: color-mix(in srgb, #c2557a 16%, transparent);
		color: #a83e60;
	}
	.sk-tag-max {
		background: color-mix(in srgb, var(--gold) 24%, transparent);
		color: var(--gold-dp);
	}
	.sk-detail-note {
		margin: 0.6rem 0 0;
		font-size: 0.78rem;
		line-height: 1.7;
	}
	.sk-detail-sub {
		margin: 0.5rem 0 0;
		font-size: 0.7rem;
		line-height: 1.6;
		color: var(--ink-2);
	}
	.sk-detail-tips {
		display: grid;
		gap: 0.22rem;
		margin: 0.55rem 0 0;
		padding: 0;
		list-style: none;
	}
	.sk-detail-tips li {
		display: grid;
		grid-template-columns: 0.85rem minmax(3.6rem, auto) minmax(0, 1fr);
		gap: 0.42rem;
		align-items: baseline;
		font-size: 0.7rem;
		line-height: 1.6;
		color: var(--ink-2);
	}
	.sk-detail-tips li i {
		font-style: normal;
		font-size: 0.66rem;
		text-align: center;
		color: color-mix(in srgb, var(--ink-2) 62%, transparent);
	}
	.sk-detail-tips li b {
		font-weight: 700;
		color: var(--ink);
	}
	.sk-detail-tips li span {
		color: color-mix(in srgb, var(--ink-2) 88%, transparent);
	}
	.sk-detail-tips li.on i {
		color: var(--gold-dp);
	}
	.sk-detail-tips li.on b {
		color: var(--gold-dp);
	}
	.sk-detail-judge {
		margin: 0.6rem 0 0;
		padding: 0.5rem 0.7rem;
		border-left: 2px solid var(--gold);
		border-radius: 0 0.5rem 0.5rem 0;
		background: color-mix(in srgb, var(--gold) 8%, transparent);
		font-size: 0.7rem;
		line-height: 1.6;
		color: var(--ink-2);
	}
	.sk-detail-judge em {
		display: block;
		margin-bottom: 0.1rem;
		font-style: normal;
		font-weight: 700;
		color: var(--gold-dp);
	}
	.sk-detail-hint {
		margin: 0;
		font-size: 0.76rem;
		line-height: 1.7;
		color: var(--ink-2);
	}

	/* ===================== 提示条 ===================== */
	.sk-toast {
		position: sticky;
		bottom: 0.8rem;
		z-index: 5;
		width: fit-content;
		margin: 0.8rem auto 0;
		padding: 0.44rem 0.9rem;
		border: 1px solid color-mix(in srgb, var(--gold) 45%, transparent);
		border-radius: 99px;
		background: color-mix(in srgb, var(--gold-dp) 88%, #000);
		font-size: 0.72rem;
		color: #fdf5e2;
		box-shadow: 0 6px 18px color-mix(in srgb, var(--gold-dp) 34%, transparent);
	}

	/* ===================== 斩妖：勾选瞬间的剑光 ===================== */
	.sk-check.slain {
		animation: sk-slay 560ms ease;
	}
	@keyframes sk-slay {
		0% {
			box-shadow: 0 0 0 0 color-mix(in srgb, var(--gold) 70%, transparent);
		}
		35% {
			box-shadow: 0 0 0 6px color-mix(in srgb, var(--gold) 0%, transparent);
			background: color-mix(in srgb, var(--gold) 22%, var(--face-1));
		}
		100% {
			box-shadow: 0 0 0 0 transparent;
		}
	}

	/* 修为飘字：从勾选点升起、渐隐 */
	.sk-xp-float {
		position: absolute;
		z-index: 60;
		transform: translate(-50%, -50%);
		pointer-events: none;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.08rem;
		text-align: center;
		max-width: 13rem;
		text-shadow:
			0 1px 3px rgb(0 0 0 / 0.55),
			0 0 10px color-mix(in srgb, var(--gold) 80%, transparent);
		animation: sk-xp-rise 1100ms cubic-bezier(0.2, 0.7, 0.3, 1) forwards;
	}
	.sk-xp-verb {
		font-size: 0.74rem;
		font-weight: 800;
		color: #fff3cf;
	}
	.sk-xp-name {
		font-size: 0.66rem;
		font-weight: 600;
		color: color-mix(in srgb, #fff3cf 82%, transparent);
		max-width: 12rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.sk-xp-amt {
		font-size: 0.92rem;
		font-weight: 900;
		color: #fff7df;
		font-variant-numeric: tabular-nums;
	}
	.sk-xp-secret {
		font-size: 0.86rem;
		font-weight: 900;
		color: #ffe69a;
		letter-spacing: 0.08em;
	}
	.sk-xp-float.is-secret {
		text-shadow:
			0 0 16px rgb(255 210 120 / 0.95),
			0 1px 3px rgb(0 0 0 / 0.6);
	}
	.sk-xp-float.is-secret .sk-xp-secret {
		animation: sk-secret-pulse 1100ms ease forwards;
	}
	@keyframes sk-secret-pulse {
		0% {
			opacity: 0;
			transform: scale(0.6);
		}
		20% {
			opacity: 1;
			transform: scale(1.12);
		}
		100% {
			opacity: 0;
			transform: scale(1);
		}
	}
	@keyframes sk-xp-rise {
		0% {
			opacity: 0;
			transform: translate(-50%, -10%) scale(0.7);
		}
		18% {
			opacity: 1;
			transform: translate(-50%, -60%) scale(1.05);
		}
		100% {
			opacity: 0;
			transform: translate(-50%, -190%) scale(1);
		}
	}

	/* 连斩横幅：屏幕中央闪一下 */
	.sk-combo {
		position: absolute;
		left: 50%;
		top: 38%;
		z-index: 60;
		transform: translate(-50%, -50%);
		display: flex;
		align-items: baseline;
		gap: 0.4rem;
		padding: 0.5rem 1.1rem;
		border-radius: 99px;
		background: linear-gradient(
			120deg,
			color-mix(in srgb, var(--gold-dp) 90%, #000),
			color-mix(in srgb, var(--gold) 92%, #000)
		);
		box-shadow: 0 10px 30px color-mix(in srgb, var(--gold-dp) 45%, transparent);
		pointer-events: none;
		animation: sk-combo-pop 1100ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
	}
	.sk-combo-n {
		font-size: 2rem;
		font-weight: 900;
		font-style: italic;
		line-height: 1;
		color: #fff7df;
		font-variant-numeric: tabular-nums;
	}
	.sk-combo-txt {
		font-size: 0.82rem;
		font-weight: 800;
		color: #fdeecb;
	}
	@keyframes sk-combo-pop {
		0% {
			opacity: 0;
			transform: translate(-50%, -50%) scale(0.4) rotate(-8deg);
		}
		22% {
			opacity: 1;
			transform: translate(-50%, -50%) scale(1.1) rotate(-2deg);
		}
		70% {
			opacity: 1;
			transform: translate(-50%, -50%) scale(1) rotate(0deg);
		}
		100% {
			opacity: 0;
			transform: translate(-50%, -60%) scale(1);
		}
	}

	/* ===================== 悬停浮层 ===================== */
	/* 始终用深色卡片：像游戏里的物品说明，浅色底和深色底都只有它一个反色块，最醒目 */
	.sk-tip {
		position: fixed;
		z-index: 80;
		width: 276px;
		max-width: calc(100vw - 20px);
		padding: 0.74rem 0.82rem 0.7rem;
		border: 1px solid color-mix(in srgb, var(--gold) 58%, transparent);
		border-radius: 0.72rem;
		background:
			linear-gradient(165deg, #2e2618, #191510);
		box-shadow:
			0 14px 34px rgb(0 0 0 / 0.42),
			inset 0 1px 0 rgb(255 255 255 / 0.06);
		font-size: 0.72rem;
		line-height: 1.55;
		color: #e9e2d3;
		opacity: 0;
		transform: translateY(-5px);
		transition:
			opacity 140ms ease,
			transform 140ms ease;
		pointer-events: none;
	}
	.sk-tip.above {
		transform: translateY(5px);
	}
	.sk-tip.ready {
		opacity: 1;
		transform: translateY(0);
	}
	.sk-tip-head {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.sk-tip-logo {
		flex: none;
		width: 26px;
		height: 26px;
	}
	.sk-tip-title {
		flex: 1;
		min-width: 0;
	}
	.sk-tip-name {
		display: flex;
		align-items: center;
		gap: 0.34rem;
		margin: 0;
		font-size: 0.84rem;
		font-weight: 800;
		color: #f6dfa8;
	}
	.sk-tip-group {
		padding: 0.02rem 0.32rem;
		border-radius: 99px;
		background: color-mix(in srgb, var(--gc) 30%, transparent);
		font-size: 0.56rem;
		font-weight: 600;
		color: color-mix(in srgb, var(--gc) 48%, #fff);
	}
	.sk-tip-lv {
		margin: 0.12rem 0 0;
		font-size: 0.64rem;
		color: rgb(233 226 211 / 0.64);
	}
	.sk-tip-lv b {
		color: #f6dfa8;
	}
	.sk-tip-pct {
		flex: none;
		font-size: 0.74rem;
		font-weight: 800;
		color: #f6dfa8;
		font-variant-numeric: tabular-nums;
	}
	.sk-tip-note {
		margin: 0.5rem 0 0;
		color: rgb(233 226 211 / 0.84);
	}
	.sk-tip-tips {
		display: grid;
		gap: 0.18rem;
		margin: 0.3rem 0 0;
		padding: 0;
		list-style: none;
	}
	.sk-tip-tips li {
		display: grid;
		grid-template-columns: 0.78rem minmax(0, 1fr);
		gap: 0.24rem;
		align-items: baseline;
		font-size: 0.68rem;
		line-height: 1.5;
		color: rgb(233 226 211 / 0.66);
	}
	.sk-tip-tips li i {
		font-style: normal;
		font-size: 0.62rem;
		text-align: center;
		color: rgb(233 226 211 / 0.42);
	}
	.sk-tip-tips li.on {
		color: rgb(246 223 168 / 0.96);
		font-weight: 600;
	}
	.sk-tip-tips li.on i {
		color: var(--gold-lt);
	}
	.sk-tip-cap-list {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem;
		margin: 0.5rem 0 0;
	}
	.sk-tip-cap-list em {
		font-style: normal;
		font-weight: 700;
		color: var(--gold-lt);
		font-variant-numeric: tabular-nums;
	}
	.sk-tip-rewards {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.3rem;
		margin-top: 0.54rem;
		padding-top: 0.48rem;
		border-top: 1px dashed rgb(246 223 168 / 0.22);
	}
	.sk-tip-cap {
		font-size: 0.6rem;
		color: rgb(233 226 211 / 0.48);
	}
	.sk-tip-gain {
		padding: 0.06rem 0.36rem;
		border: 1px solid color-mix(in srgb, var(--ac) 62%, transparent);
		border-radius: 99px;
		background: color-mix(in srgb, var(--ac) 24%, transparent);
		font-size: 0.64rem;
		font-weight: 700;
		color: color-mix(in srgb, var(--ac) 30%, #fff);
	}
	.sk-tip-gain em {
		font-style: normal;
		font-weight: 500;
		opacity: 0.66;
	}
	.sk-tip-gain.is-bonus {
		background: color-mix(in srgb, var(--ac) 40%, transparent);
	}
	.sk-tip-rel {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.26rem;
		margin: 0.4rem 0 0;
		font-size: 0.68rem;
	}
	.sk-tip-rel .ok {
		color: #93d6a4;
	}
	.sk-tip-rel .need {
		color: #ff9280;
		font-weight: 700;
	}
	.sk-tip-rel em {
		font-style: normal;
		opacity: 0.6;
	}
	.sk-tip-sep {
		font-style: normal;
		color: rgb(233 226 211 / 0.3);
	}
	.sk-tip-kids {
		color: rgb(233 226 211 / 0.6);
	}
	.sk-tip-locked {
		margin: 0.46rem 0 0;
		padding: 0.3rem 0.46rem;
		border-radius: 0.36rem;
		background: color-mix(in srgb, #ff5a3c 20%, transparent);
		font-size: 0.66rem;
		font-weight: 600;
		color: #ffb6a6;
	}
	.sk-tip-open {
		margin: 0.46rem 0 0;
		font-size: 0.62rem;
		color: rgb(233 226 211 / 0.44);
	}

	/* ===================== 总统计 ===================== */
	.sk-summary {
		grid-column: 1 / -1;
		padding: 0.95rem 1.05rem;
		border: 1px solid var(--line);
		border-radius: 1rem;
		background: linear-gradient(160deg, var(--panel-1), var(--panel-2));
	}
	.sk-summary-head {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.6rem;
	}
	.sk-summary-head h3 {
		margin: 0;
		font-size: 0.94rem;
		color: var(--gold-dp);
	}
	.sk-summary-head p {
		margin: 0;
		font-size: 0.7rem;
		color: var(--ink-2);
	}
	.sk-summary-list {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(19rem, 1fr));
		gap: 0.34rem 1.4rem;
		margin: 0.75rem 0 0;
		padding: 0;
		list-style: none;
	}
	.sk-sum-row {
		display: grid;
		grid-template-columns: 6.6rem minmax(2.6rem, 1fr) 3.1rem 2.4rem 4.2rem 2rem;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.68rem;
	}
	.sk-sum-name {
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
		color: var(--ink);
	}
	.sk-sum-bar {
		display: block;
		height: 6px;
		border-radius: 99px;
		background: color-mix(in srgb, var(--ink) 11%, transparent);
		overflow: hidden;
	}
	.sk-sum-bar > span {
		display: block;
		height: 100%;
		border-radius: 99px;
		background: linear-gradient(
			90deg,
			color-mix(in srgb, var(--gc) 62%, transparent),
			var(--gc)
		);
		transition: width 420ms cubic-bezier(0.4, 0, 0.2, 1);
	}
	.sk-sum-val {
		font-weight: 700;
		color: var(--gold-dp);
		font-variant-numeric: tabular-nums;
	}
	.sk-sum-val em {
		font-style: normal;
		font-weight: 500;
		opacity: 0.55;
	}
	.sk-sum-pct {
		text-align: right;
		color: var(--ink-2);
		font-variant-numeric: tabular-nums;
	}
	.sk-sum-maxed {
		white-space: nowrap;
		color: var(--ink-2);
		opacity: 0.82;
	}
	.sk-sum-attr {
		justify-self: end;
		padding: 0.02rem 0.34rem;
		border-radius: 99px;
		background: color-mix(in srgb, var(--ac) 20%, transparent);
		font-size: 0.6rem;
		font-weight: 600;
		color: color-mix(in srgb, var(--ac) 74%, var(--ink));
	}
	.sk-summary-foot {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 19rem);
		gap: 1rem;
		margin-top: 0.9rem;
		padding-top: 0.8rem;
		border-top: 1px dashed var(--line);
	}
	.sk-summary-nums {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(7rem, 1fr));
		gap: 0.6rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.sk-summary-nums li {
		display: flex;
		flex-direction: column;
		gap: 0.06rem;
	}
	.sk-summary-nums b {
		font-size: 1rem;
		color: var(--gold-dp);
		font-variant-numeric: tabular-nums;
	}
	.sk-summary-nums b em {
		font-style: normal;
		font-size: 0.7rem;
		opacity: 0.6;
	}
	.sk-summary-nums span {
		font-size: 0.62rem;
		color: var(--ink-2);
	}
	.sk-summary-nums span em {
		display: block;
		font-style: normal;
		font-size: 0.58rem;
		opacity: 0.72;
	}
	.sk-summary-note {
		margin: 0;
		font-size: 0.7rem;
		line-height: 1.7;
		color: var(--ink-2);
	}

	/* ===================== 学习清单弹窗 ===================== */
	/* 用原生 dialog：它渲染在 top layer，不受祖先 transform 影响，
	   白拿焦点循环、ESC 关闭和 ::backdrop。 */
	.sk-modal {
		max-width: none;
		max-height: none;
		margin: auto;
		padding: 0;
		border: 0;
		background: transparent;
		overflow: visible;
		color: var(--ink);
	}
	.sk-modal::backdrop {
		background: rgb(18 15 10 / 0.5);
	}
	.sk-modal-box {
		display: flex;
		flex-direction: column;
		width: min(600px, 92vw);
		max-height: min(84vh, 760px);
		border: 1px solid color-mix(in srgb, var(--gold) 52%, transparent);
		border-radius: 1.1rem;
		background: var(--panel-1);
		box-shadow:
			inset 0 0 0 1px color-mix(in srgb, var(--gold) 14%, transparent),
			0 24px 60px rgb(0 0 0 / 0.34);
		overflow: hidden;
	}
	.sk-modal-head {
		display: flex;
		align-items: flex-start;
		gap: 0.85rem;
		padding: 1.05rem 1.15rem 0.9rem;
		border-bottom: 1px solid var(--line);
		background: linear-gradient(
			180deg,
			color-mix(in srgb, var(--gold) 11%, transparent),
			transparent
		);
	}
	.sk-modal-logo {
		flex: none;
		width: 42px;
		height: 42px;
		padding: 7px;
		border: 1px solid color-mix(in srgb, var(--gold) 42%, transparent);
		border-radius: 0.7rem;
		background: var(--face-1);
		filter: var(--logo-shadow);
	}
	.sk-modal-title {
		flex: 1 1 auto;
		min-width: 0;
	}
	.sk-modal-name {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem;
		margin: 0;
		font-size: 1.05rem;
		font-weight: 800;
		color: var(--ink);
	}
	.sk-modal-group {
		padding: 0.06rem 0.36rem;
		border: 1px solid color-mix(in srgb, var(--gc) 55%, transparent);
		border-radius: 99px;
		background: color-mix(in srgb, var(--gc) 16%, transparent);
		font-size: 0.62rem;
		font-weight: 600;
		color: color-mix(in srgb, var(--gc) 78%, var(--ink));
	}
	.sk-modal-note {
		margin: 0.28rem 0 0;
		font-size: 0.74rem;
		line-height: 1.6;
		color: var(--ink-2);
	}
	.sk-modal-lv {
		flex: none;
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.08rem;
	}
	.sk-modal-lv b {
		font-size: 1.2rem;
		font-weight: 800;
		line-height: 1;
		color: var(--gold-dp);
		font-variant-numeric: tabular-nums;
	}
	.sk-modal-lv > span {
		font-size: 0.64rem;
		color: var(--ink-2);
	}
	.sk-modal-pips {
		display: inline-flex;
		gap: 3px;
		margin-top: 0.2rem;
	}
	.sk-modal-pips i {
		display: block;
		width: 13px;
		height: 5px;
		border-radius: 2px;
		background: color-mix(in srgb, var(--ink-2) 24%, transparent);
		transition: background 240ms ease;
	}
	.sk-modal-pips i.on {
		background: linear-gradient(90deg, var(--gold), var(--gold-dp));
	}
	.sk-modal-prog {
		display: grid;
		grid-template-columns: auto auto minmax(0, 1fr) auto;
		align-items: center;
		gap: 0.55rem;
		padding: 0.7rem 1.15rem;
		border-bottom: 1px dashed var(--line);
	}
	.sk-modal-cap {
		font-size: 0.64rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		color: var(--ink-2);
	}
	.sk-modal-prog-num {
		font-size: 0.7rem;
		color: var(--ink-2);
		font-variant-numeric: tabular-nums;
	}
	.sk-modal-prog-num b {
		font-size: 0.88rem;
		color: var(--gold-dp);
	}
	.sk-modal-prog-bar {
		height: 6px;
		border-radius: 99px;
		background: color-mix(in srgb, var(--ink-2) 18%, transparent);
		overflow: hidden;
	}
	.sk-modal-prog-bar > span {
		display: block;
		height: 100%;
		border-radius: 99px;
		background: linear-gradient(90deg, var(--gold), var(--gold-dp));
		transition: width 320ms cubic-bezier(0.4, 0, 0.2, 1);
	}
	.sk-modal-prog-hint {
		font-size: 0.62rem;
		color: var(--ink-2);
		opacity: 0.85;
	}
	.sk-modal-list {
		flex: 1 1 auto;
		min-height: 0;
		display: grid;
		gap: 0.42rem;
		margin: 0;
		padding: 0.85rem 1.15rem;
		list-style: none;
		overflow-y: auto;
		overscroll-behavior: contain;
	}
	.sk-check {
		display: grid;
		grid-template-columns: 1.35rem minmax(0, 1fr);
		gap: 0.6rem;
		align-items: start;
		width: 100%;
		padding: 0.6rem 0.7rem;
		border: 1px solid var(--line);
		border-radius: 0.7rem;
		background: var(--face-1);
		text-align: left;
		cursor: pointer;
		transition:
			border-color 180ms ease,
			background 180ms ease,
			transform 180ms ease;
	}
	.sk-check:hover {
		border-color: color-mix(in srgb, var(--gold) 58%, transparent);
		background: color-mix(in srgb, var(--gold) 7%, var(--face-1));
		transform: translateX(2px);
	}
	.sk-check-box {
		display: grid;
		place-items: center;
		width: 1.35rem;
		height: 1.35rem;
		border: 1.5px dashed color-mix(in srgb, var(--ink-2) 46%, transparent);
		border-radius: 0.34rem;
		background: var(--panel-2);
		font-size: 0.74rem;
		font-weight: 900;
		color: #fff8e6;
		transition:
			background 200ms ease,
			border-color 200ms ease,
			box-shadow 200ms ease;
	}
	.sk-check-txt {
		display: grid;
		gap: 0.14rem;
		min-width: 0;
	}
	.sk-check-txt b {
		font-size: 0.8rem;
		font-weight: 700;
		line-height: 1.4;
		color: var(--ink);
	}
	.sk-check-txt em {
		font-style: normal;
		font-size: 0.71rem;
		line-height: 1.6;
		color: var(--ink-2);
	}
	.sk-check.on {
		border-color: color-mix(in srgb, var(--gold) 62%, transparent);
		background: color-mix(in srgb, var(--gold) 11%, var(--face-1));
	}
	.sk-check.on .sk-check-box {
		border: 1.5px solid var(--gold-dp);
		background: linear-gradient(180deg, var(--gold), var(--gold-dp));
		box-shadow: 0 2px 8px color-mix(in srgb, var(--gold) 45%, transparent);
	}
	.sk-check.on .sk-check-txt b {
		color: var(--gold-dp);
	}
	.sk-modal-foot {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.55rem 1rem;
		padding: 0.75rem 1.15rem 0.9rem;
		border-top: 1px solid var(--line);
		background: var(--panel-2);
	}
	.sk-modal-rel {
		display: grid;
		gap: 0.14rem;
		min-width: 0;
	}
	.sk-modal-rel p {
		display: flex;
		align-items: baseline;
		gap: 0.4rem;
		margin: 0;
		font-size: 0.68rem;
		line-height: 1.5;
		color: var(--ink-2);
	}
	.sk-modal-kids {
		color: var(--ink);
	}
	.sk-modal-acts {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		margin-left: auto;
	}
	.sk-modal-gain {
		padding: 0.16rem 0.52rem;
		border: 1px solid color-mix(in srgb, var(--ac) 55%, transparent);
		border-radius: 99px;
		background: color-mix(in srgb, var(--ac) 16%, transparent);
		font-size: 0.66rem;
		font-weight: 800;
		color: color-mix(in srgb, var(--ac) 86%, var(--ink));
	}
	.sk-modal-gain em {
		margin-left: 0.26rem;
		font-style: normal;
		font-weight: 600;
		opacity: 0.75;
	}
	.sk-modal-btn {
		padding: 0.34rem 0.8rem;
		border: 1px solid var(--line);
		border-radius: 99px;
		background: var(--face-1);
		font-size: 0.72rem;
		font-weight: 700;
		color: var(--ink-2);
		cursor: pointer;
		transition:
			color 180ms ease,
			border-color 180ms ease,
			background 180ms ease;
	}
	.sk-modal-btn:hover:not(:disabled) {
		border-color: color-mix(in srgb, var(--gold) 55%, transparent);
		color: var(--gold-dp);
	}
	.sk-modal-btn:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
	.sk-modal-btn.is-primary {
		border-color: color-mix(in srgb, var(--gold) 62%, transparent);
		background: linear-gradient(
			180deg,
			color-mix(in srgb, var(--gold) 88%, #fff),
			var(--gold-dp)
		);
		color: #fff9ea;
	}

	/* ===================== 响应式 ===================== */
	@media (max-width: 560px) {
		.sk-modal-box {
			width: 94vw;
			max-height: 88vh;
		}
		.sk-modal-head {
			gap: 0.6rem;
			padding: 0.9rem 0.9rem 0.75rem;
		}
		.sk-modal-logo {
			width: 36px;
			height: 36px;
			padding: 6px;
		}
		.sk-modal-prog {
			grid-template-columns: auto auto minmax(0, 1fr);
			padding: 0.6rem 0.9rem;
		}
		.sk-modal-prog-hint {
			display: none;
		}
		.sk-modal-list {
			padding: 0.7rem 0.9rem;
		}
		.sk-modal-foot {
			padding: 0.65rem 0.9rem 0.8rem;
		}
		.sk-modal-acts {
			width: 100%;
			margin-left: 0;
		}
		.sk-modal-gain {
			margin-right: auto;
		}
	}
	@media (max-width: 1240px) {
		.sk-canvas {
			--tile: 48px;
			--gx: 15px;
			--gy: 38px;
		}
	}
	@media (max-width: 1024px) {
		.sk-canvas {
			--tile: 43px;
			--gx: 13px;
			--gy: 34px;
		}
		.sk-foot {
			grid-template-columns: minmax(0, 1fr);
		}
		.sk-summary-foot {
			grid-template-columns: minmax(0, 1fr);
		}
	}
	@media (max-width: 820px) {
		.sk-canvas {
			--tile: 40px;
			--gx: 11px;
			--gy: 30px;
			padding: 1.1rem 0.9rem 1.2rem;
		}
		.sk-name {
			display: none;
		}
		.sk-stats {
			width: 100%;
			justify-content: space-between;
		}
		.sk-lockmark {
			display: none;
		}
		/* 窄屏放不下 6 列，砍掉「满级 / 属性」两列，保留名字、进度、数值 */
		.sk-sum-row {
			grid-template-columns: 5.6rem minmax(2.2rem, 1fr) 3rem 2.2rem;
		}
		.sk-sum-maxed,
		.sk-sum-attr {
			display: none;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.sk-tile,
		.sk-cell,
		.sk-water,
		.sk-logo,
		.sk-wire,
		.sk-tip,
		.sk-check,
		.sk-check-box,
		.sk-modal-prog-bar > span,
		.sk-modal-pips i {
			transition: none !important;
			animation: none !important;
		}
	}
</style>
