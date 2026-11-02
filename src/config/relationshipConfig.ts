import type { RelationshipConfig } from "../types/config";

export const relationshipConfig: RelationshipConfig = {
	// 恋爱开始日期
	// 想启用这个组件：先填好下面这些，再把 sidebarConfig.ts 里两处 type: "relationship" 的 enable 改成 true
	startDate: "",
	// 双方名称
	name1: "",
	name2: "",
	// 双方头像（图片放 public/assets/ziyuan/ 下，填 "/assets/ziyuan/xxx.webp"）
	avatar1: "",
	avatar2: "",
	// 小组件标题
	title: "我们在一起已经",
};
