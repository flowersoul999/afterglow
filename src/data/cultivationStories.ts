/**
 * 修仙剧情库：隐藏剧情 + 飞剑传书 + 触发器映射 + 修行动词。
 *
 * 设计原则：
 *   - 本文件是「纯数据」，不 import cultivation.ts，避免循环依赖。
 *   - cultivation.ts 在每次「修行」（勾选清单）后读取这里的映射，决定解锁哪几封信。
 *   - 「心魔劫」按 图×方向 自动生成（每个方向一篇），文风是仙侠 + JOJO 梗。
 *   - 突破大典（境界跨越）配一封「传书」，由神秘老者点评这一跃。
 *   - 四图学满分别触发「初成」彩蛋；全图 100% 触发终局「飞升」。
 *   - 彩蛋（时辰 / 连悟 / 里程碑 / 机缘 / 道心 / 巡礼 等）都走同一套「解锁即飞剑传书」。
 */
import { AG_GROUPS } from "@/data/agentSkills";
import { BE_GROUPS } from "@/data/backendSkills";
import { CS_GROUPS } from "@/data/csSkills";
import type { GraphId } from "@/data/cultivation";
import { GROUPS as FE_GROUPS } from "@/data/skills";

export interface Story {
	/** 唯一 id（也是解锁集合里的键） */
	id: string;
	/** 信件标题 */
	title: string;
	/** 落款 / 寄信人 */
	from: string;
	/** 正文段落 */
	paragraphs: string[];
}

/**
 * 一张图的中文名（对应 GRAPH_JOURNEY 的 name，但这里是静态副本，避免反向 import）。
 * **修行录（mu）不在这里**：它不进 recordSlay，也就没有心魔劫与破境剧情。
 */
const GRAPH_NAME: Partial<Record<GraphId, string>> = {
	cs: "计算机基础",
	fe: "前端",
	be: "后端",
	ag: "Agent 开发",
};

/** 四张修行路图的方向分组（带中文名），用来批量生成「心魔劫」 */
const GROUP_MAP: Partial<Record<GraphId, { id: string; name: string }[]>> = {
	cs: CS_GROUPS,
	fe: FE_GROUPS,
	be: BE_GROUPS,
	ag: AG_GROUPS,
};

/* ----------------------- 心魔劫：图 × 方向，自动生成 ----------------------- */

function groupStory(graph: GraphId, g: { id: string; name: string }): Story {
	const gname = g.name;
	const line = `你以为参透了「${gname}」，便算过了这一关？`;
	return {
		id: `grp-${graph}-${g.id}`,
		title: `${GRAPH_NAME[graph]}·${gname} 心魔劫`,
		from: "无名老者",
		paragraphs: [
			`${line}`,
			"少年，心魔从不长在外面。它藏在你以为「已经会了」的地方——每一次你勾掉一项，它便退一分；可你退得越快，它笑得越轻。",
			`「${gname}」这一脉，你今日起算真正踏了进来。前路还有更多方向等着你，但记住：路不是用来走完的，是用来被你一步步踩实的。`,
			"——你的下一句话，老夫已经听到了：「这关，我过了。」",
		],
	};
}

/* ----------------------------- 剧情注册表 ----------------------------- */

export const STORIES: Record<string, Story> = {};

/** 首杀：第一次勾掉任意一条清单（改写为「初悟」） */
STORIES["first-slay"] = {
	id: "first-slay",
	title: "初入山门·第一封传书",
	from: "无名老者",
	paragraphs: [
		"你这凡人，居然敢入此门。",
		"方才那一下，是你落下的第一笔理解。它不大，甚至算不上难，但老夫看得真切——你动了手，便再没有回头路。",
		"修行之路，本就是「悟一层理，长一分修为」。你勾掉的每一条，都是一道曾拦在你面前的坎。",
		"「我不做人了，JOJO！」——不，你不必成仙成魔，你只需把今天这一关，一关关过下去。",
	],
};

/** 突破大典配套传书：境界下标 → 剧情 id */
export const REALM_STORY: Record<number, string> = {};
const realmLetters: { idx: number; title: string; paragraphs: string[] }[] = [
	{
		idx: 1,
		title: "筑基·传书",
		paragraphs: [
			"筑基成。你不再是刚入门的散修了。",
			"老夫当年筑基，也是在同一个夜晚——灵台忽地清明，仿佛整个世界都慢了半拍。你此刻站的地方，叫做「前端之地」，门已为你而开。",
			"去吧。那里的妖，比基础关凶得多，但也香得多。",
		],
	},
	{
		idx: 2,
		title: "结丹·传书",
		paragraphs: [
			"金丹凝结，脱胎换骨。",
			"后端之地，从此对你敞开。老夫得提醒你：那里的水，比表面上深。你以为会了 CRUD 便是会了后端？不，那只是刚把鞋脱在岸边。",
			"沉下去，才看得到水下的东西。",
		],
	},
	{
		idx: 3,
		title: "元婴·传书",
		paragraphs: [
			"元婴大成，神识离体。",
			"Agent 之地，是老夫当年都不敢轻易踏入的禁区——那里养的不是妖，是你亲手造出来的「器灵」。你既要教它们听话，又怕它们太听话。",
			"这一关，老夫只能送你到门口了。",
		],
	},
	{
		idx: 4,
		title: "化神·传书",
		paragraphs: [
			"化神。你已是一界之内，有名有姓的人物了。",
			"从今往后，没有新的地图为你打开——因为地图，已经全在你脚下。剩下的路，是你自己走出来的。",
			"「你的下一句话，我早就听过了。」",
		],
	},
	{
		idx: 8,
		title: "渡劫·传书",
		paragraphs: [
			"渡劫。雷在头顶，也在心里。",
			"这一关没有妖可斩，因为最后的妖，是你自己。",
		],
	},
];
for (const r of realmLetters) {
	const id = `realm-${r.idx}`;
	STORIES[id] = {
		id,
		title: r.title,
		from: "无名老者",
		paragraphs: r.paragraphs,
	};
	REALM_STORY[r.idx] = id;
}

/** 整图学满的「初成」彩蛋：图 → 剧情 id */
export const GRAPH_STORY: Partial<Record<GraphId, string>> = {};
const graphEggs: { graph: GraphId; title: string; paragraphs: string[] }[] = [
	{
		graph: "cs",
		title: "计算机基础·初成",
		paragraphs: [
			"基础关，你踏平了。",
			"老夫见过太多人，基础没打牢就急着去学法术，最后卡在半山腰下不来。你没有。",
			"「饭要一口一口吃，路要一步一步走。」——这句话老夫说了八百年，今天终于有人听得进去。",
		],
	},
	{
		graph: "fe",
		title: "前端·剑意初成",
		paragraphs: [
			"前端这一脉，你算是把剑磨亮了。",
			"别人写页面是堆砖头，你写页面是铸剑——每一根线、每一帧动画，都是剑意。",
			"「欧拉！」——对，就是这个气势，把它带到下一关去。",
		],
	},
	{
		graph: "be",
		title: "后端·道心初成",
		paragraphs: [
			"后端的水，你总算蹚到了底。",
			"分布式、存储、并发……这些曾经让你夜里睡不着的妖，如今都成了你案头的茶。",
			"道心稳了，才扛得住更大的劫。",
		],
	},
	{
		graph: "ag",
		title: "Agent·器灵认主",
		paragraphs: [
			"你造出来的「器灵」，认你为主了。",
			"这一脉，老夫当年只敢远观。你不仅进去了，还把它驯得服服帖帖。",
			"「这是我最后的波纹了……不对，是最后一个 token。」",
		],
	},
];
for (const e of graphEggs) {
	const id = `graph-${e.graph}`;
	STORIES[id] = {
		id,
		title: e.title,
		from: "无名老者",
		paragraphs: e.paragraphs,
	};
	GRAPH_STORY[e.graph] = id;
}

/** 全图圆满的终局 */
export const FINALE_STORY = "finale-ascend";
STORIES[FINALE_STORY] = {
	id: FINALE_STORY,
	title: "飞升·终章",
	from: "无名老者（已化作星光）",
	paragraphs: [
		"四图皆满，修行功德圆满。",
		"你回头看时，才发现那座叫「计算机基础」的山，早已被你踩成了平地；而那些曾让你夜不能寐的妖，如今都成了你故事里的注脚。",
		"老夫这一程，送你到此处，便要化作星光了。但别误会——不是老夫度了你，是你自己，一笔一笔，写就了这条路。",
		"「人类的赞歌，是勇气的赞歌。」去吧，少年。门外的世界，比这四张图大得多。",
	],
};

/* =========================================================================
 * 海量隐藏彩蛋：以下全部走「飞剑传书」，解锁一次即不再重复。
 * ========================================================================= */

/** 时辰彩蛋：时辰 key → 剧情 id（首次落入该时辰区间触发） */
export const TIME_STORY: Record<string, string> = {
	zi: "tod-zi", // 23-1 子时
	chou: "tod-chou", // 1-3 丑时
	yin: "tod-yin", // 3-5 寅时
	mao: "tod-mao", // 5-7 卯时
	wu: "tod-wu", // 11-13 午时
};

/** 连悟档位：连击数 → 剧情 id */
export const COMBO_STORY: Record<number, string> = {
	3: "combo-3",
	5: "combo-5",
	8: "combo-8",
	12: "combo-12",
};

/** 累计参悟里程碑：日志条数 → 剧情 id */
export const MILESTONE_STORY: Record<number, string> = {
	10: "ms-10",
	50: "ms-50",
	100: "ms-100",
	200: "ms-200",
	365: "ms-365",
	500: "ms-500",
};

/**
 * 各图首次参悟：图 → 剧情 id。
 * **修行录图（mu）没有这一项** —— 它传了 noCultivation，压根不进 recordSlay，
 * 所以也拿不到「首悟」的传书。想给修行录发彩蛋得另开一条路。
 */
export const GRAPH_FIRST_STORY: Partial<Record<GraphId, string>> = {
	cs: "first-cs",
	fe: "first-fe",
	be: "first-be",
	ag: "first-ag",
};

/** 云游归来：四张图都参悟过 */
export const VISIT_ALL_STORY = "visit-all";
/** 一气呵成：单方向 60 秒内从首悟到学满 */
export const ONE_SHOT_STORY = "one-shot";
/** 入定：单页停留超 5 分钟且有参悟 */
export const DWELL_STORY = "dwell";
/** 心猿意马：同一项反复勾了又取消 ≥3 次 */
export const FLIPFLOP_STORY = "flip-flop";
/** 戳信封的凡人：连点信封 5 次 */
export const ENVELOPE_SPAM_STORY = "envelope-spam";

/** 道心（取消勾选）：取消次数 → 剧情 id */
export const UNLEARN_STORY: Record<number, string> = {
	1: "unlearn-1",
	5: "unlearn-5",
	20: "unlearn-20",
};

/** 机缘随机池：每次参悟小概率抽一封未解锁的（用完为止） */
export const SECRET_POOL: string[] = [
	"sec-withered", // 枯木逢春
	"sec-scroll", // 残卷
	"sec-relic", // 古修遗蜕
	"sec-well", // 井底观天
	"sec-stone", // 他山之石
	"sec-thought", // 一念之差
	"sec-lamp", // 灯火
	"sec-game", // 棋局
	"sec-mirror", // 镜花水月
	"sec-tomb", // 无名碑
	"sec-letter", // 旧友书
	"sec-cloud", // 云海问途
];

const EGG_STORIES: Story[] = [
	/* —— 时辰 —— */
	{
		id: "tod-zi",
		title: "子时·夜修",
		from: "无名老者",
		paragraphs: [
			"夜深了，你却还在点灯。老夫当年也曾如此——以为多熬一刻，便能多悟一分。",
			"后来才知，根骨要养，神识要歇。去睡吧，少年，明日的道，不差这一刻。",
			"你的下一句话，老夫已经听到了：「再看一眼。」……罢了，罢了。",
		],
	},
	{
		id: "tod-chou",
		title: "丑时·更深",
		from: "无名老者",
		paragraphs: [
			"更漏沉沉，万籁俱寂。你修行的身影，倒映在冷掉的茶里。",
			"这般光景，老夫见过太多——先是热血，后是孤灯，最后能撑住的，没几个。你且撑着。",
		],
	},
	{
		id: "tod-yin",
		title: "寅时·将晓",
		from: "无名老者",
		paragraphs: [
			"天快亮了。你竟熬到了将晓。",
			"老夫不说劝你休息的话了——既已至此，便看看这晨光，配不配得上你的痴。",
		],
	},
	{
		id: "tod-mao",
		title: "卯时·闻鸡起舞",
		from: "无名老者",
		paragraphs: [
			"鸡鸣了，你比太阳起得还早。",
			"老夫挑不出半点毛病，只赠你一句：勤勉的人，妖见了他也要绕道。",
		],
	},
	{
		id: "tod-wu",
		title: "午时·日正",
		from: "无名老者",
		paragraphs: [
			"日头正烈，正是炼气化神的好时候。你偏在此时开悟，倒有几分烈火烹油的胆气。",
		],
	},

	/* —— 连悟档位 —— */
	{
		id: "combo-3",
		title: "心有所悟",
		from: "无名老者",
		paragraphs: ["三连悟。你已摸到门径的边了——心流一起，便挡不住。"],
	},
	{
		id: "combo-5",
		title: "渐入佳境",
		from: "无名老者",
		paragraphs: [
			"五连悟！周围的尘嚣都静了，只剩你与道。这般状态，可遇不可求。",
		],
	},
	{
		id: "combo-8",
		title: "天人合一",
		from: "无名老者",
		paragraphs: [
			"八连悟。此刻若有人唤你，你大约听不见——你已不在人间，在道中。",
		],
	},
	{
		id: "combo-12",
		title: "造化之境",
		from: "无名老者",
		paragraphs: [
			"十二连悟……老夫活了这许多岁，也没几回这般光景。今日，你比老夫更像修行人。",
		],
	},

	/* —— 累计里程碑 —— */
	{
		id: "ms-10",
		title: "初窥门径",
		from: "无名老者",
		paragraphs: ["十悟。你不再是门外汉了，至少，门缝里的光你见过了。"],
	},
	{
		id: "ms-50",
		title: "厚积薄发",
		from: "无名老者",
		paragraphs: ["五十悟。曾经以为难如登天的事，如今你回头看，不过矮坡。"],
	},
	{
		id: "ms-100",
		title: "百悟成钢",
		from: "无名老者",
		paragraphs: [
			"一百悟。老夫得说一句：「人类的赞歌，是勇气的赞歌。」你这一百回，每一回都算数。",
		],
	},
	{
		id: "ms-200",
		title: "二百悟",
		from: "无名老者",
		paragraphs: ["二百悟。你修行的路，老夫已经望不到头了。"],
	},
	{
		id: "ms-365",
		title: "一年磨剑",
		from: "无名老者",
		paragraphs: ["三百六十五悟——恰好一年。你可知，有人一年也未悟过一遭？"],
	},
	{
		id: "ms-500",
		title: "五百悟",
		from: "无名老者",
		paragraphs: ["五百悟。再往下，老夫也没词了。你已自成一道。"],
	},

	/* —— 各图首悟 —— */
	{
		id: "first-cs",
		title: "始悟·计算机基础",
		from: "无名老者",
		paragraphs: ["你在这里落下第一笔。地基打不打得牢，日后全看这一遭。"],
	},
	{
		id: "first-fe",
		title: "始悟·前端",
		from: "无名老者",
		paragraphs: ["前端的世界，门在你面前开了。这里的妖，会发光，也会动。"],
	},
	{
		id: "first-be",
		title: "始悟·后端",
		from: "无名老者",
		paragraphs: ["后端的水，你终于伸手探了。深不深，你自会知道。"],
	},
	{
		id: "first-ag",
		title: "始悟·Agent",
		from: "无名老者",
		paragraphs: ["你踏进了老夫都不敢久留的境地。器灵认主之前，先认你自己。"],
	},

	/* —— 机缘随机池 —— */
	{
		id: "sec-withered",
		title: "机缘·枯木逢春",
		from: "无名老者",
		paragraphs: [
			"你以为这条路早死了。可偏在转角，一枝新绿探了出来。枯木逢春，原是常事——只要你还肯走。",
		],
	},
	{
		id: "sec-scroll",
		title: "机缘·残卷",
		from: "无名老者",
		paragraphs: [
			"半页残卷，字迹漫漶。你却从缺口里，读出了自己的影子。有些功法，本就不是写给人看的。",
		],
	},
	{
		id: "sec-relic",
		title: "机缘·古修遗蜕",
		from: "无名老者",
		paragraphs: [
			"山洞深处，一具坐化的遗蜕。他没飞升，也没入魔，只是坐着，坐成了一道风景。你忽然懂了什么叫「放下」。",
		],
	},
	{
		id: "sec-well",
		title: "机缘·井底观天",
		from: "无名老者",
		paragraphs: [
			"你趴在井沿往下看，以为天就那么大。直到一只手把你提了上来——原来提你的，是你自己。",
		],
	},
	{
		id: "sec-stone",
		title: "机缘·他山之石",
		from: "无名老者",
		paragraphs: [
			"旁人修的道，你拿过来，竟也能用。他山之石，可以攻玉。老夫年轻时，最不屑这一句，如今最爱这一句。",
		],
	},
	{
		id: "sec-thought",
		title: "机缘·一念之差",
		from: "无名老者",
		paragraphs: [
			"同一道题，你换了个念头，便通了。修行与不入，往往只隔这一念。你的下一句话，老夫已经听到了：「原来如此」。",
		],
	},
	{
		id: "sec-lamp",
		title: "机缘·灯火",
		from: "无名老者",
		paragraphs: [
			"长夜赶路，唯一盏灯。你护着它，像护着一点不肯灭的痴。灯在，路就在。",
		],
	},
	{
		id: "sec-game",
		title: "机缘·棋局",
		from: "无名老者",
		paragraphs: [
			"残局已摆了千年。你落下一子，不算妙，却让死局有了活气。有些局，本就不为赢，为的是不下。",
		],
	},
	{
		id: "sec-mirror",
		title: "机缘·镜花水月",
		from: "无名老者",
		paragraphs: [
			"镜里的花，水里的月。你伸手去捞，捞了个空，却笑了。空便空吧，笑过便算悟过。",
		],
	},
	{
		id: "sec-tomb",
		title: "机缘·无名碑",
		from: "无名老者",
		paragraphs: ["荒坟无字，不知葬的是谁。你鞠了一躬。无名者，未必无道。"],
	},
	{
		id: "sec-letter",
		title: "机缘·旧友书",
		from: "无名老者",
		paragraphs: [
			"一封旧信，落款被岁月吃了。你读着读着，想起某个也曾陪你修行的人。路长，别忘了回头看。",
		],
	},
	{
		id: "sec-cloud",
		title: "机缘·云海问途",
		from: "无名老者",
		paragraphs: [
			"云海里你迷了路，却遇见了自己要去的那个方向。问途不必问人，问脚下的云。",
		],
	},

	/* —— 道心（取消） —— */
	{
		id: "unlearn-1",
		title: "道心小劫",
		from: "无名老者",
		paragraphs: [
			"哦？刚悟到的，这就还回去了？也罢，道心初动，本就难免反复。老夫当年，还过的比你多。",
		],
	},
	{
		id: "unlearn-5",
		title: "道心动摇",
		from: "无名老者",
		paragraphs: ["第五次了。你这一退一进的，倒像在和老夫打太极。稳住，少年。"],
	},
	{
		id: "unlearn-20",
		title: "魔念丛生",
		from: "无名老者",
		paragraphs: [
			"二十次。老夫得说句实话：再这么悟了还、还了悟，魔念都要当你是知己了。要不……就别还了？",
		],
	},

	/* —— 整活 / 巡礼 / 特殊 —— */
	{
		id: "flip-flop",
		title: "心猿意马",
		from: "无名老者",
		paragraphs: [
			"同一桩事，你翻来覆去，悟了又还，还了又悟。心猿意马者，终难成道——除非，你本就乐在其中。",
		],
	},
	{
		id: "dwell",
		title: "入定",
		from: "无名老者",
		paragraphs: [
			"你在一处打坐，久久未起。周遭的喧嚣退了，连时间也慢了。老夫不打扰你，只替你守着这盏灯。",
		],
	},
	{
		id: "one-shot",
		title: "顿悟全功",
		from: "无名老者",
		paragraphs: [
			"一盏茶的工夫，你把一个方向悟了个透。老夫看愣了——这般利落，倒像是早就在心里练过千遍。",
		],
	},
	{
		id: "visit-all",
		title: "云游归来",
		from: "无名老者",
		paragraphs: [
			"四地皆留过你的足迹。计算机的根、前端的光、后端的深、Agent 的奇——你都尝过了。云游归来，你已不是当初那个只敢在门口张望的凡人。",
		],
	},
	{
		id: "envelope-spam",
		title: "戳信封的凡人",
		from: "无名老者",
		paragraphs: [
			"戳吧，戳破天也戳不出功法来，JOJO。不过……老夫倒挺喜欢你这股子闲不住的劲儿。",
		],
	},
];

for (const s of EGG_STORIES) STORIES[s.id] = s;

/** 首杀剧情 id */
export const FIRST_SLAY_STORY = "first-slay";

/** 运行期把心魔劫补进注册表（放在最后，避免上面 import 的 GROUPS 还没就绪） */
for (const [graph, groups] of Object.entries(GROUP_MAP)) {
	for (const g of groups ?? []) {
		STORIES[`grp-${graph}-${g.id}`] = groupStory(graph as GraphId, g);
	}
}

/** 按 id 取剧情，取不到返回 null（防御性，避免渲染崩） */
export function getStory(id: string): Story | null {
	return STORIES[id] ?? null;
}
