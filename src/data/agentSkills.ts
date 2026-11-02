/**
 * Agent 开发技能图数据
 *
 * 定位：**站在「会写前后端」之上，学怎么把大模型做成能交付的产品**。
 * 不是「提示词大全」——从模型本身讲起，到提示与上下文、检索增强（RAG）、
 * 工具调用与编排、记忆与状态、评测与可观测，最后落到上线一个 Agent 产品。
 *
 * 和前两张图的关系：前端图解决「界面怎么搭」，后端图解决「服务怎么撑住」，
 * 这张图解决「模型怎么用得住」。三条线最后会交汇在「端到端做一个 AI 应用」上。
 *
 * 字段含义与其它图完全一致（见 src/data/skills.ts 的 Skill 接口）：
 *   level    —— 我当前的掌握度，上限等于 agentChecks.ts 里该技能的清单条数
 *   requires —— 前置技能 id，硬依赖（不学前置学不动）
 *   note     —— 悬停卡片 / 详情面板里显示的一句话说明
 *
 * 图标见 src/data/agentIcons.ts（自动生成），key 与 id 一致。
 * 学习清单见 src/data/agentChecks.ts。
 */
import type { Skill, SkillAttr, SkillGroup } from "@/data/skills";

/** 方向：只用于配色、图例与统计，不参与排版分组 */
export const AG_GROUPS: SkillGroup[] = [
	{
		id: "ag-foundation",
		name: "模型基础",
		short: "模型",
		note: "先搞清自己在调的是什么东西：它是怎么生成字的、上下文有多长、参数拧哪个。",
		tips: ["不把它当魔法，才谈得上工程化"],
	},
	{
		id: "ag-prompt",
		name: "提示与上下文",
		short: "提示",
		note: "同一个模型，提示与上下文的不同组织方式，效果能差出一个档次。",
		tips: ["提示不是玄学，是可复现、可版本化的一份输入"],
	},
	{
		id: "ag-rag",
		name: "检索增强 RAG",
		short: "RAG",
		note: "把「模型不知道的私有知识」喂给它：切分、向量化、召回、重排，一步差一步差。",
		tips: ["RAG 效果差，九成问题出在检索，不在模型"],
	},
	{
		id: "ag-tool",
		name: "工具与编排",
		short: "编排",
		note: "让模型能动手：调工具、查库、走多步、和别的 Agent 协作。",
		tips: ["能写死流程就先别上 Agent，Agent 是拿不确定性换灵活性"],
	},
	{
		id: "ag-memory",
		name: "记忆与状态",
		short: "记忆",
		note: "多轮对话要记得住，长任务要断点续跑，人在关键处要能插手。",
		tips: ["记忆不是把历史全塞进窗口，而是决定什么值得留"],
	},
	{
		id: "ag-eval",
		name: "评测与可观测",
		short: "评测",
		note: "模型输出不确定，没有评测就只能凭感觉改——这是 Agent 工程和普通开发最大的区别。",
		tips: ["先有评测集，再谈优化；否则你只是在换提示词许愿"],
	},
	{
		id: "ag-app",
		name: "产品化与上线",
		short: "上线",
		note: "流式、前端联调、鉴权额度、成本与合规——做到这一步它才真是个产品。",
		tips: ["成本要按 token 算得清，延迟要按首字和全程分开看"],
	},
];

/* ===================== 角色属性 ===================== */

/**
 * Agent 工程的三种功力：看得懂模型、编排得了流程、交付得出去。
 * 加点规则与其它图一致：每升 1 级 +1，清单全勾完再额外 +2。
 */
export const AG_ATTRS: SkillAttr[] = [
	{
		id: "model",
		name: "模型值",
		short: "模型",
		note: "看得懂模型在做什么、调得动参数、按场景选得对。",
		color: "7C3AED",
	},
	{
		id: "flow",
		name: "编排值",
		short: "编排",
		note: "能把提示、检索、工具、记忆组织成一条稳定跑通的链路。",
		color: "0F766E",
	},
	{
		id: "ship",
		name: "交付值",
		short: "交付",
		note: "能上线、能控成本、能评测、出事看得见。",
		color: "B45309",
	},
];

/** 方向 → 属性。模型本身看模型值，链路上的一切看编排值，上线相关看交付值。 */
export const AG_GROUP_ATTR: Record<string, string> = {
	"ag-foundation": "model",
	"ag-prompt": "flow",
	"ag-rag": "flow",
	"ag-tool": "flow",
	"ag-memory": "flow",
	"ag-eval": "ship",
	"ag-app": "ship",
};

export const AG_ATTR_MAP: Record<string, SkillAttr> = Object.fromEntries(
	AG_ATTRS.map((a) => [a.id, a]),
);

/** 角色称号阶梯：按总掌握度百分比给 */
export const AG_TITLES = [
	{ min: 0, name: "只会聊天", note: "能跟模型对话，但还只是个玩具" },
	{ min: 10, name: "提示上手", note: "能稳定让它输出想要的格式" },
	{ min: 25, name: "能搭 RAG", note: "知识库问答跑得通，也知道差在哪" },
	{ min: 40, name: "会编排工具", note: "模型能调工具、能自己走完多步任务" },
	{ min: 58, name: "能评测迭代", note: "每次改动都有数据说话，不靠感觉" },
	{ min: 75, name: "能带产品", note: "从选型到上线成本，全链路都敢负责" },
];

/** 一条技能 = 技能图上的一个方块。层层递进，箭头全是真实的前置关系。 */
export const AG_SKILLS: Skill[] = [
	/* ===================== 模型基础 ===================== */
	{
		id: "llm-basic",
		name: "大模型是什么",
		short: "大模型",
		level: 2,
		group: "ag-foundation",
		note: "自回归、下一 token 预测、概率采样。理解了这一点，就理解了它为什么会一本正经地胡说。",
		tips: [],
		requires: [],
	},
	{
		id: "token-ctx",
		name: "Token 与上下文窗口",
		short: "Token",
		level: 2,
		group: "ag-foundation",
		note: "字和 token 不是一回事，中文尤其。上下文有硬上限，超了要靠裁，不是靠嘴硬。",
		tips: [],
		requires: ["llm-basic"],
	},
	{
		id: "infer-param",
		name: "推理参数",
		short: "参数",
		level: 1,
		group: "ag-foundation",
		note: "temperature、top_p、最大输出、惩罚项：调参不是玄学，是控制随机性与长度的旋钮。",
		tips: [],
		requires: ["llm-basic"],
	},
	{
		id: "model-pick",
		name: "模型选型",
		short: "选型",
		level: 1,
		group: "ag-foundation",
		note: "按能力、上下文、价格、延迟、多模态需求挑模型——贵的不是最好的，合适的才是。",
		tips: [],
		requires: ["llm-basic"],
	},
	{
		id: "api-call",
		name: "调用模型 API",
		short: "API",
		level: 2,
		group: "ag-foundation",
		note: "OpenAI 兼容协议的请求与响应、流式返回、超时重试与限流退避。这一步是所有应用的地基。",
		tips: [],
		requires: ["token-ctx"],
	},
	{
		id: "local-model",
		name: "本地与私有部署",
		short: "本地模型",
		level: 0,
		group: "ag-foundation",
		note: "Ollama / vLLM 起一个开源模型，量化与显存的关系，以及什么场景真的必须私有化。",
		tips: [],
		requires: ["model-pick"],
	},
	{
		id: "multimodal",
		name: "多模态",
		short: "多模态",
		level: 1,
		group: "ag-foundation",
		note: "图像、语音、视频输入的用法与代价，以及什么时候其实不需要多模态。",
		tips: [],
		requires: ["model-pick"],
	},

	/* ===================== 提示与上下文 ===================== */
	{
		id: "prompt-basic",
		name: "提示词基础",
		short: "提示词",
		level: 2,
		group: "ag-prompt",
		note: "角色、任务、约束、输出格式四件套，以及「说清楚」比「说好听」重要。",
		tips: [],
		requires: ["llm-basic"],
	},
	{
		id: "few-shot",
		name: "少样本与示例",
		short: "少样本",
		level: 1,
		group: "ag-prompt",
		note: "给几个好例子，往往比写一长段规则更有效，但例子本身要干净、要覆盖边界。",
		tips: [],
		requires: ["prompt-basic"],
	},
	{
		id: "cot",
		name: "思维链与推理",
		short: "思维链",
		level: 1,
		group: "ag-prompt",
		note: "让它先推理再给答案，以及知道什么时候该把推理藏起来、只留结论。",
		tips: [],
		requires: ["prompt-basic"],
	},
	{
		id: "structured-output",
		name: "结构化输出",
		short: "结构化",
		level: 2,
		group: "ag-prompt",
		note: "用 JSON Schema 约束模型的输出，让它直接产出能被代码消费的数据，而不是散文。",
		tips: [],
		requires: ["api-call"],
	},
	{
		id: "ctx-engineering",
		name: "上下文工程",
		short: "上下文",
		level: 1,
		group: "ag-prompt",
		note: "窗口里放什么、按什么顺序放、超长时怎么压缩与剪枝——这决定了效果的上限。",
		tips: [],
		requires: ["cot", "token-ctx"],
	},
	{
		id: "prompt-injection",
		name: "提示注入与防护",
		short: "注入",
		level: 0,
		group: "ag-prompt",
		note: "用户输入和文档内容都可能劫持指令。知道怎么隔离外部文本、怎么设不可越过的边界。",
		tips: [],
		requires: ["prompt-basic"],
	},

	/* ===================== 检索增强 RAG ===================== */
	{
		id: "embedding",
		name: "向量与 Embedding",
		short: "向量",
		level: 1,
		group: "ag-rag",
		note: "把文本变成向量、用余弦相似度衡量「意思有多近」，以及为什么它对语义但不总对字面。",
		tips: [],
		requires: ["api-call"],
	},
	{
		id: "chunking",
		name: "文档切分",
		short: "切分",
		level: 1,
		group: "ag-rag",
		note: "按什么粒度切、怎么留重叠、表格与代码怎么特殊处理——切坏了后面全白搭。",
		tips: [],
		requires: ["embedding"],
	},
	{
		id: "vector-db",
		name: "向量库",
		short: "向量库",
		level: 1,
		group: "ag-rag",
		note: "写入、索引与近似最近邻检索，pgvector / Qdrant / Milvus 该怎么按规模选。",
		tips: [],
		requires: ["embedding"],
	},
	{
		id: "retrieval",
		name: "检索与召回",
		short: "检索",
		level: 1,
		group: "ag-rag",
		note: "top-k、相似度阈值、元数据过滤，以及怎么判断「召回的东西对不对」。",
		tips: [],
		requires: ["vector-db", "chunking"],
	},
	{
		id: "rerank",
		name: "重排",
		short: "重排",
		level: 0,
		group: "ag-rag",
		note: "先粗召回再精排：Cross-Encoder 重排为什么能救命，代价又在哪。",
		tips: [],
		requires: ["retrieval"],
	},
	{
		id: "hybrid-search",
		name: "混合检索",
		short: "混合检索",
		level: 0,
		group: "ag-rag",
		note: "关键词（BM25）和向量各有所长，融合两路结果能同时救回「专有名词」和「同义表达」。",
		tips: [],
		requires: ["retrieval"],
	},
	{
		id: "rag-app",
		name: "RAG 问答链路",
		short: "RAG",
		level: 1,
		group: "ag-rag",
		note: "从提问、改写、检索、组装上下文到生成与引用：把它串成一条能重复跑通的链路。",
		tips: [],
		requires: ["retrieval", "ctx-engineering"],
	},
	{
		id: "rag-eval",
		name: "检索质量评估",
		short: "检索评估",
		level: 0,
		group: "ag-rag",
		note: "命中率、召回率、上下文相关度：能定位到底是检索没找到，还是模型没用上。",
		tips: [],
		requires: ["rag-app"],
	},

	/* ===================== 工具与编排 ===================== */
	{
		id: "tool-call",
		name: "工具调用",
		short: "工具调用",
		level: 1,
		group: "ag-tool",
		note: "Function Calling 的完整回合：模型给出参数、你执行、再把结果喂回去——它自己不执行任何东西。",
		tips: [],
		requires: ["structured-output"],
	},
	{
		id: "agent-loop",
		name: "Agent 循环",
		short: "Agent 循环",
		level: 1,
		group: "ag-tool",
		note: "观察—思考—行动—再观察：什么时候该停、怎么防死循环、出错怎么回退。",
		tips: [],
		requires: ["tool-call"],
	},
	{
		id: "langchain",
		name: "LangChain 基础",
		short: "LangChain",
		level: 1,
		group: "ag-tool",
		note: "模型、提示、输出解析、链与工具的抽象：用它省掉胶水代码，也别被抽象盖住细节。",
		tips: [],
		requires: ["tool-call"],
	},
	{
		id: "langgraph",
		name: "图编排 LangGraph",
		short: "LangGraph",
		level: 0,
		group: "ag-tool",
		note: "把流程写成状态图：节点、边、条件分支与检查点——多步 Agent 要比链更可控的结构。",
		tips: [],
		requires: ["agent-loop", "langchain"],
	},
	{
		id: "mcp",
		name: "Model Context Protocol",
		short: "MCP",
		level: 0,
		group: "ag-tool",
		note: "用一套协议把工具和数据源接进来，而不是给每个 Agent 重写一遍集成。",
		tips: [],
		requires: ["tool-call"],
	},
	{
		id: "multi-agent",
		name: "多智能体协作",
		short: "多智能体",
		level: 0,
		group: "ag-tool",
		note: "分工、交接与汇总：多 Agent 什么时候真的更强，什么时候只是把调试难度翻了倍。",
		tips: [],
		requires: ["langgraph"],
	},
	{
		id: "workflow-vs-agent",
		name: "工作流还是 Agent",
		short: "选型",
		level: 1,
		group: "ag-tool",
		note: "能用写死的流程解决就别上 Agent：说得清两者在可控性、成本和效果上的取舍。",
		tips: [],
		requires: ["agent-loop"],
	},
	{
		id: "code-sandbox",
		name: "代码执行与沙箱",
		short: "沙箱",
		level: 0,
		group: "ag-tool",
		note: "让模型写代码并真的跑起来：隔离、资源限制、超时，以及绝不能碰到的边界。",
		tips: [],
		requires: ["tool-call"],
	},

	/* ===================== 记忆与状态 ===================== */
	{
		id: "conv-memory",
		name: "会话记忆",
		short: "会话记忆",
		level: 2,
		group: "ag-memory",
		note: "多轮对话怎么带历史：全量、滑动窗口还是滚动摘要，各自代价是什么。",
		tips: [],
		requires: ["api-call"],
	},
	{
		id: "long-memory",
		name: "长期记忆",
		short: "长期记忆",
		level: 0,
		group: "ag-memory",
		note: "把值得记的事实抽出来存进向量库，下次按相关度取回，而不是指望窗口记得住一切。",
		tips: [],
		requires: ["conv-memory", "embedding"],
	},
	{
		id: "agent-state",
		name: "状态与持久化",
		short: "状态",
		level: 0,
		group: "ag-memory",
		note: "长任务要能断点续跑：状态存哪、怎么恢复、并发进来时怎么不打架。",
		tips: [],
		requires: ["langgraph", "conv-memory"],
	},
	{
		id: "human-in-loop",
		name: "人工介入",
		short: "人工介入",
		level: 0,
		group: "ag-memory",
		note: "在关键动作前暂停等确认：高风险操作的审批点，以及怎么让恢复继续而不是从头再来。",
		tips: [],
		requires: ["agent-state"],
	},

	/* ===================== 评测与可观测 ===================== */
	{
		id: "eval-set",
		name: "评测集",
		short: "评测集",
		level: 0,
		group: "ag-eval",
		note: "攒一批有标准答案的真实问题，每次改动都跑一遍——这是唯一能证明「变好了」的东西。",
		tips: [],
		requires: ["prompt-basic", "rag-app"],
	},
	{
		id: "llm-judge",
		name: "自动评分",
		short: "自动评分",
		level: 0,
		group: "ag-eval",
		note: "用模型按评分标准打分，处理开放式答案；也知道它会有偏见、需要抽样人工校准。",
		tips: [],
		requires: ["eval-set"],
	},
	{
		id: "tracing",
		name: "链路追踪与调试",
		short: "追踪",
		level: 0,
		group: "ag-eval",
		note: "把一次调用里的每步提示、检索结果、工具入参出参都记下来，否则线上出错只能猜。",
		tips: [],
		requires: ["agent-loop"],
	},
	{
		id: "cost-latency",
		name: "成本与延迟",
		short: "成本延迟",
		level: 1,
		group: "ag-eval",
		note: "按 token 估一次对话多少钱，首字延迟和全程延迟分开看，知道该换模型还是该改链路。",
		tips: [],
		requires: ["api-call"],
	},
	{
		id: "guardrail",
		name: "输出护栏",
		short: "护栏",
		level: 0,
		group: "ag-eval",
		note: "入口过滤、出口校验、禁答与转人工的兜底——让模型出格时系统还能守住底线。",
		tips: [],
		requires: ["prompt-injection", "structured-output"],
	},

	/* ===================== 产品化与上线 ===================== */
	{
		id: "streaming",
		name: "流式输出",
		short: "流式",
		level: 1,
		group: "ag-app",
		note: "SSE 逐块吐字、怎么处理中断与重连，以及为什么流式能把「等待感」砍掉一大半。",
		tips: [],
		requires: ["api-call"],
	},
	{
		id: "frontend-integration",
		name: "前端接入",
		short: "前端接入",
		level: 2,
		group: "ag-app",
		note: "打字机效果、Markdown 与代码块渲染、中止生成、多轮列表——前端出身的人在这块有先天优势。",
		tips: [],
		requires: ["streaming"],
	},
	{
		id: "agent-backend",
		name: "Agent 服务端",
		short: "服务端",
		level: 1,
		group: "ag-app",
		note: "密钥只在服务端、请求编排、超时与降级——别让浏览器直接拿着 API Key 裸奔。",
		tips: [],
		requires: ["api-call"],
	},
	{
		id: "auth-quota",
		name: "鉴权与额度",
		short: "鉴权额度",
		level: 1,
		group: "ag-app",
		note: "谁能用、每人每天多少次、超了怎么挡——不控额度，账单会替你教育你。",
		tips: [],
		requires: ["agent-backend"],
	},
	{
		id: "ship-agent",
		name: "上线一个 Agent 产品",
		short: "上线",
		level: 1,
		group: "ag-app",
		note: "把模型、提示、检索、工具、记忆、评测、成本和前端全部串起来，交付一个能长期跑的东西。",
		tips: [],
		requires: ["frontend-integration", "agent-backend", "cost-latency"],
	},
];

export const AG_TOTAL_SKILLS = AG_SKILLS.length;

/** 出厂预设：按我 2026 年 10 月的真实状态填写，「恢复预设」按它重置 */
export const AG_PRESET: Record<string, number> = {
	// 模型基础
	"llm-basic": 2,
	"token-ctx": 2,
	"infer-param": 1,
	"model-pick": 1,
	"api-call": 2,
	"local-model": 0,
	multimodal: 1,
	// 提示与上下文
	"prompt-basic": 2,
	"few-shot": 1,
	cot: 1,
	"structured-output": 2,
	"ctx-engineering": 1,
	"prompt-injection": 0,
	// 检索增强
	embedding: 1,
	chunking: 1,
	"vector-db": 1,
	retrieval: 1,
	rerank: 0,
	"hybrid-search": 0,
	"rag-app": 1,
	"rag-eval": 0,
	// 工具与编排
	"tool-call": 1,
	"agent-loop": 1,
	langchain: 1,
	langgraph: 0,
	mcp: 0,
	"multi-agent": 0,
	"workflow-vs-agent": 1,
	"code-sandbox": 0,
	// 记忆与状态
	"conv-memory": 2,
	"long-memory": 0,
	"agent-state": 0,
	"human-in-loop": 0,
	// 评测与可观测
	"eval-set": 0,
	"llm-judge": 0,
	tracing: 0,
	"cost-latency": 1,
	guardrail: 0,
	// 产品化
	streaming: 1,
	"frontend-integration": 2,
	"agent-backend": 1,
	"auth-quota": 1,
	"ship-agent": 1,
};
