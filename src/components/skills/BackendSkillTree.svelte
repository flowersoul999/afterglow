<script lang="ts">
/**
 * 后端技能图 = 通用技能图组件 + 一套后端数据
 *
 * 为什么不直接在 .astro 里把数据当 props 传：那样整套数据会被序列化进 HTML
 * 的 props 属性，页面体积翻好几倍；在这里 import，数据直接进岛屿自己的 JS chunk。
 */
import SkillTree from "@/components/skills/SkillTree.svelte";
import { BE_CHECKS } from "@/data/backendChecks";
import { BE_GROUP_COLORS, BE_ICONS } from "@/data/backendIcons";
import {
	BE_ATTR_MAP,
	BE_ATTRS,
	BE_GROUP_ATTR,
	BE_GROUPS,
	BE_PRESET,
	BE_SKILLS,
	BE_TITLES,
	BE_TOTAL_SKILLS,
} from "@/data/backendSkills";
</script>

<SkillTree
	skills={BE_SKILLS}
	groups={BE_GROUPS}
	attrs={BE_ATTRS}
	groupAttr={BE_GROUP_ATTR}
	attrMap={BE_ATTR_MAP}
	checks={BE_CHECKS}
	preset={BE_PRESET}
	totalSkills={BE_TOTAL_SKILLS}
	icons={BE_ICONS}
	groupColors={BE_GROUP_COLORS}
	storageKey="aemeath-backend-tree"
	heading="后端技能图"
	titles={BE_TITLES}
/>
