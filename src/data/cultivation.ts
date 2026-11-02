/**
 * 修仙体系：把站内四张技能图串成一条「凡人修仙传」式的修行路。
 *
 * 规则很简单：
 *   修为 = 每勾一条学习清单，按该技能**方向的重要度权重**（1~5）得修为。
 *   一个技能的总修为 = 清单条数（难度）× 方向权重（重要度）——
 *   越难、越重要的技能，学满给的修为越多，不需要再单独标难度系数。
 *
 * 境界（凡人修仙传）：炼气 → 筑基 → 结丹 → 元婴 → 化神 → 炼虚 → 合体 → 大乘 → 渡劫。
 * 门禁按全局修为占比算（总修为随数据自动变化，阈值用百分比而不是写死的数字）：
 *   炼气入道只能进计算机基础；筑基开前端；结丹开后端；元婴开 Agent；
 *   化神以后没有新图，纯境界爬升，渡劫即修行圆满。
 *
 * 进度来源与 SkillTree.svelte 完全同源：四个 localStorage 键里的
 * `Record<skillId, 勾选索引[]>`（兼容旧版数字 / id 数组格式）；
 * 没有存档（SSR / 新访客）时按各图 PRESET 兜底——和技能图首屏渲染用的是同一份数据，
 * 所以不会出现「面板和图显示的境界对不上」。
 */
import { AG_CHECKS } from "@/data/agentChecks";
import { AG_PRESET, AG_SKILLS } from "@/data/agentSkills";
import { BE_CHECKS } from "@/data/backendChecks";
import { BE_PRESET, BE_SKILLS } from "@/data/backendSkills";
import { CS_CHECKS } from "@/data/csChecks";
import { CS_PRESET, CS_SKILLS } from "@/data/csSkills";
import {
	COMBO_STORY,
	FINALE_STORY,
	FIRST_SLAY_STORY,
	FLIPFLOP_STORY,
	GRAPH_FIRST_STORY,
	GRAPH_STORY,
	getStory,
	MILESTONE_STORY,
	ONE_SHOT_STORY,
	REALM_STORY,
	SECRET_POOL,
	TIME_STORY,
	UNLEARN_STORY,
	VISIT_ALL_STORY,
} from "@/data/cultivationStories";
import { EN_CHECKS } from "@/data/englishChecks";
import { EN_PRESET, EN_SKILLS } from "@/data/englishSkills";
import { FN_CHECKS } from "@/data/financeChecks";
import { FN_PRESET, FN_SKILLS } from "@/data/financeSkills";
import { MU_CHECKS } from "@/data/musicChecks";
import { MU_PRESET, MU_SKILLS } from "@/data/musicSkills";
import { SKILL_CHECKS } from "@/data/skillChecks";
import { SKILLS as FE_SKILLS, PRESET } from "@/data/skills";

/**
 * 站内技能图的统一标识。
 *
 * - cs / fe / be / ag 是**修行路**：进 GRAPH_JOURNEY，算修为、挂境界门禁、发飞剑传书。
 * - mu / en / fn 是**修行录**：进 GRAPH_RECORD 但没有任何门禁，且 SkillTree 传了
 *   noCultivation，所以既不加修为也不进九境界的统计、不发传书、不领话本签。
 *   它们的进度只看图内属性（音准 / 语音 / 词汇 …），不进境界链。
 */
export type GraphId = "cs" | "fe" | "be" | "ag" | "mu" | "en" | "fn";

/** 一个境界：minPct 是达到该境界所需的全局修为占比 */
export interface Realm {
	name: string;
	minPct: number;
	/** 该境界的一句话注解（凡人修仙传味儿） */
	note: string;
}

export const REALMS: Realm[] = [
	{
		name: "炼气期",
		minPct: 0,
		note: "引气入体，踏入修仙之门。凡人入道，先从计算机基础打坐。",
	},
	{
		name: "筑基期",
		minPct: 8,
		note: "筑就道基，寿元倍增，可御器飞行——前端技能图已对你敞开。",
	},
	{
		name: "结丹期",
		minPct: 18,
		note: "凝结金丹，脱胎换骨，不再是凡俗散修——后端技能图已解锁。",
	},
	{
		name: "元婴期",
		minPct: 30,
		note: "元婴大成，神识离体，一念千里——Agent 开发图已解锁。",
	},
	{ name: "化神期", minPct: 44, note: "炼化神识，明悟大道，一界知名。" },
	{ name: "炼虚期", minPct: 58, note: "炼虚合道，身融虚空。" },
	{ name: "合体期", minPct: 72, note: "法体合一，移山填海。" },
	{ name: "大乘期", minPct: 86, note: "大乘之境，人界已少有敌手。" },
	{
		name: "渡劫期",
		minPct: 100,
		note: "天劫加身，渡过便是真仙。四图圆满，修行功德圆满。",
	},
];

/** 方向重要度权重：每勾一条清单得多少修为（1~5）。核心地基给高权重。 */
const XP_WEIGHTS: Record<GraphId, Record<string, number>> = {
	// 计算机：数据结构与算法、OS、网络、数据库是科班硬通货
	cs: {
		"cs-math": 3,
		"cs-lang": 3,
		"cs-dsa": 5,
		"cs-hw": 2,
		"cs-os": 4,
		"cs-net": 4,
		"cs-db": 4,
		"cs-compiler": 2,
		"cs-se": 3,
		"cs-adv": 2,
	},
	// 前端：语言基石是本命，框架与工程化次之；服务端目录级知识权重低（后端图里另有细账）
	fe: {
		"lang-basics": 5,
		"type-system": 3,
		browser: 3,
		framework: 4,
		engineering: 3,
		quality: 2,
		visual: 2,
		backend: 2,
		architecture: 3,
		growth: 2,
	},
	// 后端：数据与存储最值钱；「已有基础」两个方块是送的，只给象征性修为
	be: {
		"be-start": 1,
		"be-lang": 3,
		"be-web": 4,
		"be-data": 5,
		"be-sec": 3,
		"be-ops": 3,
		"be-arch": 4,
	},
	// Agent：工具与编排是核心手艺，模型基础与评测次之
	ag: {
		"ag-foundation": 4,
		"ag-prompt": 3,
		"ag-rag": 4,
		"ag-tool": 5,
		"ag-memory": 3,
		"ag-eval": 4,
		"ag-app": 3,
	},
	// 音乐：只在修炼路成立时才会被读到（SkillTree 传 noCultivation 时整个修为层被跳过），
	// 这里保留一份是为了数据自检时几组权重表结构一致。
	mu: {
		"mu-listen": 5,
		"mu-theory": 3,
		"mu-instrument": 4,
		"mu-vocal": 3,
		"mu-compose": 4,
		"mu-produce": 3,
		"mu-stage": 2,
	},
	// 英语：同样只为结构一致而存在
	en: {
		"en-sound": 5,
		"en-vocab": 5,
		"en-grammar": 3,
		"en-listen": 4,
		"en-speak": 4,
		"en-read": 3,
		"en-write": 3,
		"en-academic": 2,
	},
	// 理财：同样只为结构一致而存在
	fn: {
		"fn-track": 5,
		"fn-budget": 4,
		"fn-buffer": 5,
		"fn-consume": 3,
		"fn-debt": 4,
		"fn-protect": 4,
		"fn-invest": 3,
		"fn-plan": 2,
	},
};

/** 一张图在修行路上的元数据 */
export interface JourneyGraph {
	id: GraphId;
	name: string;
	href: string;
	/** 解锁所需境界在 REALMS 里的下标（cs=0 炼气即可入） */
	realmIndex: number;
	/** 图鉴上的门槛说明（如「需筑基期」；入道图写「凡人入道」） */
	gateLabel: string;
	storageKey: string;
	skills: { id: string; group: string }[];
	checks: Record<string, unknown[]>;
	preset: Record<string, number>;
}

export const GRAPH_JOURNEY: JourneyGraph[] = [
	{
		id: "cs",
		name: "计算机基础",
		href: "/cs/",
		realmIndex: 0,
		gateLabel: "凡人入道",
		storageKey: "aemeath-cs-tree",
		skills: CS_SKILLS,
		checks: CS_CHECKS,
		preset: CS_PRESET,
	},
	{
		id: "fe",
		name: "前端技能图",
		href: "/skills/",
		realmIndex: 1,
		gateLabel: "需筑基期",
		storageKey: "aemeath-skill-tree",
		skills: FE_SKILLS,
		checks: SKILL_CHECKS,
		preset: PRESET,
	},
	{
		id: "be",
		name: "后端技能图",
		href: "/backend/",
		realmIndex: 2,
		gateLabel: "需结丹期",
		storageKey: "aemeath-backend-tree",
		skills: BE_SKILLS,
		checks: BE_CHECKS,
		preset: BE_PRESET,
	},
	{
		id: "ag",
		name: "Agent 开发",
		href: "/agent/",
		realmIndex: 3,
		gateLabel: "需元婴期",
		storageKey: "aemeath-agent-tree",
		skills: AG_SKILLS,
		checks: AG_CHECKS,
		preset: AG_PRESET,
	},
];

/**
 * 修行录：和修行路**没有先后关系**的图（音乐 / 英语 / 理财 / 睡眠 …）。
 *
 * 为什么不塞进 GRAPH_JOURNEY：那份表参与 computeCultivation 的总修为累加，
 * 往里加图会稀释全站修为百分比，把已经升到元婴的访客按比例压回结丹。
 * 软技能本来就该「随时能进」，所以单独一张表：
 *   · 不算修为、不进九境界统计、不受门禁
 *   · 不发飞剑传书、不领话本签（SkillTree 传 noCultivation 负责跳过那几处）
 *   · 图内的属性（音准 / 技法 / 作品）就是它唯一的进度
 */
export interface RecordGraph extends Omit<JourneyGraph, "realmIndex"> {
	/** 修行录的说明文案，替换掉「需 XX 期」那一套 */
	gateLabel: string;
}

export const GRAPH_RECORD: RecordGraph[] = [
	{
		id: "mu",
		name: "音乐",
		href: "/music/",
		gateLabel: "无门禁 · 随时可进",
		storageKey: "aemeath-music-tree",
		skills: MU_SKILLS,
		checks: MU_CHECKS,
		preset: MU_PRESET,
	},
	{
		id: "en",
		name: "英语",
		href: "/english/",
		gateLabel: "无门禁 · 随时可进",
		storageKey: "aemeath-english-tree",
		skills: EN_SKILLS,
		checks: EN_CHECKS,
		preset: EN_PRESET,
	},
	{
		id: "fn",
		name: "理财",
		href: "/finance/",
		gateLabel: "无门禁 · 随时可进",
		storageKey: "aemeath-finance-tree",
		skills: FN_SKILLS,
		checks: FN_CHECKS,
		preset: FN_PRESET,
	},
];

/** 按 id 找修行路上的图（找不到视为炼气期锁定态，防御性兜底） */
export function journeyOf(id: GraphId): JourneyGraph {
	return GRAPH_JOURNEY.find((g) => g.id === id) ?? GRAPH_JOURNEY[0];
}

/**
 * 找一张图的元数据，**修行路和修行录一起找**。
 * 修行录不在 GRAPH_JOURNEY 里（为了不稀释总修为），但读写存档、
 * 查技能所属方向这些逻辑对两者一视同仁，所以走这一个入口。
 */
export function graphMetaOf(
	id: GraphId,
): (JourneyGraph | RecordGraph) | undefined {
	return (
		GRAPH_JOURNEY.find((g) => g.id === id) ??
		GRAPH_RECORD.find((g) => g.id === id)
	);
}

/** 是不是修行录图（修行录没有门禁，也没有 realmIndex） */
export function isRecordGraph(id: GraphId): boolean {
	return GRAPH_RECORD.some((g) => g.id === id);
}

/** SkillTree 的等级上限规则：有清单按条数，没清单退回 5 */
function capOf(g: JourneyGraph | RecordGraph, id: string): number {
	return g.checks[id]?.length ?? 5;
}

/** 游客「只想看看」的放行标记（仅当前标签页生效，关掉就恢复结界） */
const BYPASS_KEY = "aemeath-realm-bypass";

export interface CultivationState {
	/** 当前修为 / 全局总修为 */
	xp: number;
	totalXp: number;
	pct: number;
	/** 当前境界下标（0=炼气） */
	realmIndex: number;
	realm: Realm;
	/** 下一境界；渡劫期已是顶点则为 null */
	next: Realm | null;
	/** 距下一境界还差多少修为（next 为 null 时为 0） */
	toNextXp: number;
	/** 各图是否对当前访客开放（含游客放行标记） */
	unlocked: Record<GraphId, boolean>;
}

/** 读取一张图的掌握度：skillId → 已勾条数（兼容 SkillTree 的三代存档格式） */
function readGraphLevels(
	g: JourneyGraph | RecordGraph,
): Record<string, number> {
	const levels: Record<string, number> = {};
	let stored: unknown = null;
	if (typeof localStorage !== "undefined") {
		try {
			const raw = localStorage.getItem(g.storageKey);
			if (raw) stored = JSON.parse(raw);
		} catch {
			stored = null;
		}
	}
	if (stored == null) {
		// 没有存档（SSR / 新访客）：与 SkillTree 首屏一样按出厂预设算
		for (const s of g.skills)
			levels[s.id] = Math.min(capOf(g, s.id), g.preset[s.id] ?? 0);
		return levels;
	}
	if (Array.isArray(stored)) {
		// 最老格式：已点亮 id 的数组，每个按 2 级算（与 SkillTree.readStored 一致）
		const ids = new Set(g.skills.map((s) => s.id));
		for (const id of stored)
			if (typeof id === "string" && ids.has(id))
				levels[id] = Math.min(capOf(g, id), 2);
		return levels;
	}
	if (typeof stored === "object") {
		for (const s of g.skills) {
			const v = (stored as Record<string, unknown>)[s.id];
			if (typeof v === "number")
				levels[s.id] = Math.min(capOf(g, s.id), Math.max(0, v));
			else if (Array.isArray(v))
				levels[s.id] = Math.min(capOf(g, s.id), v.length);
		}
	}
	return levels;
}

/** 汇总四张图算出修为与境界 */
export function computeCultivation(
	levelsByGraph: Record<GraphId, Record<string, number>>,
): {
	xp: number;
	totalXp: number;
} {
	let xp = 0;
	let totalXp = 0;
	for (const g of GRAPH_JOURNEY) {
		const weights = XP_WEIGHTS[g.id];
		const levels = levelsByGraph[g.id] ?? {};
		for (const s of g.skills) {
			const cap = capOf(g, s.id);
			const w = weights[s.group] ?? 1;
			totalXp += cap * w;
			xp += Math.min(cap, levels[s.id] ?? 0) * w;
		}
	}
	return { xp, totalXp };
}

/** 当前快照：读四个存档键 + 游客放行标记，算境界与各图解锁状态 */
export function snapshot(): CultivationState {
	const levelsByGraph = {} as Record<GraphId, Record<string, number>>;
	for (const g of GRAPH_JOURNEY) levelsByGraph[g.id] = readGraphLevels(g);
	const { xp, totalXp } = computeCultivation(levelsByGraph);
	const pct = totalXp > 0 ? (xp / totalXp) * 100 : 0;

	let realmIndex = 0;
	for (let i = 0; i < REALMS.length; i++)
		if (pct >= REALMS[i].minPct) realmIndex = i;
	const realm = REALMS[realmIndex];
	const next = realmIndex + 1 < REALMS.length ? REALMS[realmIndex + 1] : null;
	const nextXp = next ? Math.ceil((next.minPct / 100) * totalXp) : 0;

	let bypassed = false;
	if (typeof sessionStorage !== "undefined") {
		try {
			bypassed = sessionStorage.getItem(BYPASS_KEY) === "1";
		} catch {
			bypassed = false;
		}
	}
	const unlocked = {} as Record<GraphId, boolean>;
	for (const g of GRAPH_JOURNEY)
		unlocked[g.id] = bypassed || realmIndex >= g.realmIndex;
	// 修行录永远开放：它不在境界链上，也不参与修为统计
	for (const g of GRAPH_RECORD) unlocked[g.id] = true;

	return {
		xp,
		totalXp,
		pct,
		realmIndex,
		realm,
		next,
		toNextXp: next ? Math.max(0, nextXp - xp) : 0,
		unlocked,
	};
}

/** SkillTree 勾选后要广播的事件名（persist() 里 dispatch，面板与结界监听它刷新） */
export const CULTIVATION_EVENT = "aemeath-cultivation-changed";

/** 游客放行：点下后当前标签页内四图全开 */
export function letVisitorThrough(): void {
	try {
		sessionStorage.setItem(BYPASS_KEY, "1");
	} catch {
		/* 隐私模式写不进就算了 */
	}
	if (typeof window !== "undefined")
		window.dispatchEvent(new CustomEvent(CULTIVATION_EVENT));
}

/* ===========================================================================
 * 沉浸层：斩妖 / 连斩 / 修为日志 / 隐藏剧情触发器
 *
 * 这一层把「勾选一条清单」包装成一次「斩妖」：给修为、记日志、连斩计数，
 * 并在跨境界 / 学满方向 / 首杀 / 全图圆满时解锁隐藏的「飞剑传书」剧情。
 * 所有事件都挂在 window 上，供 SkillTree（飘字 + 音效）、CultivationPanel
 * （修行手札）、BreakthroughRite（突破大典）、StoryInbox（飞剑传书收件箱）各自监听。
 * =========================================================================== */

/** 勾选一条清单后广播的「斩妖」事件（detail 见 SlayResult） */
export const SLAY_EVENT = "aemeath-slay";
/** 跨过境界阈值时广播（detail: { from, to, realmName }） */
export const BREAKTHROUGH_EVENT = "aemeath-breakthrough";
/** 解锁一封新剧情时广播（detail: { ids: string[] }） */
export const STORY_EVENT = "aemeath-story-unlocked";

/* --- 沉浸层入口的打开指令 ---
 * 入口按钮放在侧栏「修行」卡片里（随文档滚动，不做 fixed 悬浮），
 * 主体 dialog 仍常驻 Layout 的 body 底部，两者靠这两个事件搭桥。 */
export const OPEN_INBOX_EVENT = "aemeath-open-inbox";
export const OPEN_SHELF_EVENT = "aemeath-open-shelf";

const LOG_KEY = "aemeath-cultivation-log";
const STORIES_KEY = "aemeath-stories-unlocked";
const LOG_CAP = 600;

export interface SlayLogEntry {
	ts: number;
	graph: GraphId;
	skillId: string;
	index: number;
	title: string;
	xp: number;
	/** 本次修行动词（斩 / 参悟 / 筑 / 点染 …） */
	verb: string;
}

export interface SlayInput {
	graph: GraphId;
	skillId: string;
	index: number;
	title: string;
	/** 本次勾选前的境界下标（用来判断有没有跨过阈值） */
	beforeRealm: number;
}

export interface SlayResult {
	xpGained: number;
	/** 连斩数（3 秒内连续勾选累计，单次为 1） */
	combo: number;
	/** 本次解锁的剧情 id（已去重，不含之前解锁过的） */
	stories: string[];
	/** 本次跨到的境界下标（没跨境界则为 null） */
	breakthroughTo: number | null;
	/** 本次修行用的动词（斩 / 参悟 / 筑 / 点染 …） */
	action: string;
	/** 连悟档位名（如「渐入佳境」），未达档位为 null */
	comboTier: string | null;
	/** 本次是否触发了「机缘」金色彩蛋 */
	isSecret: boolean;
}

/** 某技能所属方向（修行路与修行录的技能表一起查） */
function groupOf(graph: GraphId, skillId: string): string | undefined {
	return graphMetaOf(graph)?.skills.find((s) => s.id === skillId)?.group;
}

/** 勾一条清单得多少修为（方向权重） */
export function weightOf(graph: GraphId, skillId: string): number {
	const group = groupOf(graph, skillId);
	return (group && XP_WEIGHTS[graph]?.[group]) || 1;
}

/* ---------- 修行动词：按领域给不同的「修行动作」文案 ---------- */
/**
 * 不同方向用不同的动词，让反馈不千篇一律：算法破阵用「斩」、语言基础用「参悟」、
 * 框架架构用「筑」、工程化安全用「精进」、视觉用「点染」、数据用「汲取」……
 * 某个方向没显式配，则回退到「参悟」。
 */
const ACTION_BY_GROUP: Record<GraphId, Record<string, string>> = {
	cs: {
		"cs-math": "斩",
		"cs-lang": "参悟",
		"cs-dsa": "斩",
		"cs-hw": "参悟",
		"cs-os": "斩",
		"cs-net": "斩",
		"cs-db": "汲取",
		"cs-compiler": "斩",
		"cs-se": "精进",
		"cs-adv": "参悟",
	},
	fe: {
		"lang-basics": "参悟",
		"type-system": "参悟",
		browser: "参悟",
		framework: "筑",
		engineering: "精进",
		quality: "精进",
		visual: "点染",
		backend: "参悟",
		architecture: "筑",
		growth: "精进",
	},
	be: {
		"be-start": "参悟",
		"be-lang": "参悟",
		"be-web": "筑",
		"be-data": "汲取",
		"be-sec": "护",
		"be-ops": "精进",
		"be-arch": "筑",
	},
	ag: {
		"ag-foundation": "禀",
		"ag-prompt": "悟",
		"ag-rag": "汲取",
		"ag-tool": "御",
		"ag-memory": "记",
		"ag-eval": "鉴",
		"ag-app": "筑",
	},
	// 音乐：听觉靠「听」，演奏靠「抚」，创作靠「谱」，演出靠「演」
	mu: {
		"mu-listen": "听",
		"mu-theory": "参悟",
		"mu-instrument": "抚",
		"mu-vocal": "咏",
		"mu-compose": "谱",
		"mu-produce": "调",
		"mu-stage": "演",
	},
	// 英语：音靠「正」，词靠「记」，句靠「通」，输出靠「达」
	en: {
		"en-sound": "正",
		"en-vocab": "记",
		"en-grammar": "通",
		"en-listen": "闻",
		"en-speak": "言",
		"en-read": "读",
		"en-write": "写",
		"en-academic": "论",
	},
	// 理财：账靠「明」，守靠「持」，钱靠「殖」，长远靠「筹」
	fn: {
		"fn-track": "明",
		"fn-budget": "节",
		"fn-buffer": "持",
		"fn-consume": "省",
		"fn-debt": "偿",
		"fn-protect": "护",
		"fn-invest": "殖",
		"fn-plan": "筹",
	},
};

/** 本次「修行动作」的动词（用于飘字 / 手札日志），如 斩 / 参悟 / 筑 / 点染 … */
export function actionVerb(graph: GraphId, skillId: string): string {
	const group = groupOf(graph, skillId);
	return (group && ACTION_BY_GROUP[graph]?.[group]) || "参悟";
}

/* ---------- 连斩：模块级状态，整页会话内累计 ---------- */
let lastSlayAt = 0;
let comboCount = 0;

/* ---------- 取消 / 反复 / 一气呵成：彩蛋判定用的会话与持久状态 ---------- */
const UNLEARN_KEY = "aemeath-unlearn-count";
/** 单会话内同一项被反复勾了又取消的次数（心猿意马彩蛋用） */
const sessionToggles: Record<string, number> = {};
/** 单会话内某方向首次参悟的时间戳（一气呵成彩蛋用） */
const groupStart: Record<string, number> = {};

function readUnlearnCount(): number {
	if (typeof localStorage === "undefined") return 0;
	try {
		const raw = localStorage.getItem(UNLEARN_KEY);
		const n = raw ? Number(raw) : 0;
		return Number.isFinite(n) ? n : 0;
	} catch {
		return 0;
	}
}

function writeUnlearnCount(n: number): void {
	if (typeof localStorage === "undefined") return;
	try {
		localStorage.setItem(UNLEARN_KEY, String(n));
	} catch {
		/* 忽略 */
	}
}

/** 时辰 key：取本地小时落入的区间 */
function timeKey(hour: number): string | null {
	if (hour >= 23 || hour < 1) return "zi";
	if (hour < 3) return "chou";
	if (hour < 5) return "yin";
	if (hour < 7) return "mao";
	if (hour >= 11 && hour < 13) return "wu";
	return null;
}

/** 机缘随机池：每次参悟约 6% 概率抽一封未解锁的（用完为止） */
function maybeSecret(): string | null {
	if (Math.random() > 0.06) return null;
	const unlocked = readUnlockedStories();
	const pool = SECRET_POOL.filter((id) => !unlocked.has(id));
	if (pool.length === 0) return null;
	return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * 取消勾选（道心）：写持久取消计数，判定 道心小劫/动摇/魔念，并触发 心猿意马。
 * 取消也会打断连悟。
 */
export function recordUnlearn(graph: GraphId, skillId: string): string[] {
	comboCount = 0;
	lastSlayAt = 0;
	const key = `${graph}:${skillId}`;
	sessionToggles[key] = (sessionToggles[key] ?? 0) + 1;

	const stories: string[] = [];
	if (sessionToggles[key] >= 3) stories.push(FLIPFLOP_STORY);

	const n = readUnlearnCount() + 1;
	writeUnlearnCount(n);
	const milestone = UNLEARN_STORY[n];
	if (milestone) stories.push(milestone);

	return unlockStories(stories);
}

/** 手动触发一个彩蛋（如连点信封），供 UI 直接调用 */
export function unlockEgg(id: string): string[] {
	return unlockStories([id]);
}

/* ---------------- 修为日志（修行手札的数据源） ---------------- */
function readLog(): SlayLogEntry[] {
	if (typeof localStorage === "undefined") return [];
	try {
		const raw = localStorage.getItem(LOG_KEY);
		if (!raw) return [];
		const v = JSON.parse(raw);
		return Array.isArray(v) ? (v as SlayLogEntry[]) : [];
	} catch {
		return [];
	}
}

function appendLog(entry: SlayLogEntry): number {
	if (typeof localStorage === "undefined") return 0;
	const log = readLog();
	log.push(entry);
	if (log.length > LOG_CAP) log.splice(0, log.length - LOG_CAP);
	try {
		localStorage.setItem(LOG_KEY, JSON.stringify(log));
	} catch {
		/* 隐私模式忽略 */
	}
	return log.length;
}

export function getCultivationLog(): SlayLogEntry[] {
	return readLog();
}

/* ---------------- 已解锁剧情集合（去重 + 持久化） ---------------- */
function readUnlockedStories(): Set<string> {
	if (typeof localStorage === "undefined") return new Set();
	try {
		const raw = localStorage.getItem(STORIES_KEY);
		if (!raw) return new Set();
		const v = JSON.parse(raw);
		return new Set(Array.isArray(v) ? (v as string[]) : []);
	} catch {
		return new Set();
	}
}

/** 解锁一批剧情，返回其中「本次新解锁」的 id 并广播 STORY_EVENT */
function unlockStories(ids: string[]): string[] {
	if (typeof localStorage === "undefined" || ids.length === 0) return [];
	const set = readUnlockedStories();
	const fresh = ids.filter((id) => !set.has(id));
	if (fresh.length === 0) return [];
	for (const id of fresh) set.add(id);
	try {
		localStorage.setItem(STORIES_KEY, JSON.stringify([...set]));
	} catch {
		/* 忽略 */
	}
	if (typeof window !== "undefined")
		window.dispatchEvent(
			new CustomEvent(STORY_EVENT, { detail: { ids: fresh } }),
		);
	return fresh;
}

/* ---------------- 方向 / 整图 是否学满 ---------------- */
function isGroupComplete(graph: GraphId, group: string): boolean {
	const g = graphMetaOf(graph);
	if (!g) return false;
	const levels = readGraphLevels(g);
	let done = 0;
	let total = 0;
	for (const s of g.skills) {
		if (s.group !== group) continue;
		done += Math.min(levels[s.id] ?? 0, g.checks[s.id]?.length ?? 0);
		total += g.checks[s.id]?.length ?? 0;
	}
	return total > 0 && done >= total;
}

function isGraphComplete(graph: GraphId): boolean {
	const g = graphMetaOf(graph);
	if (!g) return false;
	const levels = readGraphLevels(g);
	for (const s of g.skills) {
		if ((levels[s.id] ?? 0) < (g.checks[s.id]?.length ?? 0)) return false;
	}
	return true;
}

/** 当前已解锁的所有剧情 id（话本引擎用它判断某一回发过没有） */
export function unlockedStoryIds(): Set<string> {
	return readUnlockedStories();
}

/** 解锁一批剧情，返回其中「本次新解锁」的 id 并广播 STORY_EVENT（话本引擎走的就是这条路） */
export function unlockStoryIds(ids: string[]): string[] {
	return unlockStories(ids);
}

/**
 * 从已解锁集合里删掉失效的 id（话本改版回目换新时用）。
 * 不删的话，红点会把已经不存在的旧回目也算成未读，点进去又什么都打不开。
 */
export function pruneStoryIds(shouldDrop: (id: string) => boolean): number {
	const set = readUnlockedStories();
	let dropped = 0;
	const next = new Set<string>();
	for (const id of set) {
		if (shouldDrop(id)) dropped++;
		else next.add(id);
	}
	if (dropped === 0) return 0;
	if (typeof localStorage !== "undefined") {
		try {
			localStorage.setItem(STORIES_KEY, JSON.stringify([...next]));
		} catch {
			/* 隐私模式忽略 */
		}
	}
	return dropped;
}

/**
 * 修行主入口：SkillTree 在「勾上一条清单」后调用。
 * 负责给修为、写日志、连悟计数、判断跨境界与各类隐藏彩蛋触发。
 */
export function recordSlay(input: SlayInput): SlayResult {
	const xpGained = weightOf(input.graph, input.skillId);
	const now = Date.now();
	const verb = actionVerb(input.graph, input.skillId);

	// 跨境界 / 各图首悟 需要「落笔前」的快照，先取
	const beforeGraphCount = readLog().filter(
		(e) => e.graph === input.graph,
	).length;

	const logLen = appendLog({
		ts: now,
		graph: input.graph,
		skillId: input.skillId,
		index: input.index,
		title: input.title,
		xp: xpGained,
		verb,
	});

	comboCount = now - lastSlayAt <= 3000 ? comboCount + 1 : 1;
	lastSlayAt = now;

	const after = snapshot().realmIndex;
	const breakthroughTo = after > input.beforeRealm ? after : null;

	const group = groupOf(input.graph, input.skillId);

	// 一气呵成：单方向在 60 秒内从首悟到学满（会话内计时）
	const gk = `${input.graph}:${group}`;
	const groupJustDone = group ? isGroupComplete(input.graph, group) : false;
	if (group && !groupStart[gk]) groupStart[gk] = now;

	const stories: string[] = [];
	if (logLen === 1) stories.push(FIRST_SLAY_STORY);
	const firstStory = GRAPH_FIRST_STORY[input.graph];
	if (beforeGraphCount === 0 && firstStory) stories.push(firstStory);
	if (group && groupJustDone) {
		stories.push(`grp-${input.graph}-${group}`);
		// 一气呵成：方向刚学满且首悟到此刻 ≤ 60 秒
		const span = now - (groupStart[gk] ?? now);
		if (span <= 60000) stories.push(ONE_SHOT_STORY);
	}
	if (isGraphComplete(input.graph))
		stories.push(GRAPH_STORY[input.graph] as string);
	if (breakthroughTo !== null) {
		for (let r = input.beforeRealm + 1; r <= breakthroughTo; r++)
			if (REALM_STORY[r]) stories.push(REALM_STORY[r]);
	}
	// 时辰彩蛋
	const tk = timeKey(new Date(now).getHours());
	if (tk && TIME_STORY[tk]) stories.push(TIME_STORY[tk]);
	// 连悟档位
	const comboTierId =
		COMBO_STORY[comboCount as keyof typeof COMBO_STORY] ?? null;
	if (comboTierId) stories.push(comboTierId);
	// 累计里程碑（日志条数恰好命中阈值时）
	const milestone = MILESTONE_STORY[logLen as keyof typeof MILESTONE_STORY];
	if (milestone) stories.push(milestone);
	// 云游归来：四张图都参悟过
	if (
		readLog().some((e) => e.graph === "cs") &&
		readLog().some((e) => e.graph === "fe") &&
		readLog().some((e) => e.graph === "be") &&
		readLog().some((e) => e.graph === "ag")
	)
		stories.push(VISIT_ALL_STORY);
	// 机缘随机池
	const secret = maybeSecret();
	if (secret) stories.push(secret);
	// 全图圆满终局
	if (after >= REALMS.length - 1 || snapshot().pct >= 100)
		stories.push(FINALE_STORY);

	const fresh = unlockStories(stories);

	if (breakthroughTo !== null && typeof window !== "undefined") {
		const realm = REALMS[breakthroughTo];
		window.dispatchEvent(
			new CustomEvent(BREAKTHROUGH_EVENT, {
				detail: {
					from: input.beforeRealm,
					to: breakthroughTo,
					realmName: realm.name,
				},
			}),
		);
	}
	if (typeof window !== "undefined")
		window.dispatchEvent(new CustomEvent(CULTIVATION_EVENT));

	const comboTier = comboTierId != null ? getStory(comboTierId) : null;
	const comboTierName = comboTier ? comboTier.title : null;

	return {
		xpGained,
		combo: comboCount,
		stories: fresh,
		breakthroughTo,
		action: verb,
		comboTier: comboTierName,
		isSecret: secret !== null,
	};
}
