<script lang="ts">
/**
 * 说说编辑抽屉
 *
 * 新建和编辑共用一套表单，靠 editorUi.momentMode 区分：
 * - create：空白草稿，提交时不带 sha；同一天已有文件会返回 422，自动加 -2、-3 重试
 * - edit：先读源文件拿 sha（更新必须带），提交时带回去，避免覆盖别人的改动
 *
 * 表单顺序 = 填写顺序：标题 → 正文 → 图片 → 心情 → 话题 → 时间地点。
 * 心情和话题在文件里同属 `tags`，但语义不同（第一项是心情，其余是话题），
 * 所以界面上拆成两个控件，保存时再拼回去（见 save 里的 tags 组装）。
 *
 * 图片是**结构化**的：界面上的缩略图列表就是正文末尾那些 `![](…)` 行。
 * 载入时用 splitMomentMedia 把它们从正文里拆出来，保存时按列表顺序重新拼回去
 * —— 也就是说，图片永远排在正文之后，正文里不再手写图片语法。
 *
 * 提交成功不等于上线：文件 push 上去之后 GitHub Actions 还要重新构建，完成后才可见。
 * 所以提示语写「已提交」而不是「已发布」，别让人以为立刻生效。
 */
import { ImagePlus, Link2, Loader2, Plus, Trash2, X } from "lucide-svelte";
import { untrack } from "svelte";
import { editor } from "@/utils/editor/editor-store";
import { editorUi } from "@/utils/editor/editor-ui";
import {
	deleteFile,
	EditorApiError,
	REPO_NAME,
	REPO_OWNER,
	readFile,
	writeFile,
} from "@/utils/editor/github-client";
import { uploadMomentImage } from "@/utils/editor/image-upload";
import {
	buildMomentId,
	createEmptyDraft,
	fromInputValue,
	type MomentDraft,
	momentPath,
	nextMomentId,
	parseMomentFile,
	serializeMoment,
	toInputValue,
} from "@/utils/editor/moment-serializer";
import { splitMomentMedia } from "@/utils/moment-media";
import { MOODS, splitTags } from "@/utils/moment-mood";

/** 一张待提交的图片：本地文件传上去之前先占个位 */
interface PhotoItem {
	id: string;
	/** 正文里要写的地址：远程 URL 或仓库相对路径 `assets/diary/xxx.webp` */
	url: string;
	/** 还没上传的本地文件；为空说明已经在仓库里或者是外链 */
	file?: File;
	/** 本地文件的预览地址（objectURL），上传完就可以释放 */
	local?: string;
}

const MAX_PHOTOS = 9;

let draft: MomentDraft | null = $state(null);
let photos = $state<PhotoItem[]>([]);
/** 心情：存的是 MOODS 里的 label，空串表示没选 */
let mood: string = $state("");
/** 话题：tags 里除心情之外的部分 */
let topics = $state<string[]>([]);
let sha: string = $state("");
let loading: boolean = $state(false);
let saving: boolean = $state(false);
let removing: boolean = $state(false);
let errorText: string = $state("");
let confirmDelete: boolean = $state(false);
let tagInput: string = $state("");
let urlInput: string = $state("");
let dragging: boolean = $state(false);
/** 正在上传的那张图的 id，用来在缩略图上盖一层转圈 */
let pendingPhoto: string = $state("");
/** 拖动排序的起点 / 悬停点 */
let dragFrom: number = $state(-1);
let dragOver: number = $state(-1);
let fileInput: HTMLInputElement | null = $state(null);
let loadSeq = 0;
let confirmTimer: ReturnType<typeof setTimeout> | null = null;

const isEdit = $derived($editorUi.momentMode === "edit");
const bodyLength = $derived(draft?.body.length ?? 0);

function dateFromPublished(value: string): Date {
	const matched = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
	if (!matched) return new Date();
	return new Date(
		Number(matched[1]),
		Number(matched[2]) - 1,
		Number(matched[3]),
	);
}

function uid(): string {
	return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** 缩略图地址：本地文件用 objectURL，仓库内相对路径走 GitHub raw */
function previewOf(photo: PhotoItem): string {
	if (photo.local) return photo.local;
	if (/^(https?:|data:|blob:)/i.test(photo.url)) return photo.url;
	const clean = photo.url.replace(/^\.?\//, "");
	const branch = editor.branch || "main";
	return `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${branch}/src/content/${encodeURI(clean)}`;
}

/** 把读到的源文件铺进表单 */
function applyDraft(next: MomentDraft): void {
	const { text, media } = splitMomentMedia(next.body);
	const { mood: parsedMood, topics: parsedTopics } = splitTags(next.tags);

	draft = { ...next, body: text };
	photos = media.map((url) => ({ id: uid(), url }));
	mood = parsedMood?.label ?? "";
	topics = parsedTopics;
}

function releasePhotos(): void {
	for (const photo of photos) {
		if (photo.local) URL.revokeObjectURL(photo.local);
	}
}

async function load(mode: string, id: string): Promise<void> {
	loadSeq += 1;
	const seq = loadSeq;
	errorText = "";
	sha = "";
	confirmDelete = false;
	tagInput = "";
	urlInput = "";
	releasePhotos();
	photos = [];

	if (mode === "create") {
		draft = createEmptyDraft();
		mood = "";
		topics = [];
		loading = false;
		return;
	}

	loading = true;
	draft = null;
	try {
		const file = await readFile(momentPath(id), editor.branch);
		if (seq !== loadSeq) return;
		if (!file) {
			errorText = "没找到这条说说的源文件，可能刚被改动过";
			return;
		}
		sha = file.sha;
		applyDraft(parseMomentFile(file.text, id));
		// 卡片上点的是「删除」，进来就直接摆出确认态，少点一步
		if ($editorUi.momentIntent === "delete") confirmDelete = true;
	} catch (error) {
		if (seq !== loadSeq) return;
		errorText = editor.describeError(error);
	} finally {
		if (seq === loadSeq) loading = false;
	}
}

$effect(() => {
	const open = $editorUi.momentOpen;
	const mode = $editorUi.momentMode;
	const id = $editorUi.momentId;
	if (!open) return;

	// 必须 untrack：load() 的同步段会「读 photos（releasePhotos）→ 立即清空 photos」，
	// 留在追踪上下文里就等于 effect 自己改自己的依赖，Svelte 会报
	// effect_update_depth_exceeded，界面直接卡死（X 和 Esc 都点不动）。
	untrack(() => {
		if (!$editor.isEditor) {
			editorUi.closeMoment();
			editorUi.openLogin("登录之后才能编辑说说");
			return;
		}
		void load(mode, id);
	});
});

function close(): void {
	releasePhotos();
	editorUi.closeMoment();
	document.body.style.overflow = "";
}

$effect(() => {
	if (!$editorUi.momentOpen) return;
	document.body.style.overflow = "hidden";
	const onKeydown = (event: KeyboardEvent): void => {
		if (event.key === "Escape") close();
	};
	window.addEventListener("keydown", onKeydown);
	return () => {
		window.removeEventListener("keydown", onKeydown);
		document.body.style.overflow = "";
	};
});

/* ---------------------------------------------------------------- 图片 */

function addFiles(files: FileList | File[]): void {
	const room = MAX_PHOTOS - photos.length;
	if (room <= 0) {
		errorText = `最多 ${MAX_PHOTOS} 张图片`;
		return;
	}

	const picked = [...files]
		.filter((file) => file.type.startsWith("image/"))
		.slice(0, room);

	if (picked.length === 0) {
		errorText = "这些文件不是图片";
		return;
	}

	photos = [
		...photos,
		...picked.map((file) => ({
			id: uid(),
			url: "",
			file,
			local: URL.createObjectURL(file),
		})),
	];
	errorText = "";
}

function onFileChange(event: Event): void {
	const input = event.currentTarget as HTMLInputElement;
	if (input.files?.length) addFiles(input.files);
	// 清空 value，选同一张图也能再触发 change
	input.value = "";
}

function onDropFiles(event: DragEvent): void {
	event.preventDefault();
	dragging = false;
	const files = event.dataTransfer?.files;
	if (files?.length) addFiles(files);
}

function removePhoto(index: number): void {
	const target = photos[index];
	if (target?.local) URL.revokeObjectURL(target.local);
	photos = photos.filter((_, i) => i !== index);
}

function onDropSort(target: number): void {
	if (dragFrom < 0 || dragFrom === target) {
		dragFrom = -1;
		dragOver = -1;
		return;
	}
	const next = [...photos];
	const [moved] = next.splice(dragFrom, 1);
	// 先删后插时，目标下标要往前挪一格，否则会永远差一位
	next.splice(dragFrom < target ? target - 1 : target, 0, moved);
	photos = next;
	dragFrom = -1;
	dragOver = -1;
}

function addPhotoByUrl(): void {
	const value = urlInput.trim();
	if (!value) return;
	if (!/^https?:\/\//i.test(value) && !value.startsWith("assets/")) {
		errorText = "链接要以 http(s):// 开头";
		return;
	}
	if (photos.length >= MAX_PHOTOS) {
		errorText = `最多 ${MAX_PHOTOS} 张图片`;
		return;
	}
	photos = [...photos, { id: uid(), url: value }];
	urlInput = "";
	errorText = "";
}

/* ---------------------------------------------------------------- 标签 */

function addTopic(): void {
	const value = tagInput.trim().replace(/^#/, "");
	if (!value) return;
	if (!topics.includes(value)) topics = [...topics, value];
	tagInput = "";
}

function removeTopic(index: number): void {
	topics = topics.filter((_, i) => i !== index);
}

function pickMood(label: string): void {
	mood = mood === label ? "" : label;
}

/* ---------------------------------------------------------------- 提交 */

async function save(): Promise<void> {
	if (!draft || saving) return;

	const text = draft.body.trim();
	if (!text && photos.length === 0) {
		errorText = "写点什么，或者放张图";
		return;
	}

	saving = true;
	errorText = "";

	try {
		// 先把本地图传上去换成仓库路径；外链原样保留
		const urls: string[] = [];
		for (const photo of photos) {
			if (photo.file) {
				pendingPhoto = photo.id;
				urls.push(await uploadMomentImage(photo.file, editor.branch));
			} else if (photo.url) {
				urls.push(photo.url);
			}
		}
		pendingPhoto = "";

		// 图片统一排在正文之后，一条一行，空 alt（带 alt 会被包成 figure）
		const parts: string[] = [];
		if (text) parts.push(text);
		for (const url of urls) parts.push(`![](${url})`);

		const next: MomentDraft = {
			...draft,
			body: parts.join("\n\n"),
			tags: [...(mood ? [mood] : []), ...topics],
		};
		const payload = serializeMoment(next);

		if (isEdit) {
			await writeFile({
				path: momentPath(draft.id),
				text: payload,
				message: `chore(moments): 更新说说 ${draft.id}`,
				branch: editor.branch,
				sha,
			});
		} else {
			const baseId = buildMomentId(dateFromPublished(draft.published));
			let attempt = 1;
			for (;;) {
				try {
					await writeFile({
						path: momentPath(nextMomentId(baseId, attempt)),
						text: payload,
						message: `feat(moments): 新增说说 ${baseId}`,
						branch: editor.branch,
					});
					break;
				} catch (error) {
					// 422 = 文件已存在但没给 sha，说明同一天已经有说说了
					const exists =
						error instanceof EditorApiError && error.status === 422;
					if (exists && attempt < 9) {
						attempt += 1;
						continue;
					}
					throw error;
				}
			}
		}

		editor.notify("已提交，正在重新构建，1~3 分钟后生效");
		close();
	} catch (error) {
		errorText = editor.describeError(error);
	} finally {
		pendingPhoto = "";
		saving = false;
	}
}

async function remove(): Promise<void> {
	if (!draft) return;
	if (!confirmDelete) {
		confirmDelete = true;
		if (confirmTimer) clearTimeout(confirmTimer);
		confirmTimer = setTimeout(() => {
			confirmDelete = false;
		}, 4000);
		return;
	}

	removing = true;
	errorText = "";
	try {
		await deleteFile({
			path: momentPath(draft.id),
			message: `chore(moments): 删除说说 ${draft.id}`,
			branch: editor.branch,
			sha,
		});
		editor.notify("已提交删除，1~3 分钟后生效");
		close();
	} catch (error) {
		errorText = editor.describeError(error);
	} finally {
		removing = false;
	}
}
</script>

{#if $editorUi.momentOpen}
	<div class="editor-drawer-layer">
		<div
			class="editor-drawer__scrim"
			role="button"
			tabindex="-1"
			aria-label="关闭编辑器"
			onclick={close}
			onkeydown={(event) => {
				if (event.key === "Enter" || event.key === " ") close();
			}}
		></div>

		<aside
			class="editor-drawer"
			role="dialog"
			aria-modal="true"
			aria-label={isEdit ? "编辑说说" : "新建说说"}
		>
			<header class="editor-drawer__head">
				<div>
					<strong>{isEdit ? "编辑说说" : "新建说说"}</strong>
					{#if draft}
						<span class="editor-drawer__path">{draft.id}.md</span>
					{/if}
				</div>
				<button
					type="button"
					class="editor-drawer__close"
					onclick={close}
					aria-label="关闭"
				>
					<X size={17} aria-hidden="true" />
				</button>
			</header>

			<div class="editor-drawer__body">
				{#if loading}
					<p class="editor-drawer__state">正在读取源文件…</p>
				{:else if errorText && !draft}
					<p class="editor-drawer__state is-error">{errorText}</p>
				{:else if draft}
					<!-- ① 标题 -->
					<div class="editor-drawer__field">
						<label class="editor-drawer__label" for="moment-title">
							<span class="editor-drawer__idx">1</span>标题
							<span class="editor-drawer__hint">可空 · 留空就只显示正文</span>
						</label>
						<input
							id="moment-title"
							class="editor-drawer__input is-title"
							bind:value={draft.title}
							placeholder="一句话概括这条说说"
						/>
					</div>

					<!-- ② 正文 -->
					<div class="editor-drawer__field">
						<label class="editor-drawer__label" for="moment-body">
							<span class="editor-drawer__idx">2</span>正文
							<span class="editor-drawer__hint">支持 Markdown</span>
						</label>
						<div class="editor-drawer__textarea-wrap">
							<textarea
								id="moment-body"
								class="editor-drawer__textarea"
								bind:value={draft.body}
								placeholder="此刻在想什么…&#10;图片往下拖，不用再手写语法了。"
								spellcheck="false"
							></textarea>
							<span class="editor-drawer__count">{bodyLength} / 2000</span>
						</div>
					</div>

					<!-- ③ 图片 -->
					<div class="editor-drawer__field">
						<span class="editor-drawer__label">
							<span class="editor-drawer__idx">3</span>图片
							<span class="editor-drawer__hint"
								>最多 {MAX_PHOTOS} 张 · 第一张作封面 · 可拖动排序</span
							>
						</span>

						{#if photos.length > 0}
							<div class="editor-photos" role="list">
								{#each photos as photo, index (photo.id)}
									<div
										class="editor-photo"
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
										<img
											class="editor-photo__img"
											src={previewOf(photo)}
											alt=""
											loading="lazy"
										/>
										<span class="editor-photo__badge"
											>{index === 0 ? "封面" : index + 1}</span
										>
										<button
											type="button"
											class="editor-photo__remove"
											onclick={() => removePhoto(index)}
											aria-label={`移除第 ${index + 1} 张图片`}
										>
											<X size={11} aria-hidden="true" />
										</button>
										{#if pendingPhoto === photo.id}
											<span class="editor-photo__pending">
												<Loader2 size={16} class="editor-spin" aria-hidden="true" />
											</span>
										{/if}
									</div>
								{/each}
							</div>
						{/if}

						<button
							type="button"
							class="editor-drop"
							class:is-over={dragging}
							onclick={() => fileInput?.click()}
							ondragover={(event) => {
								event.preventDefault();
								dragging = true;
							}}
							ondragleave={() => {
								dragging = false;
							}}
							ondrop={onDropFiles}
						>
							<span class="editor-drop__icon">
								<ImagePlus size={16} aria-hidden="true" />
							</span>
							<span class="editor-drop__title">
								把图片拖到这里，或<strong>点击选择文件</strong>
							</span>
							<span class="editor-drop__sub">JPG / PNG / WebP / GIF，单张 ≤ 8MB</span>
						</button>
						<input
							type="file"
							accept="image/*"
							multiple
							hidden
							bind:this={fileInput}
							onchange={onFileChange}
						/>

						<div class="editor-url">
							<span class="editor-url__tag">
								<Link2 size={13} aria-hidden="true" />
								链接
							</span>
							<input
								class="editor-drawer__input"
								bind:value={urlInput}
								placeholder="粘贴图片地址 https://…"
								onkeydown={(event) => {
									if (event.key === "Enter") {
										event.preventDefault();
										addPhotoByUrl();
									}
								}}
							/>
							<button
								type="button"
								class="editor-drawer__btn is-mini"
								onclick={addPhotoByUrl}
							>
								<Plus size={13} aria-hidden="true" />
								添加
							</button>
						</div>
					</div>

					<!-- 心情 -->
					<div class="editor-drawer__field">
						<span class="editor-drawer__label">
							心情
							<span class="editor-drawer__hint">单选 · 可选 · 再点一次取消</span>
						</span>
						<div class="editor-moods">
							{#each MOODS as item (item.label)}
								<button
									type="button"
									class="editor-mood"
									class:is-on={mood === item.label}
									data-tone={item.tone}
									aria-pressed={mood === item.label}
									onclick={() => pickMood(item.label)}
								>
									<span class="editor-mood__emoji" aria-hidden="true">{item.emoji}</span>
									{item.label}
								</button>
							{/each}
						</div>
					</div>

					<!-- 话题 -->
					<div class="editor-drawer__field">
						<label class="editor-drawer__label" for="moment-topics">
							话题
							<span class="editor-drawer__hint">回车添加 · 可多个</span>
						</label>
						<div class="editor-topics">
							{#each topics as topic, index (topic)}
								<span class="editor-chip">
									<span class="editor-chip__hash">#</span>{topic}
									<button
										type="button"
										onclick={() => removeTopic(index)}
										aria-label={`移除话题 ${topic}`}
									>
										<X size={9} aria-hidden="true" />
									</button>
								</span>
							{/each}
							<input
								id="moment-topics"
								class="editor-topics__input"
								bind:value={tagInput}
								placeholder="回车添加，比如 AstrBot"
								onkeydown={(event) => {
									if (event.key === "Enter") {
										event.preventDefault();
										addTopic();
									}
								}}
								onblur={addTopic}
							/>
						</div>
					</div>

					<div class="editor-drawer__row">
						<div class="editor-drawer__col">
							<label class="editor-drawer__label" for="moment-published"
								>发布时间</label
							>
							<input
								id="moment-published"
								class="editor-drawer__input"
								type="datetime-local"
								value={toInputValue(draft.published)}
								oninput={(event) => {
									if (!draft) return;
									draft.published = fromInputValue(
										(event.currentTarget as HTMLInputElement).value,
									);
								}}
							/>
						</div>
						<div class="editor-drawer__col">
							<label class="editor-drawer__label" for="moment-location">
								地点 <span class="editor-drawer__hint">可空</span>
							</label>
							<input
								id="moment-location"
								class="editor-drawer__input"
								bind:value={draft.location}
								placeholder="比如 杭州"
							/>
						</div>
					</div>

					<label class="editor-drawer__check">
						<input type="checkbox" bind:checked={draft.pinned} />
						<span>置顶这条说说</span>
					</label>

					{#if errorText}
						<p class="editor-drawer__error">{errorText}</p>
					{/if}
				{/if}
			</div>

			<footer class="editor-drawer__foot">
				{#if isEdit}
					<button
						type="button"
						class="editor-drawer__btn is-danger"
						onclick={remove}
						disabled={removing || saving || !draft}
					>
						<Trash2 size={14} aria-hidden="true" />
						{removing ? "删除中…" : confirmDelete ? "确认删除？" : "删除"}
					</button>
				{/if}
				<span class="editor-drawer__spacer"></span>
				<button
					type="button"
					class="editor-drawer__btn"
					onclick={close}
					disabled={saving}
				>
					取消
				</button>
				<button
					type="button"
					class="editor-drawer__btn is-primary"
					onclick={save}
					disabled={saving || !draft || loading}
				>
					{#if saving}
						{pendingPhoto ? "上传图片…" : "提交中…"}
					{:else}
						<Plus size={14} aria-hidden="true" />
						提交
					{/if}
				</button>
			</footer>
		</aside>
	</div>
{/if}
