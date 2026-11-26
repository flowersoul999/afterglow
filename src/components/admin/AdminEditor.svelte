<script lang="ts">
/**
 * 后台右栏：单条内容的编辑器
 *
 * 表单值先落在本地 `form` 对象里，点「存入草稿箱」时才写回 doc 并交给父组件
 * 入队 —— 编辑过程中不打乱 doc 的 entry 顺序，也就不会因为输入一半就重排出
 * 奇怪的 diff。
 *
 * 正文同理，先落在 `bodyText`；集合配了 `mediaInBody` 时（说说），正文下面还有
 * 一块图片区，图片不占 frontmatter，存的是正文末尾一行一个 `![](assets/diary/x.webp)`。
 * 保存时才把「文字 + 图片」拼回 `doc.body`（拼装规则见 utils/moment-media.ts）。
 * 上传也推迟到存入草稿箱时：中途取消编辑不会在仓库里留下没人引用的图片。
 */

import {
	ArrowLeft,
	Eye,
	ImagePlus,
	Link2,
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
import { editor } from "@/utils/editor/editor-store";
import { EditorApiError } from "@/utils/editor/github-client";
import { uploadBodyImage } from "@/utils/editor/image-upload";
import {
	joinBodyMedia,
	moveMediaItem,
	splitMomentMedia,
} from "@/utils/moment-media";

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

/** 正文图片区里的一张图：已在仓库、是外链，或者还等着上传 */
interface BodyPhoto {
	id: string;
	/** 正文里要写的地址；等着上传的为空串 */
	url: string;
	/** 还没上传的本地文件 */
	file?: File;
	/** 本地预览（objectURL），上传完仍留着，刷新页面才失效 */
	local?: string;
	/** 文件名：仓库图还没进构建时，占位卡上靠它认人 */
	name: string;
}

marked.setOptions({ gfm: true, breaks: true });

/**
 * 构建期就已经在仓库里的说说配图。
 *
 * Astro 只对「构建时存在」的图片产出带 hash 的地址；刚上传的图在这里查不到，
 * 那时用本地 objectURL 顶着，重新构建后再打开就有缩略图了。
 */
const repoMediaUrls = import.meta.glob<string>(
	"/src/content/动态/**/*.{webp,jpg,jpeg,png,gif,avif}",
	{ eager: true, query: "?url", import: "default" },
);

let form = $state<Form>({});
let tagInput = $state("");
let mode = $state<"edit" | "preview">("edit");
let confirmDelete = $state(false);
let confirmTimer: ReturnType<typeof setTimeout> | null = null;
/** 用来判断 doc 是不是换了一篇，避免每次保存都重建表单 */
let lastDoc: ContentDoc | null = null;

/** 正文里的纯文字（不含图片行），存入时才和图片拼回 doc.body */
let bodyText = $state("");
let photos = $state<BodyPhoto[]>([]);
let mediaError = $state("");
let mediaProgress = $state("");
let pendingPhoto = $state("");
let uploading = $state(false);
let mediaUrl = $state("");
let mediaDragging = $state(false);
/** dragenter / dragleave 会成对冒泡，用计数判断真正的离开 */
let dragDepth = 0;
let dragFrom = $state(-1);
let dragOver = $state(-1);
let mediaInput: HTMLInputElement | null = $state(null);

function uid(): string {
	return Math.random().toString(36).slice(2, 9);
}

/** 从地址里取文件名，给占位卡和 alt 用 */
function fileNameOf(url: string): string {
	const clean = url.split(/[?#]/u)[0] ?? url;
	return clean.split("/").pop() || url;
}

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

	// 正文：说说把末尾的图片行拆出来交给图片区，正文框里只剩文字
	if (collection.mediaInBody) {
		const { text, media } = splitMomentMedia(doc.body);
		bodyText = text;
		photos = media.map((url) => ({ id: uid(), url, name: fileNameOf(url) }));
	} else {
		bodyText = doc.body;
		photos = [];
	}
	mediaError = "";
	mediaProgress = "";
	pendingPhoto = "";

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
/** 有它就是「文字 + 末尾配图」的集合（说说），没有就是纯文字 */
const bodyMedia = $derived(collection.mediaInBody);
const busy = $derived(saving || uploading);
const bodyLength = $derived(bodyText.replace(/\s/g, "").length);

/** 仓库图 → 构建期给出的真实地址；外链和绝对路径原样返回 */
function displayUrl(url: string): string {
	if (!url) return "";
	if (/^(?:https?:)?\/\//iu.test(url) || url.startsWith("/")) return url;
	const matched = Object.keys(repoMediaUrls).find((key) => key.endsWith(url));
	return matched ? (repoMediaUrls[matched] ?? "") : "";
}

/** 预览用：新传的图拿 objectURL，仓库图换真实地址，两边都没有就跳过 */
function previewMediaUrl(photo: BodyPhoto): string {
	return photo.local || displayUrl(photo.url);
}

const previewMarkdown = $derived.by(() => {
	if (!collection.mediaInBody) return doc.body;
	return joinBodyMedia(bodyText, photos.map(previewMediaUrl).filter(Boolean));
});

const previewHtml = $derived(
	mode === "preview"
		? sanitizeHtml(marked.parse(previewMarkdown, { async: false }) as string, {
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

function syncForm(): void {
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
}

/** 「文字 + 图片」拼回正文；没有图片区的集合就是纯文字 */
function syncBody(): void {
	if (!collection.mediaInBody) {
		doc.body = bodyText;
		return;
	}
	doc.body = joinBodyMedia(
		bodyText,
		photos.map((photo) => photo.url),
	);
}

async function submit(): Promise<void> {
	if (busy) return;
	// 带图的说说先把图片传完，存进队列的文本里才引用得到真实地址
	if (!(await flushPhotos())) return;
	syncForm();
	syncBody();
	onSave();
}

/* ---------------------------------------------------------------- 正文图片 */

function addFiles(files: FileList | File[]): void {
	const limit = bodyMedia?.max ?? 9;
	const room = limit - photos.length;
	if (room <= 0) {
		mediaError = `最多 ${limit} 张图片`;
		return;
	}

	const picked = [...files]
		.filter((file) => file.type.startsWith("image/"))
		.slice(0, room);

	if (picked.length === 0) {
		mediaError = "这些文件不是图片";
		return;
	}

	photos = [
		...photos,
		...picked.map((file) => ({
			id: uid(),
			url: "",
			file,
			local: URL.createObjectURL(file),
			name: file.name,
		})),
	];
	mediaError = "";
}

function onFileChange(event: Event): void {
	const input = event.currentTarget as HTMLInputElement;
	if (input.files?.length) addFiles(input.files);
	// 清空 value，同一张图还能再选一次
	input.value = "";
}

/** 从系统拖进来的文件才归图片区管，内部拖动排序是另一套 */
function hasFiles(event: DragEvent): boolean {
	return Boolean(event.dataTransfer?.types.includes("Files"));
}

function onGridDragEnter(event: DragEvent): void {
	if (!hasFiles(event)) return;
	event.preventDefault();
	dragDepth += 1;
	mediaDragging = true;
}

function onGridDragOver(event: DragEvent): void {
	// 不 preventDefault 浏览器会拒绝 drop；但内部排序时不接管
	if (!hasFiles(event)) return;
	event.preventDefault();
}

function onGridDragLeave(): void {
	dragDepth = Math.max(0, dragDepth - 1);
	if (dragDepth === 0) mediaDragging = false;
}

function onGridDrop(event: DragEvent): void {
	if (!hasFiles(event)) return;
	event.preventDefault();
	dragDepth = 0;
	mediaDragging = false;
	const files = event.dataTransfer?.files;
	if (files?.length) addFiles(files);
}

function removePhoto(index: number): void {
	const target = photos[index];
	if (target?.local) URL.revokeObjectURL(target.local);
	photos = photos.filter((_, i) => i !== index);
}

function onDropSort(target: number): void {
	if (dragFrom < 0) return;
	photos = moveMediaItem(photos, dragFrom, target);
	dragFrom = -1;
	dragOver = -1;
}

function addByUrl(): void {
	const value = mediaUrl.trim();
	const prefix = bodyMedia?.refPrefix ?? "";
	// 只放行外链和仓库相对路径，`../` 之类的相对路径拼进正文会指到别的目录
	if (!/^https?:\/\//iu.test(value) && !(prefix && value.startsWith(prefix))) {
		mediaError = `地址要以 http(s):// 开头，或 ${prefix || "assets/"} 开头的仓库路径`;
		return;
	}
	const limit = bodyMedia?.max ?? 9;
	if (photos.length >= limit) {
		mediaError = `最多 ${limit} 张图片`;
		return;
	}
	photos = [...photos, { id: uid(), url: value, name: fileNameOf(value) }];
	mediaUrl = "";
	mediaError = "";
}

/**
 * 把还没上传的本地图片传上去。
 *
 * 严格串行：GitHub 同一分支不接受并发提交，第二张起必然 422（状态板上踩过）。
 * 任何一张失败就整体中止，已经传上去的留在列表里，重试不会重复上传。
 */
async function flushPhotos(): Promise<boolean> {
	const target = bodyMedia;
	if (!target) return true;

	const waiting = photos.filter((photo) => photo.file);
	if (waiting.length === 0) return true;

	if (!editor.branch) {
		mediaError = "登录态还没就绪，稍等一下再提交";
		return false;
	}

	uploading = true;
	mediaError = "";
	try {
		for (const [index, photo] of waiting.entries()) {
			const file = photo.file;
			if (!file) continue;
			pendingPhoto = photo.id;
			mediaProgress = `上传第 ${index + 1}/${waiting.length} 张：${photo.name}`;
			const url = await uploadBodyImage(file, editor.branch, {
				dir: target.uploadDir,
				refPrefix: target.refPrefix,
			});
			photos = photos.map((item) =>
				item.id === photo.id ? { ...item, url, file: undefined } : item,
			);
		}
		return true;
	} catch (error) {
		// 401 = Cookie 过期，按 §24 的约定交给 store 复位，不许自己吞掉
		if (error instanceof EditorApiError && error.status === 401) {
			await editor.expireSession();
		}
		mediaError = error instanceof Error ? error.message : String(error);
		return false;
	} finally {
		uploading = false;
		pendingPhoto = "";
		mediaProgress = "";
	}
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
			<span class="admin-editor__draft-hint"
				>不会立刻上线，去右上角「待提交」一次性提交</span
			>
		</div>

		<div class="admin-editor__actions">
			{#if !isNew}
				<button
					type="button"
					class="admin-btn admin-btn--danger admin-btn--sm"
					onclick={askDelete}
					disabled={busy}
				>
					<Trash2 size={13} aria-hidden="true" />
					{confirmDelete ? "再点一次确认" : "删除"}
				</button>
			{:else}
				<button
					type="button"
					class="admin-btn admin-btn--sm"
					onclick={onClose}
					disabled={busy}
				>
					<X size={13} aria-hidden="true" />
					取消
				</button>
			{/if}
			<button
				type="button"
				class="admin-btn admin-btn--primary admin-btn--sm"
				onclick={() => void submit()}
				disabled={busy}
			>
				{#if uploading}
					<Loader2 size={13} class="spin" aria-hidden="true" /> 上传图片…
				{:else}
					<Plus size={13} aria-hidden="true" />
					存入草稿箱
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
				{#if bodyMedia}
					<span class="admin-field__hint"
						>图片不写在这里，下面单独放，保存时自动排在正文之后</span
					>
				{/if}
			</div>
			<textarea
				class="admin-textarea"
				spellcheck="false"
				placeholder={bodyMedia ? "此刻在想什么…" : "正文…"}
				bind:value={bodyText}
			></textarea>

			{#if bodyMedia}
				<div class="admin-media">
					<div class="admin-media__head">
						<span class="admin-media__title">
							图片
							<span class="admin-media__count"
								>{photos.length}/{bodyMedia.max}</span
							>
						</span>
						<span class="admin-field__hint"
							>拖进来即可，自动压成 webp · 拖动排序</span
						>
						<button
							type="button"
							class="admin-btn admin-btn--sm"
							onclick={() => mediaInput?.click()}
							disabled={busy || photos.length >= bodyMedia.max}
						>
							<ImagePlus size={13} aria-hidden="true" />
							选择图片
						</button>
					</div>

					<input
						class="admin-media__file"
						type="file"
						accept="image/*"
						multiple
						bind:this={mediaInput}
						onchange={onFileChange}
					/>

					<div
						class="admin-media__grid"
						class:is-over={mediaDragging}
						role="list"
						ondragenter={onGridDragEnter}
						ondragover={onGridDragOver}
						ondragleave={onGridDragLeave}
						ondrop={onGridDrop}
					>
						{#each photos as photo, index (photo.id)}
							<div
								class="admin-media__item"
								class:is-dragging={dragFrom === index}
								class:is-over={dragOver === index && dragFrom !== index}
								draggable="true"
								role="listitem"
								ondragstart={() => {
									dragFrom = index;
								}}
								ondragenter={() => {
									if (dragFrom >= 0) dragOver = index;
								}}
								ondragover={(event) => event.preventDefault()}
								ondragend={() => {
									dragFrom = -1;
									dragOver = -1;
								}}
								ondrop={(event) => {
									event.preventDefault();
									onDropSort(index);
								}}
							>
								{#if previewMediaUrl(photo)}
									<img
										class="admin-media__img"
										src={previewMediaUrl(photo)}
										alt={photo.name}
										loading="lazy"
									/>
								{:else}
									<span class="admin-media__pending">
										<ImagePlus size={14} aria-hidden="true" />
										{photo.name}
										<small>重新构建后可见</small>
									</span>
								{/if}
								<button
									type="button"
									class="admin-media__remove"
									onclick={() => removePhoto(index)}
									aria-label={`移除第 ${index + 1} 张图片`}
								>
									<X size={10} aria-hidden="true" />
								</button>
								{#if pendingPhoto === photo.id}
									<span class="admin-media__busy">
										<Loader2 size={15} class="spin" aria-hidden="true" />
									</span>
								{/if}
							</div>
						{/each}

						{#if photos.length < bodyMedia.max}
							<button
								type="button"
								class="admin-media__add"
								onclick={() => mediaInput?.click()}
								disabled={busy}
							>
								<Plus size={16} aria-hidden="true" />
								<span>添加</span>
							</button>
						{/if}
					</div>

					<div class="admin-media__url">
						<Link2 size={12} aria-hidden="true" />
						<input
							class="admin-input"
							bind:value={mediaUrl}
							placeholder={`粘贴图片地址 https://… 或 ${bodyMedia.refPrefix}…`}
							onkeydown={(event) => {
								if (event.key === "Enter") {
									event.preventDefault();
									addByUrl();
								}
							}}
						/>
						<button
							type="button"
							class="admin-btn admin-btn--sm"
							onclick={addByUrl}
							disabled={busy}
						>
							添加
						</button>
					</div>

					{#if mediaProgress}
						<p class="admin-media__status">{mediaProgress}</p>
					{/if}
					{#if mediaError}
						<p class="admin-editor__error">{mediaError}</p>
					{/if}
				</div>
			{/if}
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
		<span class="admin-editor__hint">存入草稿箱，提交全部后 1~3 分钟上线</span>
	</footer>
</main>
