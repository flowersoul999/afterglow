<script lang="ts">
/**
 * 后台右栏：单条内容的编辑器
 *
 * 表单值先落在本地 `form` 对象里，点「提交」时才写回 doc 并触发保存 ——
 * 编辑过程中不打乱 doc 的 entry 顺序，也就不会因为输入一半就重排出奇怪的 diff。
 *
 * 正文直接绑 doc.body（ContentDoc 是父组件的 $state，深层属性可双向绑定）。
 */

import {
	ArrowLeft,
	Eye,
	Loader2,
	Pencil,
	Plus,
	Trash2,
	X,
} from "lucide-svelte";
import { marked } from "marked";
import sanitizeHtml from "sanitize-html";
import type { AdminCollection } from "@/config/admin-collections";
import {
	type ContentDoc,
	fromDatetimeLocal,
	readField,
	toDatetimeLocal,
	writeField,
} from "@/utils/editor/content-serializer";

interface Props {
	collection: AdminCollection;
	doc: ContentDoc;
	isNew: boolean;
	path: string;
	error: string;
	saving: boolean;
	category: string;
	onSave: () => void;
	onDelete: () => void;
	onClose: () => void;
	onMobileBack: () => void;
}

let {
	collection,
	doc,
	isNew,
	path,
	error,
	saving,
	category = $bindable(""),
	onSave,
	onDelete,
	onClose,
	onMobileBack,
}: Props = $props();

type FormValue = string | string[] | boolean;
type Form = Record<string, FormValue>;

marked.setOptions({ gfm: true, breaks: true });

let form = $state<Form>({});
let tagInput = $state("");
let mode = $state<"edit" | "preview">("edit");
let confirmDelete = $state(false);
let confirmTimer: ReturnType<typeof setTimeout> | null = null;
/** 用来判断 doc 是不是换了一篇，避免每次保存都重建表单 */
let lastDoc: ContentDoc | null = null;

function buildForm(): Form {
	const next: Form = {};
	for (const field of collection.fields) {
		const raw = readField(doc, field.key);
		if (field.type === "switch") {
			next[field.key] =
				typeof raw === "string" ? raw === "true" : Boolean(field.initial);
			continue;
		}
		if (field.type === "tags") {
			next[field.key] = Array.isArray(raw) ? [...raw] : [];
			continue;
		}
		if (field.type === "datetime") {
			next[field.key] = toDatetimeLocal(typeof raw === "string" ? raw : "");
			continue;
		}
		next[field.key] = typeof raw === "string" ? raw : "";
	}
	return next;
}

$effect(() => {
	if (doc === lastDoc) return;
	lastDoc = doc;
	form = buildForm();
	mode = "edit";
	confirmDelete = false;
});

const title = $derived(typeof form.title === "string" ? form.title : "");
const tags = $derived((form.tags as string[]) ?? []);
const bodyLength = $derived(doc.body.replace(/\s/g, "").length);
const previewHtml = $derived(
	mode === "preview"
		? sanitizeHtml(marked.parse(doc.body, { async: false }) as string, {
				allowedAttributes: {
					a: ["href", "name", "target", "rel"],
					img: ["src", "alt", "title", "width", "height"],
					code: ["class"],
				},
			})
		: "",
);

/** 表单里没被单独提到网格顶部的字段（title 固定放最上面） */
const gridFields = $derived(
	collection.fields.filter((field) => field.key !== "title"),
);

function submit(): void {
	if (saving) return;

	for (const field of collection.fields) {
		const value = form[field.key];
		if (value === undefined) continue;
		if (field.type === "datetime") {
			writeField(doc, field.key, fromDatetimeLocal(String(value)));
			continue;
		}
		writeField(doc, field.key, value);
	}

	onSave();
}

function addTag(): void {
	const value = tagInput.trim().replace(/^#/, "");
	if (!value) return;
	const current = (form.tags as string[]) ?? [];
	if (!current.includes(value)) form.tags = [...current, value];
	tagInput = "";
}

function removeTag(index: number): void {
	const current = (form.tags as string[]) ?? [];
	form.tags = current.filter((_, i) => i !== index);
}

function askDelete(): void {
	if (!confirmDelete) {
		confirmDelete = true;
		if (confirmTimer) clearTimeout(confirmTimer);
		confirmTimer = setTimeout(() => {
			confirmDelete = false;
		}, 4000);
		return;
	}
	onDelete();
}
</script>

<main class="admin-editor">
	<div class="admin-editor__head">
		<button
			type="button"
			class="admin-editor__mobile-back"
			onclick={onMobileBack}
			aria-label="返回内容列表"
		>
			<ArrowLeft size={16} aria-hidden="true" />
		</button>
		<div class="admin-editor__title-wrap">
			<input
				class="admin-editor__title"
				placeholder="未命名"
				value={title}
				oninput={(event) => {
					form.title = event.currentTarget.value;
				}}
			/>
			<div class="admin-editor__path">
				{#if isNew}
					<span class="admin-editor__badge">新建</span>
					<span>保存后写入 {collection.dir}/…</span>
				{:else}
					<span>{path}</span>
				{/if}
			</div>
		</div>

		<div class="admin-editor__actions">
			{#if !isNew}
				<button
					type="button"
					class="admin-btn admin-btn--danger admin-btn--sm"
					onclick={askDelete}
					disabled={saving}
				>
					<Trash2 size={13} aria-hidden="true" />
					{confirmDelete ? "再点一次确认" : "删除"}
				</button>
			{:else}
				<button
					type="button"
					class="admin-btn admin-btn--sm"
					onclick={onClose}
					disabled={saving}
				>
					<X size={13} aria-hidden="true" />
					取消
				</button>
			{/if}
			<button
				type="button"
				class="admin-btn admin-btn--primary admin-btn--sm"
				onclick={submit}
				disabled={saving}
			>
				{#if saving}
					<Loader2 size={13} class="spin" aria-hidden="true" /> 提交中…
				{:else}
					<Plus size={13} aria-hidden="true" /> 提交
				{/if}
			</button>
		</div>
	</div>

	<div class="admin-editor__tabs">
		<button
			type="button"
			class="admin-tab"
			class:is-active={mode === "edit"}
			onclick={() => (mode = "edit")}
		>
			<Pencil size={12} aria-hidden="true" /> 编辑
		</button>
		<button
			type="button"
			class="admin-tab"
			class:is-active={mode === "preview"}
			onclick={() => (mode = "preview")}
		>
			<Eye size={12} aria-hidden="true" /> 预览
		</button>
	</div>

	<div class="admin-editor__body">
		{#if mode === "edit"}
			<div class="admin-form">
				{#each gridFields as field (field.key)}
					<div
						class="admin-field"
						class:admin-field--wide={field.wide || field.type === "textarea"}
					>
						<label class="admin-field__label" for={`f-${field.key}`}>
							{field.label}
							{#if field.hint}
								<span class="admin-field__hint">{field.hint}</span>
							{/if}
						</label>

						{#if field.type === "switch"}
							<label class="admin-switch">
								<input
									type="checkbox"
									checked={Boolean(form[field.key])}
									onchange={(event) => {
										form[field.key] = event.currentTarget.checked;
									}}
								/>
								<span class="admin-switch__track"></span>
								<span>{Boolean(form[field.key]) ? "开" : "关"}</span>
							</label>
						{:else if field.type === "tags"}
							<div class="admin-tagfield">
								{#each tags as tag, index (tag)}
									<span class="admin-tag">
										{tag}
										<button
											type="button"
											onclick={() => removeTag(index)}
											aria-label={`移除标签 ${tag}`}
										>
											<X size={9} aria-hidden="true" />
										</button>
									</span>
								{/each}
								<input
									id={`f-${field.key}`}
									bind:value={tagInput}
									placeholder="回车添加"
									onkeydown={(event) => {
										if (event.key === "Enter") {
											event.preventDefault();
											addTag();
										}
									}}
									onblur={addTag}
								/>
							</div>
						{:else if field.type === "select"}
							<select
								id={`f-${field.key}`}
								class="admin-input"
								value={String(form[field.key] ?? "")}
								onchange={(event) => {
									form[field.key] = event.currentTarget.value;
								}}
							>
								{#each field.options ?? [] as option (option.value)}
									<option value={option.value}>{option.label}</option>
								{/each}
							</select>
						{:else if field.type === "textarea"}
							<textarea
								id={`f-${field.key}`}
								class="admin-input admin-input--area"
								placeholder={field.placeholder ?? ""}
								value={String(form[field.key] ?? "")}
								oninput={(event) => {
									form[field.key] = event.currentTarget.value;
								}}
							></textarea>
						{:else}
							<input
								id={`f-${field.key}`}
								class="admin-input"
								class:admin-input--mono={field.type === "date" ||
									field.type === "datetime" ||
									field.type === "number"}
								type={field.type === "number"
									? "number"
									: field.type === "date"
										? "date"
										: field.type === "datetime"
											? "datetime-local"
											: "text"}
								placeholder={field.placeholder ?? ""}
								value={String(form[field.key] ?? "")}
								oninput={(event) => {
									form[field.key] = event.currentTarget.value;
								}}
							/>
						{/if}
					</div>
				{/each}

				{#if collection.categoryEditable && isNew}
					<div class="admin-field">
						<label class="admin-field__label" for="f-category">
							分类
							<span class="admin-field__hint">就是文件夹名，决定站点上的分类</span>
						</label>
						<input
							id="f-category"
							class="admin-input"
							bind:value={category}
							placeholder="随笔"
						/>
					</div>
				{/if}
			</div>

			<div class="admin-editor__body-head">
				<span>正文 · Markdown</span>
			</div>
			<textarea
				class="admin-textarea"
				spellcheck="false"
				placeholder="正文…"
				bind:value={doc.body}
			></textarea>
		{:else}
			<article class="admin-preview">
				{#if title}
					<h1>{title}</h1>
				{/if}
				{@html previewHtml}
			</article>
		{/if}

		{#if error}
			<p class="admin-editor__error">{error}</p>
		{/if}
	</div>

	<footer class="admin-editor__foot">
		<span class="admin-editor__stat">{bodyLength} 字</span>
		<span class="admin-editor__dot"></span>
		<span class="admin-editor__stat">{doc.entries.length} 个字段</span>
		<span class="admin-editor__hint">提交后 1~3 分钟上线</span>
	</footer>
</main>
