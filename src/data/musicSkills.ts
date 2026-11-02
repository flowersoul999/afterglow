/**
 * 音乐技能图数据 —— 修行录第一图
 *
 * 定位：**全站第一张「不入门禁、不算修为」的图**。
 * 音乐和 cs / fe / be / ag 没有先后关系，硬塞进修仙境界链会出现
 * 「背完单词但没结丹所以音乐图不让我进」的荒谬门禁，所以它走修行录：
 *   · 没有任何境界门禁（页面不放 RealmGate）
 *   · 不加修为、不进九境界、不发飞剑传书、不领话本签
 *   · 唯一的进度是图内的三个属性：音准值 / 技法值 / 作品值
 *
 * 为什么放在第一张：它是站内第一张「和编程毫无关系」的图，
 * 正好用来验证修行录这套机制对软技能成不成立。
 *
 * 字段含义与其它图完全一致（见 src/data/skills.ts 的 Skill 接口）：
 *   level    —— 我当前的掌握度，上限等于 musicChecks.ts 里该技能的清单条数
 *   requires —— 前置技能 id，硬依赖（不学前置学不动）
 *   note     —— 悬停卡片 / 详情面板里显示的一句话说明
 *
 * 图标见 src/data/musicIcons.ts（自动生成），key 与 id 一致。
 * 学习清单见 src/data/musicChecks.ts。
 */
import type { Skill, SkillAttr, SkillGroup } from "@/data/skills";

/** 方向：只用于配色、图例与统计，不参与排版分组 */
export const MU_GROUPS: SkillGroup[] = [
	{
		id: "mu-listen",
		name: "听觉与训练",
		short: "听觉",
		note: "先有一对能用的耳朵，再谈会弹。视唱练耳是最笨也最省钱的路。",
		tips: ["每天二十分钟，比周末练三小时有用"],
	},
	{
		id: "mu-theory",
		name: "乐理与记谱",
		short: "乐理",
		note: "看懂谱子、听懂和弦，是从「凭感觉」到「知道自己为什么对」的分水岭。",
		tips: ["乐理不是为了考试，是为了少走弯路"],
	},
	{
		id: "mu-instrument",
		name: "演奏",
		short: "演奏",
		note: "手上功夫。指法、节奏、力度控制——练琴练的是这三样，不是曲子数量。",
		tips: ["慢速练比快速练有效十倍"],
	},
	{
		id: "mu-compose",
		name: "创作与编曲",
		short: "创作",
		note: "把听到的东西变成自己的东西。动机、和声、配器，都是可学的手艺。",
		tips: ["先写八小节，写完再说"],
	},
	{
		id: "mu-vocal",
		name: "人声与演唱",
		short: "人声",
		note: "气息、音域、咬字、情感。唱歌这件事上技巧只占一半，另一半是表达。",
		tips: ["录音是最好的老师，它不会骗你"],
	},
	{
		id: "mu-produce",
		name: "制作与混音",
		short: "制作",
		note: "把作品交出去的那道工序：编曲软件、录音、混音、母带。",
		tips: ["先混准，再混好听"],
	},
	{
		id: "mu-stage",
		name: "演出与表达",
		short: "演出",
		note: "给人听的那部分。扒带、即兴、和声演唱，还有站上台不抖。",
		tips: ["弹给一个人听，好过弹给一百个人听"],
	},
];

/** 属性点规则：每升 1 级 +1，清单全勾完再额外 +2（与其它图同一套，见 SkillTree.svelte） */
export const MU_ATTRS: SkillAttr[] = [
	{
		id: "ear",
		name: "音准值",
		short: "音准",
		note: "耳朵的精度：听得出对错、辨得出音程、模唱不走调。这是所有音乐的地基。",
		color: "7C3AED",
	},
	{
		id: "hand",
		name: "技法值",
		short: "技法",
		note: "手上的功夫：把脑子里的东西稳定地弹出来、唱出来，不靠运气。",
		color: "0F766E",
	},
	{
		id: "work",
		name: "作品值",
		short: "作品",
		note: "拿得出手的东西：原创、改编、录音成品。听得懂的人多，肯拿出作品的少。",
		color: "B45309",
	},
];

/** 方向 → 属性。耳朵相关的算音准，手上的算技法，出成品算作品。 */
export const MU_GROUP_ATTR: Record<string, string> = {
	"mu-listen": "ear",
	"mu-theory": "ear",
	"mu-vocal": "ear",
	"mu-instrument": "hand",
	"mu-produce": "hand",
	"mu-compose": "work",
	"mu-stage": "work",
};

export const MU_ATTR_MAP: Record<string, SkillAttr> = Object.fromEntries(
	MU_ATTRS.map((a) => [a.id, a]),
);

/** 角色称号阶梯：按总掌握度百分比给（音值说法，和技术图那套区分开） */
export const MU_TITLES = [
	{ min: 0, name: "五音不全", note: "先别急着开口，先把耳朵养出来" },
	{ min: 10, name: "听得出来了", note: "能听出对错，这一步比很多人跨得晚" },
	{ min: 25, name: "能扒带", note: "听到的曲子能大致还原出来" },
	{ min: 40, name: "手感有了", note: "弹自己的东西不用想太久" },
	{ min: 58, name: "能写出来", note: "有了自己的句子，不是临摹" },
	{ min: 75, name: "能给人听", note: "敢按下播放键，这就是分水岭" },
];

/** 一条技能 = 技能图上的一个方块。层层递进，箭头全是真实的前置关系。 */
export const MU_SKILLS: Skill[] = [
	/* ===================== 听觉与训练 ===================== */
	{
		id: "mu-sing-abc",
		name: "唱准三个音",
		short: "三个音",
		level: 0,
		group: "mu-listen",
		note: "先别碰乐器。用嗓子对一遍 do-mi-sol，能唱准了再往下走——不然练的是手不是耳朵。",
		tips: [],
		requires: [],
	},
	{
		id: "mu-pitch-match",
		name: "模唱一个音",
		short: "模唱",
		level: 0,
		group: "mu-listen",
		note: "听到一个音能唱出来。这是从「听」到「做」的第一道关，也是最诚实的一关。",
		tips: [],
		requires: ["mu-sing-abc"],
	},
	{
		id: "mu-interval",
		name: "听辨音程",
		short: "音程",
		level: 0,
		group: "mu-listen",
		note: "能分清大二度和小二度、大三度和小三度。有了这个，你才听得出别人弹错在哪。",
		tips: [],
		requires: ["mu-pitch-match"],
	},
	{
		id: "mu-sight-sing",
		name: "视唱练耳",
		short: "视唱",
		level: 0,
		group: "mu-listen",
		note: "看着谱子直接唱出来。它同时练耳朵、记谱和反应速度，是音乐里最划算的一件事。",
		tips: [],
		requires: ["mu-interval"],
	},
	{
		id: "mu-rhythm-ear",
		name: "节奏感",
		short: "节奏",
		level: 0,
		group: "mu-listen",
		note: "能不能在不看拍子的情况下踩准点。节奏是音乐的骨架，音高只是血肉。",
		tips: [],
		requires: ["mu-pitch-match"],
	},
	{
		id: "mu-key-find",
		name: "听出调性",
		short: "调性",
		level: 0,
		group: "mu-listen",
		note: "一段音乐听完，能说出它是什么调、给人的感觉是什么。这是从「听歌」到「懂歌」的分界。",
		tips: [],
		requires: ["mu-interval", "mu-rhythm-ear"],
	},

	/* ===================== 乐理与记谱 ===================== */
	{
		id: "mu-staff",
		name: "五线谱与音名",
		short: "五线谱",
		level: 0,
		group: "mu-theory",
		note: "谱表、高音低音号、升降记号。所有记谱法的地基，看不懂就永远只能靠耳朵猜。",
		tips: [],
		requires: ["mu-sing-abc"],
	},
	{
		id: "mu-rhythm-read",
		name: "读节奏谱",
		short: "读节奏",
		level: 0,
		group: "mu-theory",
		note: "把附点、切分、连音线读对。唱不准往往不是音高问题，是节奏读错了。",
		tips: [],
		requires: ["mu-staff"],
	},
	{
		id: "mu-chord-shape",
		name: "三和弦",
		short: "三和弦",
		level: 0,
		group: "mu-theory",
		note: "大三、小三、增减。三和弦是所有和弦的原材料，也是最常被用到的知识。",
		tips: [],
		requires: ["mu-staff"],
	},
	{
		id: "mu-seventh",
		name: "七和弦与挂留",
		short: "七和弦",
		level: 0,
		group: "mu-theory",
		note: "属七、大七、挂四。流行和爵士里出现最多的就是它们，也是「有味道」的来源。",
		tips: [],
		requires: ["mu-chord-shape"],
	},
	{
		id: "mu-key-signature",
		name: "调号与调性",
		short: "调号",
		level: 0,
		group: "mu-theory",
		note: "能看着调号说出调名，知道为什么升号多了反而暗、为什么降号多了反而亮。",
		tips: [],
		requires: ["mu-chord-shape", "mu-key-find"],
	},
	{
		id: "mu-progression",
		name: "和声进行",
		short: "进行",
		level: 0,
		group: "mu-theory",
		note: "四和弦、五和弦的连接套路。懂了这个，你听到一首歌就知道它为什么这么顺。",
		tips: [],
		requires: ["mu-seventh"],
	},
	{
		id: "mu-form",
		name: "曲式与结构",
		short: "曲式",
		level: 0,
		group: "mu-theory",
		note: "起承转合、ABA、变奏。能看出结构，才知道自己在音乐的哪个位置。",
		tips: [],
		requires: ["mu-progression"],
	},

	/* ===================== 演奏 ===================== */
	{
		id: "mu-posture",
		name: "坐姿与手型",
		short: "坐姿",
		level: 0,
		group: "mu-instrument",
		note: "键盘、吉他、尤克里里各不相同，但原则一样：放松、支撑、别僵。受伤都是从小地方开始的。",
		tips: [],
		requires: ["mu-rhythm-ear"],
	},
	{
		id: "mu-finger",
		name: "基础指法",
		short: "指法",
		level: 0,
		group: "mu-instrument",
		note: "把五个手指编号并固定下来。没有编号，每次弹都要重新想，练十小时等于练一小时。",
		tips: [],
		requires: ["mu-posture"],
	},
	{
		id: "mu-fingering",
		name: "指法编排",
		short: "编排",
		level: 0,
		group: "mu-instrument",
		note: "同一段旋律用不同指法去弹，选一个不别扭、速度上得去的。手型换一遍等于换一种思路。",
		tips: [],
		requires: ["mu-finger", "mu-rhythm-read"],
	},
	{
		id: "mu-dynamics",
		name: "力度控制",
		short: "力度",
		level: 0,
		group: "mu-instrument",
		note: "能轻能重、能渐强能渐弱。所有技巧里最被低估的一项，也是最出效果的一项。",
		tips: [],
		requires: ["mu-finger"],
	},
	{
		id: "mu-articulation",
		name: "断连与连奏",
		short: "断连",
		level: 0,
		group: "mu-instrument",
		note: "把音断开或连起来，听感完全不同。同一个和弦，断开像敲钟，连起来像叹气。",
		tips: [],
		requires: ["mu-dynamics"],
	},
	{
		id: "mu-sight-play",
		name: "视奏",
		short: "视奏",
		level: 0,
		group: "mu-instrument",
		note: "看着谱从头到尾弹下来。不练视奏就等于只会被迫演奏会背的曲子。",
		tips: [],
		requires: ["mu-rhythm-read", "mu-fingering"],
	},
	{
		id: "mu-tempo",
		name: "速度与耐力",
		short: "速度",
		level: 0,
		group: "mu-instrument",
		note: "慢速练到不出错，再逐步提速。跳级提速是所有人练不好琴的头号原因。",
		tips: [],
		requires: ["mu-sight-play"],
	},
	{
		id: "mu-chords-play",
		name: "和弦伴奏",
		short: "伴奏",
		level: 0,
		group: "mu-instrument",
		note: "左手按和弦、右手跟旋律。做到能不看和弦表，这是最实用的一个台阶。",
		tips: [],
		requires: ["mu-chord-shape", "mu-fingering"],
	},

	/* ===================== 人声与演唱 ===================== */
	{
		id: "mu-breath",
		name: "气息",
		short: "气息",
		level: 0,
		group: "mu-vocal",
		note: "横膈膜控制。唱不上去不一定是音域问题，八成是气不够用。",
		tips: [],
		requires: ["mu-pitch-match"],
	},
	{
		id: "mu-range",
		name: "音域扩展",
		short: "音域",
		level: 0,
		group: "mu-vocal",
		note: "测出自己现在的舒适区，再一点点往外扩。硬冲高音只会伤嗓。",
		tips: [],
		requires: ["mu-breath"],
	},
	{
		id: "mu-diction",
		name: "咬字",
		short: "咬字",
		level: 0,
		group: "mu-vocal",
		note: "中文歌尤其吃这个。字咬不清，旋律再好听也是含混的。",
		tips: [],
		requires: ["mu-breath"],
	},
	{
		id: "mu-vibrato",
		name: "颤音与滑音",
		short: "颤音",
		level: 0,
		group: "mu-vocal",
		note: "颤音是修饰不是目的。知道什么时候该用、什么时候该不用，比练出它更难。",
		tips: [],
		requires: ["mu-range"],
	},
	{
		id: "mu-phrasing",
		name: "乐句处理",
		short: "乐句",
		level: 0,
		group: "mu-vocal",
		note: "学会按句子唱，而不是按字唱。技术服务于乐句，这是唱歌的分水岭。",
		tips: [],
		requires: ["mu-diction", "mu-progression"],
	},
	{
		id: "mu-emotion",
		name: "情感表达",
		short: "情感",
		level: 0,
		group: "mu-vocal",
		note: "同一条旋律唱两遍，一遍让人记一辈子，一遍让人睡着。差别不在技术。",
		tips: [],
		requires: ["mu-phrasing"],
	},

	/* ===================== 创作与编曲 ===================== */
	{
		id: "mu-motif",
		name: "动机写作",
		short: "动机",
		level: 0,
		group: "mu-compose",
		note: "先写三四小节的东西反复变形。一首完整的曲子是动机的生长史，不是一句好听的旋律。",
		tips: [],
		requires: ["mu-chord-shape", "mu-key-signature"],
	},
	{
		id: "mu-melody",
		name: "旋律写作",
		short: "旋律",
		level: 0,
		group: "mu-compose",
		note: "知道什么样的旋律好记、什么样的会腻。轮廓、节奏、落音，三件事定生死。",
		tips: [],
		requires: ["mu-motif"],
	},
	{
		id: "mu-harmonize",
		name: "给旋律配和声",
		short: "配和声",
		level: 0,
		group: "mu-compose",
		note: "给一段旋律找到合适的和弦走向。这是作曲里最需要耳朵也最需要练习的一步。",
		tips: [],
		requires: ["mu-melody", "mu-progression"],
	},
	{
		id: "mu-song",
		name: "完整一首",
		short: "成曲",
		level: 0,
		group: "mu-compose",
		note: "有主歌、副歌、桥段，结构完整。写不完通常是结构问题，不是灵感问题。",
		tips: [],
		requires: ["mu-harmonize", "mu-form"],
	},
	{
		id: "mu-arrange",
		name: "编曲配器",
		short: "编曲",
		level: 0,
		group: "mu-compose",
		note: "给一首只有旋律的歌配上乐器。先想清楚谁在主旋律位置，其余都让开。",
		tips: [],
		requires: ["mu-song", "mu-dynamics"],
	},
	{
		id: "mu-transpose",
		name: "移调与改编",
		short: "改编",
		level: 0,
		group: "mu-compose",
		note: "把一首歌挪个调、换个速度、换种编法还能成立，这就是改编能力。",
		tips: [],
		requires: ["mu-arrange"],
	},

	/* ===================== 制作与混音 ===================== */
	{
		id: "mu-daw",
		name: "DAW 上手",
		short: "DAW",
		level: 0,
		group: "mu-produce",
		note: "录音软件怎么用。选一个（Logic / Cubase / Reaper / FL）就够了，别收藏教程。",
		tips: [],
		requires: ["mu-sight-play"],
	},
	{
		id: "mu-record",
		name: "录音",
		short: "录音",
		level: 0,
		group: "mu-produce",
		note: "用电脑和一支话筒录出能用的声音。重点是避开环境噪音，不是买设备。",
		tips: [],
		requires: ["mu-daw"],
	},
	{
		id: "mu-mix",
		name: "混音",
		short: "混音",
		level: 0,
		group: "mu-produce",
		note: "让每个声音都在该在的位置。先解决音量平衡和频率打架，再谈美化。",
		tips: [],
		requires: ["mu-record", "mu-arrange"],
	},
	{
		id: "mu-master",
		name: "母带与响度",
		short: "母带",
		level: 0,
		group: "mu-produce",
		note: "让作品在不同播放设备上都听着一样大。这是发行前的最后一道，也是最容易被忽略的一道。",
		tips: [],
		requires: ["mu-mix"],
	},
	{
		id: "mu-publish",
		name: "发布与版权",
		short: "发布",
		level: 0,
		group: "mu-produce",
		note: "把成品发出去，并知道自己的版权和署名是怎么回事。这一步很多人一辈子没迈过。",
		tips: [],
		requires: ["mu-master"],
	},

	/* ===================== 演出与表达 ===================== */
	{
		id: "mu-transcribe",
		name: "扒带",
		short: "扒带",
		level: 0,
		group: "mu-stage",
		note: "把听到的曲子记成谱或扒成 MIDI。这是耳朵到手上最快的通道。",
		tips: [],
		requires: ["mu-rhythm-read", "mu-sight-sing"],
	},
	{
		id: "mu-harmony",
		name: "和声演唱",
		short: "和声",
		level: 0,
		group: "mu-stage",
		note: "在主旋律旁边加一条线。三度、六度都容易，八度看嗓子。",
		tips: [],
		requires: ["mu-phrasing", "mu-seventh"],
	},
	{
		id: "mu-improvise",
		name: "即兴",
		short: "即兴",
		level: 0,
		group: "mu-stage",
		note: "在和弦上即兴。先用音阶瞎弹到不出错，再考虑加变化音。",
		tips: [],
		requires: ["mu-key-signature", "mu-chords-play"],
	},
	{
		id: "mu-performance",
		name: "舞台呈现",
		short: "呈现",
		level: 0,
		group: "mu-stage",
		note: "给人听的时候怎么不出丑。技术会紧张是所有人的共同问题，练法只有一个：多演。",
		tips: [],
		requires: ["mu-phrasing", "mu-improvise"],
	},
	{
		id: "mu-live-set",
		name: "完整演出",
		short: "演出",
		level: 0,
		group: "mu-stage",
		note: "一整场从头到尾演完，包括中间的失误。这是所有音乐人的分水岭。",
		tips: [],
		requires: ["mu-performance", "mu-arrange"],
	},
];

/** 全部技能的清单都勾满能有多少技能点（与其它图一致，取技能条数） */
export const MU_TOTAL_SKILLS = MU_SKILLS.length;

/**
 * 出厂预设：音乐这张图是真的从零开始，所以默认全 0。
 * 以后学了哪一条，回来把对应数字改上去，「恢复预设」就按它重置。
 */
export const MU_PRESET: Record<string, number> = {
	// 听觉与训练
	"mu-sing-abc": 0,
	"mu-pitch-match": 0,
	"mu-interval": 0,
	"mu-sight-sing": 0,
	"mu-rhythm-ear": 0,
	"mu-key-find": 0,
	// 乐理与记谱
	"mu-staff": 0,
	"mu-rhythm-read": 0,
	"mu-chord-shape": 0,
	"mu-seventh": 0,
	"mu-key-signature": 0,
	"mu-progression": 0,
	"mu-form": 0,
	// 演奏
	"mu-posture": 0,
	"mu-finger": 0,
	"mu-fingering": 0,
	"mu-dynamics": 0,
	"mu-articulation": 0,
	"mu-sight-play": 0,
	"mu-tempo": 0,
	"mu-chords-play": 0,
	// 人声
	"mu-breath": 0,
	"mu-range": 0,
	"mu-diction": 0,
	"mu-vibrato": 0,
	"mu-phrasing": 0,
	"mu-emotion": 0,
	// 创作
	"mu-motif": 0,
	"mu-melody": 0,
	"mu-harmonize": 0,
	"mu-song": 0,
	"mu-arrange": 0,
	"mu-transpose": 0,
	// 制作
	"mu-daw": 0,
	"mu-record": 0,
	"mu-mix": 0,
	"mu-master": 0,
	"mu-publish": 0,
	// 演出
	"mu-transcribe": 0,
	"mu-harmony": 0,
	"mu-improvise": 0,
	"mu-performance": 0,
	"mu-live-set": 0,
};
