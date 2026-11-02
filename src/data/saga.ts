/**
 * 话本引擎：把「彻底点亮一个技能」变成连载小说的一回。
 *
 * 关键设计：**正文不和技能一一对应。**
 * 技能只是「领签」——点亮任意一个技能就多得一回可看的额度；
 * 小说本身按自己的节奏写（四卷 × 六十回），加技能、换技能都不会打乱剧情。
 *
 * 三条规则保证读到的永远是连着的下一回：
 *   1. 已掌握的技能记在 aemeath-saga-maxed（同一个技能反复点亮不会重复领签）。
 *   2. 可看额度 = 已掌握的技能总数。额度没到第 N 回，就绝不发放第 N 回。
 *   3. 每次只发一回，且读完一封才发下一封（节奏由 StoryInbox 驱动），不会灌屏。
 *
 * 技能不够时，后面的回目暂时锁着——不报错、不重复弹，以后加技能自然追上。
 */
import {
	type GraphId,
	pruneStoryIds,
	unlockedStoryIds,
	unlockStoryIds,
} from "@/data/cultivation";
import type { Story } from "@/data/cultivationStories";
import type { RawVolume } from "@/data/saga/types";
import { VOL1 } from "@/data/saga/vol1";
import { VOL2 } from "@/data/saga/vol2";
import { VOL3 } from "@/data/saga/vol3";
import { VOL4 } from "@/data/saga/vol4";

/** 话本的一回 */
export interface SagaChapter {
	id: string;
	/** 回目序号，0 = 序章 */
	no: number;
	/** 卷名，如「卷一·穷巷」 */
	volume: string;
	title: string;
	paragraphs: string[];
	/** 正文字数（去空白），书架里显示「约 x 字」用，构建时算一次 */
	chars: number;
}

/** 一卷 = 一组连续的回目 */
export type SagaVolume = RawVolume;

const VOLUMES: SagaVolume[] = [VOL1, VOL2, VOL3, VOL4];

/** 全卷按「先卷后回」展开成一维数组，下标即回目顺序 */
const CHAPTERS: SagaChapter[] = [];
for (const v of VOLUMES) {
	v.chapters.forEach((c) => {
		CHAPTERS.push({
			id: `saga-${String(CHAPTERS.length + 1).padStart(3, "0")}`,
			no: CHAPTERS.length,
			volume: v.name,
			title: c.title,
			paragraphs: c.paragraphs,
			chars: c.paragraphs.reduce((n, p) => n + p.replace(/\s/g, "").length, 0),
		});
	});
}

const BY_ID: Record<string, SagaChapter> = {};
for (const c of CHAPTERS) BY_ID[c.id] = c;

/** 已经彻底掌握过的技能（graph:skillId → 领过签的不再重复领） */
const MAXED_KEY = "aemeath-saga-maxed";

function readMaxed(): Set<string> {
	if (typeof localStorage === "undefined") return new Set();
	try {
		const raw = localStorage.getItem(MAXED_KEY);
		if (!raw) return new Set();
		const v = JSON.parse(raw);
		return new Set(Array.isArray(v) ? (v as string[]) : []);
	} catch {
		return new Set();
	}
}

function writeMaxed(set: Set<string>): void {
	if (typeof localStorage === "undefined") return;
	try {
		localStorage.setItem(MAXED_KEY, JSON.stringify([...set]));
	} catch {
		/* 隐私模式忽略 */
	}
}

/** id 是不是话本回目（收件箱用它区分两种信） */
export function isSagaId(id: string): boolean {
	return id.startsWith("saga-");
}

/** 按 id 取回目（不是话本 id 返回 null） */
export function getSagaChapter(id: string): SagaChapter | null {
	return BY_ID[id] ?? null;
}

/** 把回目包装成「飞剑传书」能显示的一封信 */
export function getSagaStory(id: string): Story | null {
	const c = BY_ID[id];
	if (!c) return null;
	return {
		id: c.id,
		title: c.no === 0 ? `序章 · ${c.title}` : `第 ${c.no} 回 · ${c.title}`,
		from: c.volume,
		paragraphs: c.paragraphs,
	};
}

/** 目前一共写了多少回 */
export function sagaChapterCount(): number {
	return CHAPTERS.length;
}

/** 全部回目（含尚未启封的），书架按这个顺序铺目录 */
export function allSagaChapters(): readonly SagaChapter[] {
	return CHAPTERS;
}

/** 全书正文总字数 */
export function sagaTotalChars(): number {
	return CHAPTERS.reduce((n, c) => n + c.chars, 0);
}

/**
 * 已挣得的额度 = 彻底点亮过的技能数（封顶全书回数）。
 * 书架用它算「再点亮几个技能能开下一回」。
 */
export function sagaEarnedQuota(): number {
	return Math.min(readMaxed().size, CHAPTERS.length);
}

/**
 * 改版迁移：旧版回目 id 是 saga-cs-000 这种（按技能图编号），新版统一成 saga-001。
 * 旧 id 在新注册表里查不到，留着只会让红点数着几封打不开的信，这里一次性清掉。
 */
export function pruneLegacyChapters(): void {
	if (typeof localStorage === "undefined") return;
	pruneStoryIds((id) => id.startsWith("saga-") && !BY_ID[id]);
}

// 模块载入时清一次旧版回目：幂等，没有旧数据就什么都不做
pruneLegacyChapters();

/**
 * 发放：找出「回目最靠前、额度已到、但还没发过」的那一回发出去。
 * 额度没到就停下——不跳回、不剧透。每次只发一回。
 */
export function pumpSaga(): string[] {
	const quota = Math.min(readMaxed().size, CHAPTERS.length);
	const unlocked = unlockedStoryIds();
	for (let i = 0; i < quota; i++) {
		const c = CHAPTERS[i];
		if (unlocked.has(c.id)) continue;
		return unlockStoryIds([c.id]);
	}
	return [];
}

/** 领签：把技能记进「已掌握」，返回本次是否为新领签 */
function grant(graph: GraphId, skillId: string, set: Set<string>): boolean {
	const key = `${graph}:${skillId}`;
	if (set.has(key)) return false;
	set.add(key);
	return true;
}

/**
 * 点亮了一个技能（勾满它自己的清单）→ 领一枚签，然后尝试发放。
 * 幂等：同一个技能来回勾了又取消，不会重复给回目。
 */
export function earnChapterForSkill(graph: GraphId, skillId: string): string[] {
	const set = readMaxed();
	if (grant(graph, skillId, set)) writeMaxed(set);
	return pumpSaga();
}

/**
 * 存量补课：进页面时把已经满级的技能一次性记上。
 * 发放仍然一次一回，不会因为存量大就灌屏。
 */
export function syncMaxedSkills(graph: GraphId, skillIds: string[]): string[] {
	const set = readMaxed();
	let changed = false;
	for (const id of skillIds) changed = grant(graph, id, set) || changed;
	if (changed) writeMaxed(set);
	return pumpSaga();
}
