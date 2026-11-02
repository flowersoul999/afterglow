<script lang="ts">
/**
 * 英语技能图 = 通用技能图组件 + 一套英语数据
 *
 * 和音乐图一样的两点：
 *   1. noCultivation —— 修行录模式，不入门禁、不加修为、不发传书、不领话本签。
 *   2. 不在 .astro 里传数据：整套数据序列进 HTML props 会让页面体积翻好几倍。
 *
 * 多传了一个 levels={EN_LEVELS}：四张技术图共用的 LEVELS 判定语是
 * 「做过可运行的东西」「写过被广泛使用的库」，那套词放到英语上全是空话。
 * 英语换成「认得出 → 读得懂 → 说得顺 → 写得对 → 用得住」，终点是应付真实场景，
 * 不是造轮子影响生态。SkillTree 的 levels 本来就是 prop，零成本。
 */
import SkillTree from "@/components/skills/SkillTree.svelte";
import { EN_CHECKS } from "@/data/englishChecks";
import { EN_GROUP_COLORS, EN_ICONS } from "@/data/englishIcons";
import {
	EN_ATTR_MAP,
	EN_ATTRS,
	EN_GROUP_ATTR,
	EN_GROUPS,
	EN_LEVELS,
	EN_PRESET,
	EN_SKILLS,
	EN_TITLES,
	EN_TOTAL_SKILLS,
} from "@/data/englishSkills";
</script>

<SkillTree
	skills={EN_SKILLS}
	groups={EN_GROUPS}
	attrs={EN_ATTRS}
	groupAttr={EN_GROUP_ATTR}
	attrMap={EN_ATTR_MAP}
	levels={EN_LEVELS}
	checks={EN_CHECKS}
	preset={EN_PRESET}
	totalSkills={EN_TOTAL_SKILLS}
	icons={EN_ICONS}
	groupColors={EN_GROUP_COLORS}
	storageKey="aemeath-english-tree"
	heading="英语技能图"
	titles={EN_TITLES}
	noCultivation
/>
