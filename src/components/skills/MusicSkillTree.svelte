<script lang="ts">
/**
 * 音乐技能图 = 通用技能图组件 + 一套音乐数据
 *
 * 和前三张技术图的两个区别：
 *   1. noCultivation —— 修行录模式，不入门禁、不加修为、不发传书、不领话本签。
 *      图内的三个属性（音准/技法/作品）就是这类图的全部进度。
 *   2. 不在 .astro 里传数据：整套数据序列进 HTML props 会让页面体积翻好几倍，
 *      在这里 import 就直接进岛屿自己的 JS chunk。
 */
import SkillTree from "@/components/skills/SkillTree.svelte";
import { MU_CHECKS } from "@/data/musicChecks";
import { MU_GROUP_COLORS, MU_ICONS } from "@/data/musicIcons";
import {
	MU_ATTR_MAP,
	MU_ATTRS,
	MU_GROUP_ATTR,
	MU_GROUPS,
	MU_PRESET,
	MU_SKILLS,
	MU_TITLES,
	MU_TOTAL_SKILLS,
} from "@/data/musicSkills";
</script>

<SkillTree
	skills={MU_SKILLS}
	groups={MU_GROUPS}
	attrs={MU_ATTRS}
	groupAttr={MU_GROUP_ATTR}
	attrMap={MU_ATTR_MAP}
	checks={MU_CHECKS}
	preset={MU_PRESET}
	totalSkills={MU_TOTAL_SKILLS}
	icons={MU_ICONS}
	groupColors={MU_GROUP_COLORS}
	storageKey="aemeath-music-tree"
	heading="音乐技能图"
	titles={MU_TITLES}
	noCultivation
/>
