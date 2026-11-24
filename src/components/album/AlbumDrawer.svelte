<script lang="ts">
/**
 * 相册编辑弹窗
 *
 * 三种模式共用一套外壳，靠 albumUi.mode 区分：
 * - create：给某个相册追加照片，可以一次挑多张（拖拽 / 点选 / 贴 URL）
 * - edit：改某一张已有照片的描述、标签、拍摄时间；图片本身锁住不给换 ——
 *   换图等于换了一张照片，直接删了重建比原地改更清楚
 * - new：新建一整本相册，写一个新的 `相册/<id>.json`；顺手可以放进第一批照片，
 *   这样「建相册」和「往里放图」不用来回切两次
 *
 * 数据源是 `src/content/相册/<id>.json`，保存时先读文件拿 sha 再整体写回，
 * 所以「谁也不知道页面上那张图在 json 里长什么样」这件事不成立：
 * 一律以仓库里的真实文件为准，页面 payload 只用来填相册名和缩略图。
 * 新建模式例外：文件还不存在，先探一次 `readFile` 确认没撞名，再不带 sha 写入。
 *
 * 一个坑：相册页的照片有两份来源 —— json 里显式声明的 photos，以及
 * localFolder 目录扫描出来的文件。后者不在 json 里，删不掉，所以删除
 * 逻辑统一放在相册页的内联脚本里，这里只管「改」「加」和「建」。
 *
 * 提交成功 ≠ 已上线：push 之后 GitHub Actions 还要重建，1~3 分钟后可见。
 */
import { ImagePlus, Link2, Loader2, Trash2, X } from "lucide-svelte";
import { untrack } from "svelte";
import {
	type AlbumFile,
	albumPath,
	albumUploadFolder,
	createAlbumDraft,
	emptyAlbumPhoto,
	indexOfPhoto,
	newAlbumFolderId,
	parseAlbumFile,
	sanitizeAlbumId,
	serializeAlbum,
} from "@/utils/editor/album-serializer";
import { type AlbumDrawerMode, albumUi } from "@/utils/editor/album-ui";
import { editor } from "@/utils/editor/editor-store";
import { editorUi } from "@/utils/editor/editor-ui";
import {
	EditorApiError,
	readFile,
	writeFile,
} from "@/utils/editor/github-client";
import { uploadAlbumImage } from "@/utils/editor/image-upload";

/** 一张待提交的照片 */
interface PhotoItem {
	id: string;
	/** 仓库内路径（`/assets/images/albums/...`）或外链 */
	url: string;
	/** 还没上传的本地文件 */
	file?: File;
	/** 本地文件的 objectURL，上传完释放 */
	local?: string;
}

/** 相册页 payload 里够这里用的字段 */
interface AlbumOption {
	id: string;
	title: string;
	localFolder: string;
}

const MAX_PHOTOS = 9;

let album: AlbumFile | null = $state(null);
let options = $state<AlbumOption[]>([]);
let targetId: string = $state("");
let photos = $state<PhotoItem[]>([]);
let caption: string = $state("");
let tags = $state<string[]>([]);
let takenAt: string = $state("");
let tagInput: string = $state("");
let urlInput: string = $state("");
let dragging: boolean = $state(false);
let pendingPhoto: string = $state("");
let sha: string = $state("");
let loading: boolean = $state(false);
let saving: boolean = $state(false);
let errorText: string = $state("");
let fileInput: HTMLInputElement | null = $state(null);

/* 新建相册模式专用：相册本身的字段，和「单张照片」那几项不共用 */
let albumTitle: string = $state("");
let albumSubtitle: string = $state("");
let albumLocation: string = $state("");
let albumDate: string = $state("");

const isEdit = $derived($albumUi.mode === "edit" && Boolean($albumUi.src));
const isNew = $derived($albumUi.mode === "new");
const title = $derived(isNew ? "新建相册" : isEdit ? "编辑照片" : "新增照片");
const canSave = $derived(
	!saving &&
		(isNew
			? albumTitle.trim().length > 0 && sanitizeAlbumId(targetId).length > 0
			: photos.length > 0 &&
				(isEdit || photos.every((photo) => photo.url || photo.file))),
);

function todayInput(): string {
	const now = new Date();
	const pad = (value: number): string => String(value).padStart(2, "0");
	return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function uid(): string {
	return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** 相册选项从页面上的 payload 抄，避免为了一个下拉框再发一次请求 */
function readOptions(): AlbumOption[] {
	const node = document.querySelector<HTMLScriptElement>(
		"[data-album-payload]",
	);
	if (!node?.textContent) return [];
	try {
		const parsed: unknown = JSON.parse(node.textContent);
		if (!Array.isArray(parsed)) return [];
		return parsed.map((item) => {
			const record = item as Record<string, unknown>;
			return {
				id: String(record.id ?? ""),
				title: String(record.title ?? ""),
				localFolder: String(record.localFolder ?? ""),
			};
		});
	} catch {
		return [];
	}
}

/** 缩略图地址：本地文件用 objectURL，其余（public 下/外链）直接用 */
function previewOf(photo: PhotoItem): string {
	if (photo.local) return photo.local;
	return photo.url;
}

function isoToInput(iso: string): string {
	if (!iso) return "";
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return "";
	const pad = (value: number): string => String(value).padStart(2, "0");
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function inputToIso(value: string): string {
	if (!value) return "";
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function releasePhotos(): void {
	for (const photo of photos) {
		if (photo.local) URL.revokeObjectURL(photo.local);
	}
}

/** 载入序号：连点两张照片时，晚到的旧响应必须丢掉 */
let loadSeq = 0;

/** 读目标相册，顺带把编辑模式要改的那张照片铺进表单 */
async function load(
	id: string,
	src: string,
	mode: AlbumDrawerMode,
): Promise<void> {
	loadSeq += 1;
	const seq = loadSeq;
	errorText = "";
	sha = "";
	tagInput = "";
	urlInput = "";
	takenAt = "";
	caption = "";
	tags = [];
	albumTitle = "";
	albumSubtitle = "";
	albumLocation = "";
	albumDate = "";
	targetId = id;
	options = readOptions();
	releasePhotos();
	photos = [];

	// 新建：没有源文件可读，先铺一份空白草稿；图片目录默认现生成一个不撞名的
	if (mode === "new") {
		loading = false;
		targetId = newAlbumFolderId();
		albumDate = todayInput();
		album = createAlbumDraft({
			id: targetId,
			title: "",
			date: albumDate,
		});
		return;
	}

	if (!id) {
		album = null;
		loading = false;
		errorText = "没有选中相册";
		return;
	}

	loading = true;
	album = null;
	try {
		const file = await readFile(albumPath(id), editor.branch);
		if (seq !== loadSeq) return;
		if (!file) {
			errorText = "没找到这个相册的源文件，可能刚被改动过";
			return;
		}
		sha = file.sha;
		const parsed = parseAlbumFile(file.text, id);
		album = parsed;

		if (src) {
			const index = indexOfPhoto(parsed, src);
			if (index < 0) {
				errorText = "这张照片不在相册文件里，可能来自本地目录扫描，暂时改不了";
				return;
			}
			const photo = parsed.photos[index];
			caption = photo.caption;
			tags = [...photo.tags];
			takenAt = isoToInput(photo.takenAt);
			photos = [{ id: uid(), url: photo.src }];
		}
	} catch (error) {
		if (seq !== loadSeq) return;
		errorText = editor.describeError(error);
	} finally {
		if (seq === loadSeq) loading = false;
	}
}

$effect(() => {
	const open = $albumUi.open;
	const id = $albumUi.albumId;
	const src = $albumUi.src;
	const mode = $albumUi.mode;
	if (!open) return;

	// 同 MomentDrawer：load() 的同步段会读 photos 再清空，留在追踪上下文里
	// 就是 effect 改自己的依赖，Svelte 会直接报 effect_update_depth_exceeded
	untrack(() => {
		if (!editor.isEditor) {
			albumUi.close();
			editorUi.openLogin("登录之后才能管理相册");
			return;
		}
		void load(id, src, mode);
	});
});

function close(): void {
	releasePhotos();
	albumUi.close();
	document.body.style.overflow = "";
}

$effect(() => {
	if (!$albumUi.open) return;
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
	if (isEdit) return;
	const room = MAX_PHOTOS - photos.length;
	if (room <= 0) {
		errorText = `最多 ${MAX_PHOTOS} 张`;
		return;
	}
	errorText = "";
	const accepted: PhotoItem[] = [];
	for (const file of Array.from(files).slice(0, room)) {
		if (!file.type.startsWith("image/")) continue;
		accepted.push({
			id: uid(),
			url: "",
			file,
			local: URL.createObjectURL(file),
		});
	}
	if (accepted.length === 0) {
		errorText = "没认出图片，换一张试试";
		return;
	}
	photos = [...photos, ...accepted];
}

function onPick(event: Event): void {
	const input = event.currentTarget as HTMLInputElement;
	if (input.files) addFiles(input.files);
	// 清空，才能连续两次选同一个文件都触发 change
	input.value = "";
}

function onDrop(event: DragEvent): void {
	event.preventDefault();
	dragging = false;
	if (event.dataTransfer?.files?.length) addFiles(event.dataTransfer.files);
}

function addUrl(): void {
	const raw = urlInput.trim();
	if (!raw) return;
	if (isEdit) return;
	if (photos.length >= MAX_PHOTOS) {
		errorText = `最多 ${MAX_PHOTOS} 张`;
		return;
	}
	photos = [...photos, { id: uid(), url: raw }];
	urlInput = "";
	errorText = "";
}

function removePhoto(id: string): void {
	const target = photos.find((photo) => photo.id === id);
	if (target?.local) URL.revokeObjectURL(target.local);
	photos = photos.filter((photo) => photo.id !== id);
}

function addTag(): void {
	const value = tagInput.trim().replace(/^#/, "");
	if (!value) return;
	if (!tags.includes(value)) tags = [...tags, value];
	tagInput = "";
}

function removeTag(value: string): void {
	tags = tags.filter((tag) => tag !== value);
}

/* ---------------------------------------------------------------- 保存 */

/** 新建相册：探重名 → 传首批照片 → 不带 sha 写一个新 json */
async function createAlbumFile(): Promise<void> {
	const id = sanitizeAlbumId(targetId);
	if (!id) {
		throw new Error("图片目录只能用字母、数字、- 和 _，换个标识再试");
	}

	const existing = await readFile(albumPath(id), editor.branch);
	if (existing) {
		throw new Error(`相册 ${id}.json 已经存在，换个标识再试`);
	}

	const draft = createAlbumDraft({
		id,
		title: albumTitle,
		date: albumDate || todayInput(),
		subtitle: albumSubtitle,
		location: albumLocation,
		tags,
	});

	// 目录跟着 draft.id：相册页会扫描 localFolder，新图和目录扫描结果要落在同一处
	const folder = albumUploadFolder(draft);
	for (const photo of photos) {
		pendingPhoto = photo.id;
		let src = photo.url.trim();
		if (photo.file) {
			src = await uploadAlbumImage(photo.file, folder, editor.branch);
		}
		if (!src) continue;
		draft.photos.push({
			...emptyAlbumPhoto(),
			src,
			alt: albumTitle.trim(),
		});
	}
	pendingPhoto = "";

	await writeFile({
		path: albumPath(id),
		text: serializeAlbum(draft),
		message: `content(album): 新建相册 ${id}`,
		branch: editor.branch,
	});

	editor.notify(
		`相册「${draft.title}」已创建，1~3 分钟后可在上方切换到它继续加照片`,
	);
	releasePhotos();
	photos = [];
	close();
}

async function save(): Promise<void> {
	if (saving) return;
	errorText = "";
	saving = true;

	try {
		if (isNew) {
			await createAlbumFile();
			return;
		}
		if (!album) throw new Error("没读到相册文件，刷新页面再试");

		// create 模式下相册可能被下拉框改过，重新读一遍目标文件
		const id = isEdit ? album.id : targetId;
		const file = await readFile(albumPath(id), editor.branch);
		if (!file) throw new Error("相册源文件不见了，刷新页面再试");
		const next = parseAlbumFile(file.text, id);

		if (isEdit) {
			const index = indexOfPhoto(next, $albumUi.src);
			if (index < 0) throw new Error("这张照片已经不在相册里了");
			const current = next.photos[index];
			current.caption = caption.trim();
			current.tags = tags;
			current.takenAt = inputToIso(takenAt);
			current.alt = current.caption || current.alt || next.title || "相册照片";
		} else {
			const folder = albumUploadFolder(next);
			for (const photo of photos) {
				pendingPhoto = photo.id;
				let src = photo.url.trim();
				if (photo.file) {
					src = await uploadAlbumImage(photo.file, folder, editor.branch);
				}
				if (!src) continue;
				// 同一张图重复加两次没意义，按 src 去重
				if (indexOfPhoto(next, src) >= 0) continue;
				next.photos.push({
					...emptyAlbumPhoto(),
					src,
					caption: caption.trim(),
					tags: [...tags],
					takenAt: inputToIso(takenAt),
					alt: caption.trim() || next.title || "相册照片",
				});
			}
			pendingPhoto = "";
		}

		await writeFile({
			path: albumPath(id),
			text: serializeAlbum(next),
			message: isEdit
				? `content(album): 更新照片信息 ${id}`
				: `content(album): 新增照片 ${id}`,
			branch: editor.branch,
			sha: file.sha,
		});

		editor.notify(
			isEdit ? "照片信息已提交，1~3 分钟后生效" : "照片已提交，1~3 分钟后生效",
		);
		releasePhotos();
		photos = [];
		close();
	} catch (error) {
		if (error instanceof EditorApiError && error.status === 409) {
			errorText = "文件刚被别处改过，刷新页面再试一次";
		} else {
			errorText = editor.describeError(error);
		}
	} finally {
		saving = false;
		pendingPhoto = "";
	}
}
</script>

{#snippet photoField(idx: string)}
	<div class="editor-drawer__field">
		<span class="editor-drawer__label">
			<span class="editor-drawer__idx">{idx}</span>照片
			<span class="editor-drawer__hint">
				{isNew
					? `可选 · 建相册的同时就能放几张，最多 ${MAX_PHOTOS} 张`
					: isEdit
						? "要换图请删掉重加"
						: `最多 ${MAX_PHOTOS} 张 · 拖进来、点一下选、或贴 URL`}
			</span>
		</span>

		{#if photos.length > 0}
			<div class="editor-photos" role="list">
				{#each photos as photo (photo.id)}
					<div class="editor-photo" role="listitem">
						<img
							class="editor-photo__img"
							src={previewOf(photo)}
							alt=""
							loading="lazy"
						/>
						{#if pendingPhoto === photo.id}
							<span class="editor-photo__pending">
								<Loader2 class="editor-spin" size={16} aria-hidden="true" />
							</span>
						{/if}
						{#if !isEdit}
							<button
								type="button"
								class="editor-photo__remove"
								aria-label="移除这张照片"
								onclick={() => removePhoto(photo.id)}
							>
								<X size={12} aria-hidden="true" />
							</button>
						{/if}
					</div>
				{/each}
			</div>
		{/if}

		{#if !isEdit}
			<button
				type="button"
				class="editor-drop"
				class:is-active={dragging}
				onclick={() => fileInput?.click()}
				ondragover={(event) => {
					event.preventDefault();
					dragging = true;
				}}
				ondragleave={() => {
					dragging = false;
				}}
				ondrop={onDrop}
			>
				<ImagePlus size={18} aria-hidden="true" />
				<span>拖图片到这里，或点击选择文件</span>
			</button>

			<div class="editor-url">
				<Link2 size={15} aria-hidden="true" />
				<input
					class="editor-url__input"
					placeholder="也可以直接贴图片地址 https://…"
					bind:value={urlInput}
					onkeydown={(event) => {
						if (event.key === "Enter") {
							event.preventDefault();
							addUrl();
						}
					}}
				/>
				<button
					type="button"
					class="editor-drawer__btn is-mini"
					onclick={addUrl}
					disabled={!urlInput.trim()}
				>
					添加
				</button>
			</div>
			<input
				bind:this={fileInput}
				type="file"
				accept="image/*"
				multiple
				hidden
				onchange={onPick}
			/>
		{/if}
	</div>
{/snippet}

{#snippet tagField(idx: string)}
	<div class="editor-drawer__field">
		<span class="editor-drawer__label">
			<span class="editor-drawer__idx">{idx}</span>标签
			<span class="editor-drawer__hint">回车确认 · 用于搜索筛选</span>
		</span>
		<div class="editor-topics">
			{#each tags as tag (tag)}
				<span class="editor-chip">
					#{tag}
					<button
						type="button"
						aria-label={`移除 ${tag}`}
						onclick={() => removeTag(tag)}
					>
						<Trash2 size={11} aria-hidden="true" />
					</button>
				</span>
			{/each}
			<input
				class="editor-chip__input"
				placeholder={tags.length === 0 ? "比如 广州、云" : "继续添加…"}
				bind:value={tagInput}
				onkeydown={(event) => {
					if (event.key === "Enter" || event.key === ",") {
						event.preventDefault();
						addTag();
					} else if (
						event.key === "Backspace" &&
						!tagInput &&
						tags.length > 0
					) {
						removeTag(tags[tags.length - 1]);
					}
				}}
				onblur={addTag}
			/>
		</div>
	</div>
{/snippet}

{#if $albumUi.open}
	<div class="editor-drawer-layer">
		<div
			class="editor-drawer__scrim"
			role="button"
			tabindex="-1"
			aria-label="关闭"
			onclick={close}
			onkeydown={(event) => {
				if (event.key === "Enter" || event.key === " ") close();
			}}
		></div>

		<aside
			class="editor-drawer is-narrow"
			role="dialog"
			aria-modal="true"
			aria-label={title}
		>
			<header class="editor-drawer__head">
				<div>
					<strong>{title}</strong>
					{#if isNew}
						<span class="editor-drawer__path">
							{sanitizeAlbumId(targetId) || "…"}.json
						</span>
					{:else if album}
						<span class="editor-drawer__path">{album.id}.json</span>
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
					<p class="editor-drawer__state">正在读取相册文件…</p>
				{:else if isNew}
					<!-- 新建相册：文件还不存在，字段是相册本身的 -->
					<div class="editor-drawer__field">
						<label class="editor-drawer__label" for="album-title">
							<span class="editor-drawer__idx">1</span>相册名
							<span class="editor-drawer__hint">必填 · 显示在上方的相册标签里</span>
						</label>
						<input
							id="album-title"
							class="editor-drawer__input"
							bind:value={albumTitle}
							placeholder="比如 2026 冬天"
						/>
					</div>

					<div class="editor-drawer__field">
						<label class="editor-drawer__label" for="album-date">
							<span class="editor-drawer__idx">2</span>日期
							<span class="editor-drawer__hint">决定照片墙上的排序</span>
						</label>
						<input
							id="album-date"
							class="editor-drawer__input"
							type="date"
							bind:value={albumDate}
						/>
					</div>

					{@render photoField("3")}

					<div class="editor-drawer__field">
						<label class="editor-drawer__label" for="album-subtitle">
							<span class="editor-drawer__idx">4</span>副标题
							<span class="editor-drawer__hint">可空 · 一句话交代这本相册</span>
						</label>
						<input
							id="album-subtitle"
							class="editor-drawer__input"
							bind:value={albumSubtitle}
							placeholder="从旧博客带回来的生活碎片…"
						/>
					</div>

					<div class="editor-drawer__field">
						<label class="editor-drawer__label" for="album-location">
							<span class="editor-drawer__idx">5</span>地点
							<span class="editor-drawer__hint">可空</span>
						</label>
						<input
							id="album-location"
							class="editor-drawer__input"
							bind:value={albumLocation}
							placeholder="广州"
						/>
					</div>

					{@render tagField("6")}

					<div class="editor-drawer__field">
						<label class="editor-drawer__label" for="album-folder">
							<span class="editor-drawer__idx">7</span>图片目录
							<span class="editor-drawer__hint">
								文件名 + 图片文件夹，只能用字母数字 - _
							</span>
						</label>
						<input
							id="album-folder"
							class="editor-drawer__input"
							bind:value={targetId}
							onblur={() => {
								targetId = sanitizeAlbumId(targetId) || newAlbumFolderId();
							}}
							placeholder="album-xxxxxx"
						/>
						<p class="editor-drawer__hint">
							会写成 src/content/相册/{sanitizeAlbumId(targetId) || "…"}.json，图片进
							public/assets/images/albums/{sanitizeAlbumId(targetId) || "…"}/
						</p>
					</div>

					{#if errorText}
						<p class="editor-drawer__error" role="alert">{errorText}</p>
					{/if}
				{:else if errorText && !album}
					<p class="editor-drawer__state is-error">{errorText}</p>
				{:else if album}
					{@render photoField("1")}

					<!-- ② 描述 -->
					<div class="editor-drawer__field">
						<label class="editor-drawer__label" for="album-caption">
							<span class="editor-drawer__idx">2</span>描述
							<span class="editor-drawer__hint">会显示在照片角上</span>
						</label>
						<input
							id="album-caption"
							class="editor-drawer__input"
							bind:value={caption}
							placeholder="这张照片的故事…"
						/>
					</div>

					<!-- ③ 标签 -->
					{@render tagField("3")}

					<!-- ④ 拍摄时间 -->
					<div class="editor-drawer__field">
						<label class="editor-drawer__label" for="album-taken-at">
							<span class="editor-drawer__idx">4</span>拍摄时间
							<span class="editor-drawer__hint">可空 · 留空沿用相册日期</span>
						</label>
						<input
							id="album-taken-at"
							class="editor-drawer__input"
							type="datetime-local"
							bind:value={takenAt}
						/>
					</div>

					{#if errorText}
						<p class="editor-drawer__error" role="alert">{errorText}</p>
					{/if}
				{/if}
			</div>

			<footer class="editor-drawer__foot">
				<button type="button" class="editor-drawer__btn" onclick={close}>
					取消
				</button>
				<button
					type="button"
					class="editor-drawer__btn is-primary"
					onclick={() => void save()}
					disabled={!canSave}
				>
					{#if saving}
						<Loader2 class="editor-spin" size={14} aria-hidden="true" />
						{pendingPhoto ? "上传照片…" : "提交中…"}
					{:else}
						{isNew ? "创建相册" : isEdit ? "保存修改" : "添加照片"}
					{/if}
				</button>
			</footer>
		</aside>
	</div>
{/if}
