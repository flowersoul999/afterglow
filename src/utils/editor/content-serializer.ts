/**
 * 通用 frontmatter 读写（后台编辑用）
 *
 * 为什么不是「解析成对象再序列化」：那样字段顺序会重排、注释会消失、
 * 不认识的字段会被吃掉 —— 每次保存都制造一整片 diff，读起来很吵。
 *
 * 这里的做法是**保序保留**：把 frontmatter 拆成有序 entry 列表，每项记着
 * 原始文本（`original`）。没被表单改过的 entry 原样写回，只有 dirty 的才重新
 * 生成。于是「改个标题」产生的 diff 就只有标题那一行。
 *
 * 支持的形态（实际内容里出现过的都覆盖了）：
 *   key: value
 *   key: "带引号的值"
 *   key: [a, "b", c]        ← 文章/面经的 tags 用的是这种内联数组
 *   key:
 *     - a
 *     - b
 * 其余（嵌套对象、注释行）整行收进 kind: "raw" 原样保留。
 */

export type FrontmatterKind = "scalar" | "list" | "raw";

export interface FrontmatterEntry {
	key: string;
	kind: FrontmatterKind;
	/** kind=scalar 时的值（已去引号） */
	value: string;
	/** kind=list 时的元素（已去引号） */
	items: string[];
	/** 数组写成一行还是多行，写回时沿用 */
	listStyle: "inline" | "block";
	/** 值原样写出、不加引号（布尔用，加了引号 zod 会当成字符串） */
	literal: boolean;
	/** 原始文本，没改动时原样写回 */
	original: string;
	dirty: boolean;
}

export interface ContentDoc {
	entries: FrontmatterEntry[];
	/** frontmatter 之后的正文（已去掉首部空行） */
	body: string;
	/**
	 * frontmatter 结尾 `---` 与正文之间的原始分隔。
	 * 站内文章习惯空一行（`\n\n`），面经老文件是紧贴的（`\n`）——
	 * 沿用原样，保存时才不会凭空多出一行 diff。
	 */
	gap: string;
}

/** 读表单字段：标量返回 string，数组返回 string[]，不存在返回 undefined */
export type FieldValue = string | string[] | undefined;

/* --------------------------------------------------------------- 解析 */

function unquote(raw: string): string {
	const value = raw.trim();
	if (value.length < 2) return value;
	const first = value[0];
	const last = value[value.length - 1];
	if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
		return value.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
	}
	return value;
}

/** 内联数组：`["AI", "工程实践"]` → ["AI", "工程实践"] */
function parseInlineList(raw: string): string[] {
	const inner = raw.trim().replace(/^\[/, "").replace(/\]$/, "");
	if (!inner.trim()) return [];

	const items: string[] = [];
	let buffer = "";
	let quote = "";

	// 手写扫描而不是 split(",")：标签里出现英文逗号（比如 "React, Vue"）时不能切
	for (const char of inner) {
		if (quote) {
			buffer += char;
			if (char === quote) quote = "";
			continue;
		}
		if (char === '"' || char === "'") {
			quote = char;
			buffer += char;
			continue;
		}
		if (char === ",") {
			if (buffer.trim()) items.push(unquote(buffer));
			buffer = "";
			continue;
		}
		buffer += char;
	}
	if (buffer.trim()) items.push(unquote(buffer));
	return items;
}

function isInlineList(raw: string): boolean {
	const value = raw.trim();
	return value.startsWith("[") && value.endsWith("]");
}

/**
 * 拆成 ContentDoc。
 *
 * 没有 frontmatter 的文件不报错：entries 为空、body 是全文 —— 后台照常能编辑，
 * 保存时会按字段配置补出 frontmatter。
 */
export function parseContent(raw: string): ContentDoc {
	const normalized = raw.replace(/\r\n/g, "\n").replace(/^\uFEFF/, "");

	if (!normalized.startsWith("---\n")) {
		return { entries: [], body: normalized.replace(/^\n+/, ""), gap: "\n\n" };
	}

	const closing = normalized.indexOf("\n---", 3);
	if (closing < 0) {
		return { entries: [], body: normalized.replace(/^\n+/, ""), gap: "\n\n" };
	}

	const frontmatter = normalized.slice(4, closing);
	const tail = normalized.slice(closing + 4);
	const gapMatch = tail.match(/^\n*/);
	const gap = gapMatch && gapMatch[0].length > 0 ? gapMatch[0] : "";
	const body = tail.replace(/^\n+/, "").replace(/\s+$/, "");

	const lines = frontmatter.split("\n");
	const entries: FrontmatterEntry[] = [];
	let cursor = 0;

	while (cursor < lines.length) {
		const line = lines[cursor];
		cursor += 1;

		if (!line.trim()) continue;

		const pair = line.match(/^([A-Za-z_][\w-]*):(.*)$/);
		if (!pair) {
			// 注释、嵌套子行（`  enable: true`）—— 整行保底
			entries.push({
				key: "",
				kind: "raw",
				value: "",
				items: [],
				listStyle: "block",
				literal: false,
				original: line,
				dirty: false,
			});
			continue;
		}

		const key = pair[1];
		const rest = pair[2];

		// `key:` 后面什么都没有 → 可能是块数组，也可能只是个空值
		if (!rest.trim()) {
			const blockLines: string[] = [];
			while (cursor < lines.length && /^\s+-\s+/.test(lines[cursor])) {
				blockLines.push(lines[cursor]);
				cursor += 1;
			}
			if (blockLines.length > 0) {
				entries.push({
					key,
					kind: "list",
					value: "",
					items: blockLines.map((item) =>
						unquote(item.replace(/^\s*-\s+/, "")),
					),
					listStyle: "block",
					literal: false,
					original: [line, ...blockLines].join("\n"),
					dirty: false,
				});
			} else {
				entries.push({
					key,
					kind: "scalar",
					value: "",
					items: [],
					listStyle: "block",
					literal: false,
					original: line,
					dirty: false,
				});
			}
			continue;
		}

		const value = rest.trim();

		if (isInlineList(value)) {
			entries.push({
				key,
				kind: "list",
				value: "",
				items: parseInlineList(value),
				listStyle: "inline",
				literal: false,
				original: line,
				dirty: false,
			});
			continue;
		}

		entries.push({
			key,
			kind: "scalar",
			value: unquote(value),
			items: [],
			listStyle: "block",
			literal: false,
			original: line,
			dirty: false,
		});
	}

	return { entries, body, gap };
}

/* --------------------------------------------------------------- 写出 */

/** 值里有 YAML 元字符时才加引号；中文保持裸写，读起来干净 */
function yamlScalar(raw: string): string {
	const value = raw.trim();
	if (value === "") return '""';
	const risky =
		/[:#[\]{}&*!|>'"%@`]/.test(value) ||
		/^[-?\s]/.test(value) ||
		/^(true|false|null|~)$/i.test(value);
	if (!risky) return value;
	return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function renderEntry(entry: FrontmatterEntry): string {
	if (!entry.dirty) return entry.original;

	if (entry.kind === "raw") return entry.original;

	if (entry.kind === "list") {
		if (entry.items.length === 0) return `${entry.key}: []`;
		if (entry.listStyle === "inline") {
			const items = entry.items
				.map((item) => `"${item.replace(/"/g, '\\"')}"`)
				.join(", ");
			return `${entry.key}: [${items}]`;
		}
		return [
			`${entry.key}:`,
			...entry.items.map((item) => `  - ${yamlScalar(item)}`),
		].join("\n");
	}

	// 布尔必须裸写：`draft: "false"` 在 zod 眼里是字符串，构建会直接红
	if (entry.literal) return `${entry.key}: ${entry.value}`;

	return `${entry.key}: ${yamlScalar(entry.value)}`;
}

export function serializeContent(doc: ContentDoc): string {
	const head = doc.entries
		.filter((entry) => {
			if (entry.kind === "raw") return entry.original.trim() !== "";
			// 空的可选字段整行不写：`order: ""` 会让 z.number() 校验失败，
			// `tags: []` 也是一样 —— 原来没有这行，就别凭空造一行出来
			if (!entry.dirty) return true;
			if (entry.kind === "scalar") return entry.value.trim() !== "";
			if (entry.kind === "list") return entry.items.length > 0;
			return true;
		})
		.map(renderEntry)
		.join("\n");

	const body = doc.body.replace(/^\n+/, "").replace(/\s+$/, "");
	const gap = doc.gap || "\n\n";

	// frontmatter 与正文之间的空行沿用原文（面经老文件是紧贴的）
	if (!head) return body ? `${body}\n` : "";
	if (!body) return `---\n${head}\n---\n`;
	return `---\n${head}\n---${gap}${body}\n`;
}

/* --------------------------------------------------------------- 读写字段 */

export function readField(doc: ContentDoc, key: string): FieldValue {
	const entry = doc.entries.find((item) => item.key === key);
	if (!entry) return undefined;
	if (entry.kind === "list") return [...entry.items];
	if (entry.kind === "raw") return undefined;
	return entry.value;
}

/** 写字段：不存在就按当前顺序追加到末尾，存在则只改值（并标记 dirty） */
export function writeField(
	doc: ContentDoc,
	key: string,
	value: string | string[] | boolean | number,
): void {
	let entry = doc.entries.find((item) => item.key === key);

	if (!entry) {
		entry = {
			key,
			kind: Array.isArray(value) ? "list" : "scalar",
			value: "",
			items: [],
			listStyle: "block",
			literal: false,
			original: "",
			dirty: true,
		};
		doc.entries.push(entry);
	}

	if (Array.isArray(value)) {
		entry.kind = "list";
		entry.items = value.map((item) => String(item));
		entry.dirty = true;
		entry.literal = false;
		return;
	}

	if (typeof value === "boolean") {
		entry.kind = "scalar";
		entry.value = value ? "true" : "false";
		entry.literal = true;
		entry.dirty = true;
		return;
	}

	entry.kind = "scalar";
	entry.value = String(value);
	entry.literal = false;
	entry.dirty = true;
}

/** 从文档里删掉一个字段（用于「取消置顶」这类需要整行消失的情况） */
export function removeField(doc: ContentDoc, key: string): void {
	doc.entries = doc.entries.filter((item) => item.key !== key);
}

/* --------------------------------------------------------------- 辅助 */

/** 新建一份空白文档 */
export function createDocument(): ContentDoc {
	return { entries: [], body: "", gap: "\n\n" };
}

/** 按 frontmatter 里的日期字段取时间戳，取不到返回 0（用于列表排序） */
export function readTimestamp(doc: ContentDoc, key: string): number {
	const value = readField(doc, key);
	if (typeof value !== "string" || !value) return 0;
	const matched = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
	if (!matched) return 0;
	return new Date(
		Number(matched[1]),
		Number(matched[2]) - 1,
		Number(matched[3]),
	).getTime();
}

/** `2026-11-04 21:40` / `2026-11-04` → 喂给 datetime-local 的值 */
export function toDatetimeLocal(value: string): string {
	const matched = value.match(
		/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/,
	);
	if (!matched) return "";
	const time = matched[4] ? `${matched[4]}:${matched[5]}` : "00:00";
	return `${matched[1]}-${matched[2]}-${matched[3]}T${time}`;
}

/** datetime-local 的值 → 写回 frontmatter 的形态；带时间的保留时分 */
export function fromDatetimeLocal(value: string): string {
	const matched = value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
	if (!matched) return "";
	return `${matched[1]} ${matched[2]}`;
}

/** 当前时间（本地时区），`2026-11-04` 或 `2026-11-04 21:40` */
export function nowStamp(withTime: boolean): string {
	const now = new Date();
	const pad = (value: number): string => String(value).padStart(2, "0");
	const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
	if (!withTime) return date;
	return `${date} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}
