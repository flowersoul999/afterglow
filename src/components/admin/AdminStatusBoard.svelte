<script lang="ts">
/**
 * 后台 · 我的状态
 *
 * 一天一条记录，按日期倒序铺成时间轴。数据在**私有仓库**里（不进博客构建），
 * 所以这里保存完立刻可见 —— 不用等 Actions 那 1~3 分钟，提示语也就不能说
 * 「正在重新构建」。
 *
 * 三个刻意的设计：
 *
 * 1. **今天永远有一个空卡片。** 记录是「上传即建档」，如果今天还没拍，卡片
 *    也要在最上面，否则第一次记录的入口就藏起来了。
 * 2. **照片按天懒加载。** 列目录只返回文件名（日期），一天的 json 要单独读。
 *    一天一个请求，一年 365 个请求全发出去太浪费，所以卡片滚进视口才读。
 * 3. **上传严格串行。** GitHub 不支持对同一分支并发提交，第二张起必然 422。
 *    每传完一张就写一次 json —— 中途失败也只是少几张，不会留下「图传了、
 *    记录没了」的半残状态。
 */
import {
	GitCompare,
	ImagePlus,
	Loader2,
	RefreshCw,
	Trash2,
	X,
} from "lucide-svelte";
import { onMount } from "svelte";
import { editor } from "@/utils/editor/editor-store";
import { uploadStatusPhoto } from "@/utils/editor/image-upload";
import {
	deletePrivateFile,
	listPrivateDir,
	readPrivateFile,
	STATUS_ROOT,
	statusPhotoUrl,
	writePrivateFile,
} from "@/utils/editor/private-client";
import {
	dayKey,
	parseStatus,
	type StatusRecord,
	serializeStatus,
	statusDateFromName,
	statusFullPath,
	statusPath,
	thumbOf,
} from "@/utils/editor/status-serializer";

interface Props {
	/** 复用后台顶栏的 toast */
	onNotify?: (text: string) => void;
}

let { onNotify = () => {} }: Props = $props();

const today = dayKey();

/** 所有有记录的日期，倒序 */
let dates = $state<string[]>([]);
/** 日期 → 记录；null 表示读过、确认那天还没有文件 */
let records = $state<Record<string, StatusRecord | null>>({});
/** 日期 → 文件 sha，写回时必须带 */
let shas = $state<Record<string, string>>({});
let loadingDates = $state<Record<string, boolean>>({});
let uploading = $state<Record<string, boolean>>({});
let uploadProgress = $state<Record<string, string>>({});
let dayErrors = $state<Record<string, string>>({});

let listLoading = $state(true);
let listError = $state("");
let actionError = $state("");

/** 大图查看 */
let viewerSrc = $state("");
/** 对比弹层：两栏日期 */
let compareOpen = $state(false);
let compareDates = $state<string[]>(["", ""]);

let fileInput = $state<HTMLInputElement | null>(null);
let pendingDate = "";

/** 今天永远排第一，哪怕一张没拍 */
const displayDates = $derived(
	dates.includes(today) ? dates : [today, ...dates],
);

/** 对比弹层的下拉选项：把「今天」也带上，方便比昨天和今天 */
const compareOptions = $derived(
	dates.includes(today) ? dates : [today, ...dates],
);

function describe(error: unknown): string {
	return editor.describeError(error);
}

async function loadDay(date: string, force = false): Promise<void> {
	if (!date) return;
	if (!force && (date in records || loadingDates[date])) return;
	loadingDates[date] = true;
	try {
		const file = await readPrivateFile(statusPath(date));
		records[date] = file ? parseStatus(file.text, date) : null;
		if (file) shas[date] = file.sha;
		delete dayErrors[date];
	} catch (error) {
		dayErrors[date] = describe(error);
	} finally {
		delete loadingDates[date];
	}
}

/**
 * 卡片进入视口才读那一天的 json。
 * rootMargin 留 300px，滚到附近就开始读，翻页时不会看到一片空框。
 */
function reveal(node: HTMLElement, date: string) {
	const observer = new IntersectionObserver(
		(entries) => {
			if (entries.some((entry) => entry.isIntersecting)) {
				void loadDay(date);
				observer.disconnect();
			}
		},
		{ rootMargin: "300px" },
	);
	observer.observe(node);
	return { destroy: () => observer.disconnect() };
}

async function refresh(): Promise<void> {
	listLoading = true;
	listError = "";
	try {
		const entries = await listPrivateDir(STATUS_ROOT);
		dates = entries
			.map((entry) =>
				entry.type === "file" ? statusDateFromName(entry.name) : "",
			)
			.filter((date) => date !== "")
			.sort((left, right) => right.localeCompare(left));
		// 列表变了就丢掉缓存，避免和远端对不上
		records = {};
		shas = {};
		dayErrors = {};
	} catch (error) {
		listError = describe(error);
	} finally {
		listLoading = false;
	}
}

function pickFiles(date: string): void {
	if (uploading[date]) return;
	pendingDate = date;
	fileInput?.click();
}

function onFilesPicked(event: Event): void {
	const input = event.currentTarget as HTMLInputElement;
	const files = Array.from(input.files ?? []);
	input.value = "";
	if (files.length === 0 || !pendingDate) return;
	void addPhotos(pendingDate, files);
}

async function addPhotos(date: string, files: File[]): Promise<void> {
	if (uploading[date]) return;
	actionError = "";
	uploading[date] = true;

	try {
		// 没读过就先读一次拿 sha。文件不存在时 readPrivateFile 返回 null，
		// 这时 sha 为空 → 写 json 走「新建」分支
		if (!(date in shas)) await loadDay(date, true);
		if (dayErrors[date]) throw new Error(dayErrors[date]);

		const photos = [...(records[date]?.photos ?? [])];
		const extra = records[date]?.extra ?? {};

		for (const [index, file] of files.entries()) {
			uploadProgress[date] = `第 ${index + 1}/${files.length} 张：${file.name}`;
			const uploaded = await uploadStatusPhoto(file, date);
			photos.push(uploaded.src);

			// 每张落盘就写一次记录：中途断掉也不会出现「图在、json 没记上」
			const next: StatusRecord = { date, photos: [...photos], extra };
			const nextSha = await writePrivateFile({
				path: statusPath(date),
				text: serializeStatus(next),
				message: `feat(status): ${date} 记录照片`,
				sha: shas[date],
			});
			shas[date] = nextSha;
			records[date] = next;
		}

		if (!dates.includes(date)) {
			dates = [date, ...dates].sort((left, right) => right.localeCompare(left));
		}
		onNotify(`已存 ${files.length} 张 · 立刻生效`);
	} catch (error) {
		actionError = describe(error);
	} finally {
		delete uploading[date];
		delete uploadProgress[date];
	}
}

/**
 * 删一张照片：先从记录里摘掉，再尽力删仓库里的文件。
 *
 * 顺序不能反 —— 先删文件再写 json，万一写失败，记录里就会挂着一个指向
 * 404 的路径，页面上是裂图。反过来最坏只是个孤儿文件，无害。
 */
async function removePhoto(date: string, src: string): Promise<void> {
	const record = records[date];
	if (!record) return;
	actionError = "";
	const next: StatusRecord = {
		...record,
		photos: record.photos.filter((item) => item !== src),
	};
	try {
		shas[date] = await writePrivateFile({
			path: statusPath(date),
			text: serializeStatus(next),
			message: `chore(status): ${date} 删除一张照片`,
			sha: shas[date],
		});
		records[date] = next;
		void purgeFiles(date, src);
	} catch (error) {
		actionError = describe(error);
	}
}

/** 尽力删掉原图与缩略图；失败就算了，孤儿文件不影响记录 */
async function purgeFiles(date: string, src: string): Promise<void> {
	const folder = src.includes("/") ? src.slice(0, src.lastIndexOf("/")) : "";
	try {
		const entries = await listPrivateDir(
			folder ? `${STATUS_ROOT}/${folder}` : STATUS_ROOT,
		);
		for (const relative of [src, thumbOf(src)]) {
			const target = `${STATUS_ROOT}/${relative}`;
			const entry = entries.find((item) => item.path === target);
			if (!entry) continue;
			await deletePrivateFile({
				path: target,
				sha: entry.sha,
				message: `chore(status): 删除照片 ${date}`,
			});
		}
	} catch {
		// 孤儿文件无害，不打扰用户
	}
}

async function removeDay(date: string): Promise<void> {
	if (!window.confirm(`删除 ${date} 整天的记录？照片文件也会一并删掉。`)) {
		return;
	}
	actionError = "";
	try {
		const photos = records[date]?.photos ?? [];
		if (shas[date]) {
			await deletePrivateFile({
				path: statusPath(date),
				sha: shas[date],
				message: `chore(status): 删除 ${date} 记录`,
			});
		}
		for (const src of photos) await purgeFiles(date, src);
		dates = dates.filter((item) => item !== date);
		delete records[date];
		delete shas[date];
		delete dayErrors[date];
		onNotify(`已删除 ${date}`);
	} catch (error) {
		actionError = describe(error);
	}
}

function openCompare(): void {
	compareDates = [dates[1] ?? dates[0] ?? today, dates[0] ?? today];
	compareOpen = true;
	void loadDay(compareDates[0]);
	void loadDay(compareDates[1]);
}

function setCompare(index: number): void {
	void loadDay(compareDates[index] ?? "");
}

onMount(() => {
	void refresh();
});
</script>

<input
	bind:this={fileInput}
	type="file"
	accept="image/*"
	multiple
	hidden
	onchange={onFilesPicked}
/>

<div class="admin-status">
	<header class="admin-status__head">
		<div class="admin-status__title-row">
			<h2 class="admin-status__title">我的状态</h2>
			<span class="admin-status__count">{dates.length} 天</span>
		</div>

		<div class="admin-status__actions">
			<button
				type="button"
				class="admin-btn admin-btn--primary admin-btn--sm"
				disabled={Boolean(uploading[today])}
				onclick={() => pickFiles(today)}
			>
				{#if uploading[today]}
					<Loader2 size={13} class="spin" aria-hidden="true" />
					上传中…
				{:else}
					<ImagePlus size={13} aria-hidden="true" />
					记录今天
				{/if}
			</button>

			<button
				type="button"
				class="admin-btn admin-btn--sm"
				disabled={dates.length === 0}
				onclick={openCompare}
			>
				<GitCompare size={13} aria-hidden="true" />
				两日对比
			</button>

			<button
				type="button"
				class="admin-icon-btn"
				title="重新拉取"
				aria-label="重新拉取"
				disabled={listLoading}
				onclick={refresh}
			>
				<RefreshCw size={13} class={listLoading ? "spin" : ""} />
			</button>
		</div>
	</header>

	{#if actionError}
		<p class="admin-status__error" role="alert">{actionError}</p>
	{/if}

	<div class="admin-status__scroll">
		{#if listLoading && dates.length === 0}
			<p class="admin-list__state">
				<Loader2 size={14} class="spin" aria-hidden="true" /> 正在读取…
			</p>
		{:else if listError}
			<div class="admin-list__error" role="alert">
				<p>{listError}</p>
				<button type="button" class="admin-btn admin-btn--sm" onclick={refresh}>
					<RefreshCw size={13} aria-hidden="true" /> 重试
				</button>
			</div>
		{:else}
			{#each displayDates as date (date)}
				{@render dayCard(date)}
			{/each}

			{#if dates.length === 0}
				<p class="admin-status__hint">
					还没有任何记录。拍好今天的照片，点「记录今天」传上来，一年后往回翻
					就是一条能看出变化的时间线。
				</p>
			{/if}
		{/if}
	</div>
</div>

{#snippet dayCard(date: string)}
	{@const record = records[date]}
	{@const photos = record?.photos ?? []}
	<section
		class="status-day"
		class:is-today={date === today}
		use:reveal={date}
		ondragover={(event) => event.preventDefault()}
		ondrop={(event) => {
			event.preventDefault();
			if (uploading[date]) return;
			const files = Array.from(event.dataTransfer?.files ?? []).filter((file) =>
				file.type.startsWith("image/"),
			);
			if (files.length > 0) void addPhotos(date, files);
		}}
	>
		<header class="status-day__head">
			<time class="status-day__date" datetime={date}>{date}</time>
			{#if date === today}
				<span class="status-day__tag">今天</span>
			{/if}
			<span class="status-day__count">
				{#if loadingDates[date]}
					读取中…
				{:else}
					{photos.length} 张
				{/if}
			</span>

			<div class="status-day__actions">
				<button
					type="button"
					class="admin-btn admin-btn--sm"
					disabled={Boolean(uploading[date])}
					onclick={() => pickFiles(date)}
				>
					{#if uploading[date]}
						<Loader2 size={12} class="spin" aria-hidden="true" />
					{:else}
						<ImagePlus size={12} aria-hidden="true" />
					{/if}
					加照片
				</button>
				{#if photos.length > 0}
					<button
						type="button"
						class="admin-icon-btn is-danger"
						title="删除这天的记录"
						aria-label="删除这天的记录"
						onclick={() => removeDay(date)}
					>
						<Trash2 size={12} />
					</button>
				{/if}
			</div>
		</header>

		{#if dayErrors[date]}
			<p class="status-day__error">{dayErrors[date]}</p>
		{:else if uploadProgress[date]}
			<p class="status-day__progress">
				<Loader2 size={12} class="spin" aria-hidden="true" />
				{uploadProgress[date]}
			</p>
		{/if}

		<div class="status-day__grid">
			{#each photos as src (src)}
				<figure class="status-photo">
					<button
						type="button"
						class="status-photo__open"
						onclick={() => (viewerSrc = src)}
						aria-label="看大图"
					>
						<img
							src={statusPhotoUrl(statusFullPath(thumbOf(src)))}
							alt={`${date} 的照片`}
							loading="lazy"
							decoding="async"
						/>
					</button>
					<button
						type="button"
						class="status-photo__remove"
						title="删掉这张"
						aria-label="删掉这张"
						onclick={() => removePhoto(date, src)}
					>
						<X size={11} />
					</button>
				</figure>
			{/each}

			{#if photos.length === 0 && !loadingDates[date]}
				<button
					type="button"
					class="status-empty"
					onclick={() => pickFiles(date)}
					disabled={Boolean(uploading[date])}
				>
					<ImagePlus size={16} aria-hidden="true" />
					<span>{date === today ? "拍一组传上来" : "这天没留照片"}</span>
				</button>
			{/if}
		</div>
	</section>
{/snippet}

{#if viewerSrc}
	<div
		class="status-viewer"
		role="dialog"
		aria-modal="true"
		aria-label="照片大图"
		onclick={() => (viewerSrc = "")}
		onkeydown={(event) => event.key === "Escape" && (viewerSrc = "")}
	>
		<img src={statusPhotoUrl(statusFullPath(viewerSrc))} alt="照片大图" />
		<button
			type="button"
			class="status-viewer__close"
			aria-label="关闭"
			onclick={() => (viewerSrc = "")}
		>
			<X size={18} />
		</button>
	</div>
{/if}

{#if compareOpen}
	<div class="status-compare" role="dialog" aria-modal="true" aria-label="两日对比">
		<div class="status-compare__panel">
			<header class="status-compare__head">
				<h3>两日对比</h3>
				<button
					type="button"
					class="admin-icon-btn"
					aria-label="关闭"
					onclick={() => (compareOpen = false)}
				>
					<X size={14} />
				</button>
			</header>

			<div class="status-compare__body">
				{#each [0, 1] as index (index)}
					{@const date = compareDates[index] ?? ""}
					<div class="status-compare__side">
						<select
							class="status-compare__select"
							bind:value={compareDates[index]}
							onchange={() => setCompare(index)}
						>
							{#each compareOptions as option (option)}
								<option value={option}>{option}</option>
							{/each}
						</select>

						<div class="status-compare__photos">
							{#each records[date]?.photos ?? [] as src (src)}
								<img
									src={statusPhotoUrl(statusFullPath(src))}
									alt={`${date} 的照片`}
									loading="lazy"
								/>
							{:else}
								<p class="status-compare__empty">
									{loadingDates[date] ? "读取中…" : "这天没有照片"}
								</p>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		</div>
	</div>
{/if}
