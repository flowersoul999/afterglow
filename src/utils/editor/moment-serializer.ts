/**
 * 说说文件的读写转换
 *
 * 说说的真实存放规则是 `src/content/动态/<年>/<月>/<年-月-日>.md`，
 * 同一天多条加 `-2`、`-3` 后缀（见 scripts 里的既有约定）。
 *
 * 这里只负责「文本 ↔ 草稿对象」的互转，不碰网络、不碰 DOM。
 * frontmatter 解析刻意做得很窄：只认 schema 里有的字段，其余原样收进
 * `extra` 再原样吐回去 —— 宁可多留几行，也不能因为编辑器不认识某个字段
 * 就把作者的数据吃掉。
 */

import { CONTENT_ROOT } from "./github-client";

/** 说说的集合目录（中文目录名，集合键是 moments） */
export const MOMENT_DIR: string = `${CONTENT_ROOT}动态/`;

export interface MomentDraft {
	/** 相对 动态/ 的路径（不含扩展名），同时也是 content collection 的 entry.id */
	id: string;
	title: string;
	/** 原样保存成 `2026-11-03 22:41:00` 这种形式，YAML 会解析成时间 */
	published: string;
	pinned: boolean;
	location: string;
	/** 顺序有意义：第一项是心情，其余是话题标签 */
	tags: string[];
	body: string;
	/** 本编辑器不认识的 frontmatter 行，原样保留 */
	extra: string[];
}

/** `2026/11/2026-11-03` → `src/content/动态/2026/11/2026-11-03.md` */
export function momentPath(id: string): string {
	return `${MOMENT_DIR}${id}.md`;
}

/** 由日期生成默认 id：`2026/11/2026-11-03` */
export function buildMomentId(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}/${month}/${year}-${month}-${day}`;
}

/** 同一天已有文件时，往后加序号：`2026-11-03-2` */
export function nextMomentId(id: string, attempt: number): string {
	return attempt <= 1 ? id : `${id}-${attempt}`;
}

/** `2026-11-03 22:41:00` → `2026-11-03T22:41`（喂给 datetime-local） */
export function toInputValue(published: string): string {
	const matched = published.match(
		/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/,
	);
	if (!matched) return "";
	return `${matched[1]}-${matched[2]}-${matched[3]}T${matched[4]}:${matched[5]}`;
}

/** `2026-11-03T22:41` → `2026-11-03 22:41:00`（datetime-local 的逆操作） */
export function fromInputValue(value: string): string {
	const matched = value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
	if (!matched) return "";
	return `${matched[1]} ${matched[2]}:00`;
}

/** 当前时间，按 frontmatter 习惯格式化 */
export function nowPublished(): string {
	const now = new Date();
	const pad = (value: number): string => String(value).padStart(2, "0");
	return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:00`;
}

/** 值里有 YAML 元字符时才加引号，中文标签保持裸写，读起来干净 */
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

function unquote(raw: string): string {
	const value = raw.trim();
	if (
		(value.startsWith('"') && value.endsWith('"')) ||
		(value.startsWith("'") && value.endsWith("'"))
	) {
		return value.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
	}
	return value;
}

/**
 * 把 md 原文拆成草稿。
 *
 * 只处理 `key: value` 和 `key:` 后跟 `  - item` 两种形态 —— 说说 frontmatter
 * 本来就这么简单；真遇到嵌套结构就整个丢进 extra 原样保留。
 */
export function parseMomentFile(raw: string, id: string): MomentDraft {
	const normalized = raw.replace(/\r\n/g, "\n");
	const draft: MomentDraft = {
		id,
		title: "",
		published: "",
		pinned: false,
		location: "",
		tags: [],
		body: normalized,
		extra: [],
	};

	const opening = normalized.match(/^---\n/);
	if (!opening) return draft;

	const closingIndex = normalized.indexOf("\n---", 4);
	if (closingIndex < 0) return draft;

	const frontmatter = normalized.slice(4, closingIndex);
	draft.body = normalized.slice(closingIndex + 4).replace(/^\n+/, "");

	const lines = frontmatter.split("\n");
	let cursor = 0;
	while (cursor < lines.length) {
		const line = lines[cursor];
		cursor += 1;

		if (!line.trim()) continue;

		const pair = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
		if (!pair) {
			draft.extra.push(line);
			continue;
		}

		const key = pair[1];
		const inlineValue = pair[2].trim();

		// 数组形态：`tags:` 后面跟若干 `  - xxx`
		if (inlineValue === "") {
			const items: string[] = [];
			while (cursor < lines.length && /^\s*-\s+/.test(lines[cursor])) {
				items.push(unquote(lines[cursor].replace(/^\s*-\s+/, "")));
				cursor += 1;
			}
			if (key === "tags") {
				draft.tags = items;
			} else if (items.length > 0) {
				draft.extra.push(`${key}:`, ...items.map((item) => `  - ${item}`));
			}
			continue;
		}

		const value = unquote(inlineValue);
		switch (key) {
			case "published":
				draft.published = value;
				break;
			case "title":
				draft.title = value;
				break;
			case "pinned":
				draft.pinned = value === "true";
				break;
			case "location":
				draft.location = value;
				break;
			case "tags":
				draft.tags = value
					.split(",")
					.map((tag) => unquote(tag))
					.filter((tag) => tag !== "");
				break;
			default:
				draft.extra.push(line);
		}
	}

	return draft;
}

/** 草稿 → md 原文，字段顺序固定，diff 才好看 */
export function serializeMoment(draft: MomentDraft): string {
	const lines: string[] = ["---"];

	if (draft.title.trim()) {
		lines.push(`title: ${yamlScalar(draft.title)}`);
	}
	if (draft.published.trim()) {
		lines.push(`published: ${draft.published.trim()}`);
	}
	if (draft.pinned) {
		lines.push("pinned: true");
	}
	if (draft.location.trim()) {
		lines.push(`location: ${yamlScalar(draft.location)}`);
	}
	if (draft.tags.length > 0) {
		lines.push("tags:");
		for (const tag of draft.tags) {
			if (tag.trim()) lines.push(`  - ${yamlScalar(tag)}`);
		}
	}
	lines.push(...draft.extra);
	lines.push("---");

	// frontmatter 与正文之间留一个空行，跟手写的 md 保持一致，避免每次编辑都产生无谓 diff
	const body = draft.body.replace(/^\n+/, "").trimEnd();
	return `${lines.join("\n")}\n\n${body}\n`;
}

/** 新建一条空白草稿 */
export function createEmptyDraft(): MomentDraft {
	const published = nowPublished();
	const date = new Date();
	return {
		id: buildMomentId(date),
		title: "",
		published,
		pinned: false,
		location: "",
		tags: [],
		body: "",
		extra: [],
	};
}
