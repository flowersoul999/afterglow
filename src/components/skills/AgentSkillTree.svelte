<script lang="ts">
/**
 * Agent 开发技能图 = 通用技能图组件 + 一套 Agent 数据
 *
 * 为什么不直接在 .astro 里把数据当 props 传：那样整套数据会被序列化进 HTML
 * 的 props 属性，页面体积翻好几倍；在这里 import，数据直接进岛屿自己的 JS chunk。
 */
import SkillTree from "@/components/skills/SkillTree.svelte";
import { AG_CHECKS } from "@/data/agentChecks";
import { AG_GROUP_COLORS, AG_ICONS } from "@/data/agentIcons";
import {
	AG_ATTR_MAP,
	AG_ATTRS,
	AG_GROUP_ATTR,
	AG_GROUPS,
	AG_PRESET,
	AG_SKILLS,
	AG_TITLES,
	AG_TOTAL_SKILLS,
} from "@/data/agentSkills";
</script>

<SkillTree
	skills={AG_SKILLS}
	groups={AG_GROUPS}
	attrs={AG_ATTRS}
	groupAttr={AG_GROUP_ATTR}
	attrMap={AG_ATTR_MAP}
	checks={AG_CHECKS}
	preset={AG_PRESET}
	totalSkills={AG_TOTAL_SKILLS}
	icons={AG_ICONS}
	groupColors={AG_GROUP_COLORS}
	storageKey="aemeath-agent-tree"
	heading="Agent 开发技能图"
	titles={AG_TITLES}
/>
