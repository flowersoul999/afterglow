<script lang="ts">
/**
 * 理财技能图 = 通用技能图组件 + 一套理财数据
 *
 * 和音乐 / 英语两张图完全同构（三张修行录共用这一套接入方式）：
 *   1. noCultivation —— 修行录模式，不入门禁、不加修为、不发传书、不领话本签。
 *      这张图尤其需要：「练理财能结丹」会扭曲修为体系 —— 钱不是修为。
 *   2. 不在 .astro 里传数据：整套数据序列进 HTML props 会让页面体积翻好几倍。
 *   3. levels={FN_LEVELS} —— 自己的等级体系。技术图那套「做过可运行的东西 /
 *      写过被广泛使用的库」放到理财上全是空话；理财的终点是
 *      「看得见终点的财务状态」：月光 → 看得见 → 存得下 → 扛得住 → 跑得赢 → 有路径。
 */
import SkillTree from "@/components/skills/SkillTree.svelte";
import { FN_CHECKS } from "@/data/financeChecks";
import { FN_GROUP_COLORS, FN_ICONS } from "@/data/financeIcons";
import {
	FN_ATTR_MAP,
	FN_ATTRS,
	FN_GROUP_ATTR,
	FN_GROUPS,
	FN_LEVELS,
	FN_PRESET,
	FN_SKILLS,
	FN_TITLES,
	FN_TOTAL_SKILLS,
} from "@/data/financeSkills";
</script>

<SkillTree
	skills={FN_SKILLS}
	groups={FN_GROUPS}
	attrs={FN_ATTRS}
	groupAttr={FN_GROUP_ATTR}
	attrMap={FN_ATTR_MAP}
	levels={FN_LEVELS}
	checks={FN_CHECKS}
	preset={FN_PRESET}
	totalSkills={FN_TOTAL_SKILLS}
	icons={FN_ICONS}
	groupColors={FN_GROUP_COLORS}
	storageKey="aemeath-finance-tree"
	heading="理财技能图"
	titles={FN_TITLES}
	noCultivation
/>
