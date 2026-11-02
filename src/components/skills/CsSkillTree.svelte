<script lang="ts">
/**
 * 计算机基础技能图 = 通用技能图组件 + 一套 CS 数据
 *
 * 为什么要包一层：如果直接在 .astro 里把数据当 props 传给岛屿，
 * 这一整套数据会被序列化进 HTML 的 props 属性里；而放在这里 import，
 * 数据就直接进岛屿自己的 JS chunk，页面 HTML 不会被撑大。
 */
import SkillTree from "@/components/skills/SkillTree.svelte";
import { CS_CHECKS } from "@/data/csChecks";
import { CS_GROUP_COLORS, CS_ICONS } from "@/data/csIcons";
import {
	CS_ATTR_MAP,
	CS_ATTRS,
	CS_GROUP_ATTR,
	CS_GROUPS,
	CS_PRESET,
	CS_SKILLS,
	CS_TITLES,
	CS_TOTAL_SKILLS,
} from "@/data/csSkills";
</script>

<SkillTree
	skills={CS_SKILLS}
	groups={CS_GROUPS}
	attrs={CS_ATTRS}
	groupAttr={CS_GROUP_ATTR}
	attrMap={CS_ATTR_MAP}
	checks={CS_CHECKS}
	preset={CS_PRESET}
	totalSkills={CS_TOTAL_SKILLS}
	icons={CS_ICONS}
	groupColors={CS_GROUP_COLORS}
	storageKey="aemeath-cs-tree"
	heading="计算机基础技能图"
	titles={CS_TITLES}
/>
