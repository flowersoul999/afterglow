<script lang="ts">
/**
 * 站内后台（/admin）
 *
 * 三栏：集合 → 条目 → 编辑。所有数据都走 Cloudflare Worker 代理的 GitHub
 * Contents API，没有第二套存储 —— 「存入草稿箱」只把内容攒进本地队列，
 * 「提交全部」才合成一次 commit，所以「提交 ≠ 上线」这条得一直摆在界面上。
 *
 * 边界：删除仍然立即提交（见 handleDelete），不进队列 —— 一次删多篇的需求
 * 还没出现，先保持「点了就删」的直觉，别和草稿箱的语义混在一起。
 *
 * 这个组件只在 /admin 路由里挂载，不在 Swup 容器内，所以进页面时自己
 * bootstrap 一次登录态（正常页面是 EditorRoot 干的活）。
 */
import {
	ArrowLeft,
	BarChart3,
	ExternalLink,
	Files,
	Github,
	Loader2,
	Moon,
	RefreshCw,
	Sun,
} from "lucide-svelte";
import { onMount } from "svelte";
import AdminBatchQueue from "@/components/admin/AdminBatchQueue.svelte";
import AdminEditor from "@/components/admin/AdminEditor.svelte";
import AdminList from "@/components/admin/AdminList.svelte";
import AdminMascot from "@/components/admin/AdminMascot.svelte";
import AdminStarfield from "@/components/admin/AdminStarfield.svelte";
import AdminStatusBoard from "@/components/admin/AdminStatusBoard.svelte";
import { adminCollections, findCollection } from "@/config/admin-collections";
import {
	BATCH_QUEUE_STORAGE_KEY,
	createQueuedDraftId,
	parseQueuedDrafts,
	type QueuedDraft,
	upsertQueuedDraft,
} from "@/utils/editor/batch-queue";
import {
	type AdminEntry,
	buildPath,
	invalidateEntries,
	listEntries,
	loadEntry,
	removeEntry,
} from "@/utils/editor/content-repo";
import {
	type ContentDoc,
	createDocument,
	nowStamp,
	parseContent,
	readField,
	serializeContent,
	writeField,
} from "@/utils/editor/content-serializer";
import { editor } from "@/utils/editor/editor-store";
import { EditorApiError, writeBatch } from "@/utils/editor/github-client";
import "@/styles/pages/admin.css";

let collectionId = $state(adminCollections[0].id);
const collection = $derived(findCollection(collectionId));
/** 私有集合（目前只有「状态」）走自己的面板，不读 src/content */
const isPrivateBoard = $derived(collection.privateBoard === true);

let entries = $state<AdminEntry[]>([]);
let listLoading = $state(false);
let listError = $state("");
let query = $state("");

let selectedPath = $state("");
let isNew = $state(false);
let doc = $state<ContentDoc | null>(null);
let sha = $state("");
let docLoading = $state(false);
let docError = $state("");
let saving = $state(false);
let queuedDrafts = $state<QueuedDraft[]>([]);
let editingQueueId = $state("");
let queueOpen = $state(false);
let batchSubmitting = $state(false);
let batchError = $state("");
let listRequestSeq = 0;
let entryRequestSeq = 0;
/** 新建时的分类（目录名），保存时决定文件落在哪 */
let draftCategory = $state("");
let mobileListMode = $state(true);

let toast = $state("");
let toastTimer: ReturnType<typeof setTimeout> | null = null;
let confettiOn = $state(false);
let confettiKey = $state(0);
let confettiTimer: ReturnType<typeof setTimeout> | null = null;
/** 白天晴空 / 深空星尘，选择存 localStorage，默认白天 */
const ADMIN_THEME_KEY = "admin-theme";
type AdminTheme = "day" | "night";
let adminTheme = $state<AdminTheme>("day");

function toggleTheme(): void {
	adminTheme = adminTheme === "day" ? "night" : "day";
	try {
		localStorage.setItem(ADMIN_THEME_KEY, adminTheme);
	} catch {
		// 隐私模式下 localStorage 不可写，本次切换仍然生效
	}
}

/** 撒花纸片：径向散开、四种主题色轮换，纯 CSS 动画不引第三方库 */
const CONFETTI = Array.from({ length: 14 }, (_, index) => {
	const angle = (index / 14) * Math.PI * 2;
	const distance = 68 + (index % 3) * 24;
	const palette = [
		"oklch(0.82 0.145 88)",
		"oklch(0.68 0.2 300)",
		"oklch(0.75 0.13 210)",
		"oklch(0.78 0.15 5)",
	];
	return {
		color: palette[index % palette.length],
		delay: `${(index % 4) * 35}ms`,
		x: `${(Math.cos(angle) * distance).toFixed(0)}px`,
		y: `${(Math.sin(angle) * distance - 26).toFixed(0)}px`,
		rotate: `${(index % 2 ? -1 : 1) * (180 + index * 27)}deg`,
	};
});
/** 首次确认登录后自动拉一次列表，之后靠手动刷新 / 保存后失效缓存 */
let listBooted = false;

const authed = $derived($editor.isEditor);
const checking = $derived($editor.status === "checking");

const filtered = $derived.by(() => {
	const keyword = query.trim().toLowerCase();
	if (!keyword) return entries;
	return entries.filter(
		(entry) =>
			entry.display.toLowerCase().includes(keyword) ||
			entry.category.toLowerCase().includes(keyword),
	);
});

function notify(text: string): void {
	toast = text;
	confettiKey += 1;
	confettiOn = true;
	if (confettiTimer) clearTimeout(confettiTimer);
	confettiTimer = setTimeout(() => {
		confettiOn = false;
	}, 1150);
	if (toastTimer) clearTimeout(toastTimer);
	toastTimer = setTimeout(() => {
		toast = "";
	}, 3200);
}

function persistQueue(next: QueuedDraft[]): void {
	queuedDrafts = next;
	try {
		if (next.length === 0) {
			localStorage.removeItem(BATCH_QUEUE_STORAGE_KEY);
			return;
		}
		localStorage.setItem(BATCH_QUEUE_STORAGE_KEY, JSON.stringify(next));
	} catch {
		// 隐私模式 / 配额满：内存里的队列还能用，只是刷新后会丢
	}
}

/**
 * 统一收口接口错误。
 *
 * 401 单独处理：它代表 Cookie 里的 GitHub token 已经失效，而不是「这条请求
 * 恰好失败」。只把文案塞进列表错误框的话，界面会一直停在「已登录」的外壳里，
 * 点「重试」永远拿到同一个 401 —— 必须把登录态整体作废、切回登录门，
 * 用户才有「重新登录」这条出路（2026-11-26 站长报障）。
 */
async function handleApiError(
	error: unknown,
	apply: (message: string) => void,
): Promise<void> {
	if (error instanceof EditorApiError && error.status === 401) {
		await editor.expireSession();
		return;
	}
	apply(editor.describeError(error));
}

async function refreshList(force = false): Promise<void> {
	if (!$editor.isEditor) return;
	// 「状态」的数据在私有仓库里，列表由 AdminStatusBoard 自己拉 ——
	// 走这条公开仓库的列目录通道只会拿到 403。
	if (collection.privateBoard) return;
	const requestSeq = ++listRequestSeq;
	const targetCollection = collection;
	listLoading = true;
	listError = "";
	try {
		const result = await listEntries(targetCollection, editor.branch, {
			force,
		});
		if (requestSeq === listRequestSeq) entries = result;
	} catch (error) {
		if (requestSeq === listRequestSeq) {
			await handleApiError(error, (message) => {
				listError = message;
			});
		}
	} finally {
		if (requestSeq === listRequestSeq) listLoading = false;
	}
}

async function openEntry(path: string): Promise<void> {
	mobileListMode = false;
	if (path === selectedPath && !isNew) return;
	const requestSeq = ++entryRequestSeq;
	selectedPath = path;
	isNew = false;
	// 从列表打开的条目和队列里的草稿不是同一条，别让旧 id 影响入队替换
	editingQueueId = "";
	docLoading = true;
	docError = "";
	doc = null;
	try {
		const loaded = await loadEntry(path, editor.branch);
		if (requestSeq !== entryRequestSeq) return;
		if (!loaded) {
			docError = "文件读不到了，可能刚被删掉或改名";
			return;
		}
		doc = loaded.doc;
		sha = loaded.sha;
	} catch (error) {
		if (requestSeq === entryRequestSeq) {
			await handleApiError(error, (message) => {
				docError = message;
			});
		}
	} finally {
		if (requestSeq === entryRequestSeq) docLoading = false;
	}
}

function startCreate(): void {
	entryRequestSeq += 1;
	mobileListMode = false;
	isNew = true;
	selectedPath = "";
	sha = "";
	docError = "";
	editingQueueId = "";
	draftCategory = collection.defaultCategory ?? "";

	const draft = createDocument();
	const stamp = nowStamp(!collection.dateOnly);

	// 所有字段都先建好 entry，顺序就是配置表里的顺序；
	// 空值在序列化时会被跳过，所以不会凭空多出 `description: ""`
	for (const field of collection.fields) {
		if (field.key === collection.dateField) {
			writeField(draft, field.key, stamp);
			continue;
		}
		if (field.type === "switch") {
			writeField(draft, field.key, Boolean(field.initial));
			continue;
		}
		if (field.type === "tags") {
			writeField(draft, field.key, []);
			continue;
		}
		writeField(
			draft,
			field.key,
			field.initial !== undefined ? String(field.initial) : "",
		);
	}

	doc = draft;
}

function closeEditor(): void {
	entryRequestSeq += 1;
	mobileListMode = true;
	selectedPath = "";
	docLoading = false;
	isNew = false;
	doc = null;
	sha = "";
	docError = "";
	editingQueueId = "";
}

function currentDraftMeta(): {
	title: string;
	stamp: string;
	path: string;
} | null {
	if (!doc) return null;
	const titleValue = readField(doc, "title");
	const title =
		(typeof titleValue === "string" && titleValue.trim()) || "未命名";
	const dateValue = readField(doc, collection.dateField);
	const stamp =
		typeof dateValue === "string" && dateValue
			? dateValue
			: nowStamp(!collection.dateOnly);
	return {
		title,
		stamp,
		path: buildPath(collection, {
			title,
			date: stamp,
			category: draftCategory,
		}),
	};
}

/**
 * 把当前编辑中的内容存进草稿箱。
 *
 * 纯本地动作：不发请求、不刷新列表。「存草稿」的频率很高，每次都打一轮
 * GitHub 既慢又容易撞冲突，真正的写入统一留给「提交全部」。
 */
function enqueueCurrentDraft(mode: "create" | "update"): void {
	if (!doc) return;
	docError = "";
	const meta = currentDraftMeta();
	if (!meta) return;

	const path = mode === "update" ? selectedPath : meta.path;
	if (!path) return;

	try {
		const next = upsertQueuedDraft(queuedDrafts, {
			id: editingQueueId || createQueuedDraftId(),
			collectionId: collection.id,
			collectionLabel: collection.label,
			title: meta.title,
			category: draftCategory,
			path,
			text: serializeContent(doc),
			mode,
		});
		persistQueue(next);
		notify(`已存入草稿箱，共 ${next.length} 条，去右上角「待提交」一键提交`);
		// 新建存完继续开一张空白草稿；更新留在原文上，方便接着改
		if (mode === "create") startCreate();
	} catch (error) {
		docError = error instanceof Error ? error.message : "存入草稿箱失败";
	}
}

/** 编辑已有条目：覆盖同样路径，不能再走「新建撞名加后缀」那条路 */
function handleSave(): void {
	if (saving) return;
	enqueueCurrentDraft("update");
}

/** 新建条目：路径由标题和日期算出来 */
function handleQueue(): void {
	if (!isNew || saving) return;
	enqueueCurrentDraft("create");
}

function editQueuedDraft(item: QueuedDraft): void {
	const target = findCollection(item.collectionId);
	if (collectionId !== target.id) {
		listRequestSeq += 1;
		collectionId = target.id;
		query = "";
		entries = [];
		void refreshList();
	}
	entryRequestSeq += 1;
	mobileListMode = false;
	// 更新类草稿要回到「编辑已有条目」的形态：路径固定成草稿里的 path，
	// 再存一次才不会被当成新建而换到另一个文件名
	isNew = item.mode === "create";
	selectedPath = isNew ? "" : item.path;
	sha = "";
	docError = "";
	draftCategory = item.category;
	editingQueueId = item.id;
	doc = parseContent(item.text);
	queueOpen = false;
}

function removeQueuedDraft(id: string): void {
	persistQueue(queuedDrafts.filter((item) => item.id !== id));
	if (editingQueueId === id) editingQueueId = "";
}

function clearQueuedDrafts(): void {
	persistQueue([]);
	editingQueueId = "";
	batchError = "";
}

async function submitQueuedDrafts(): Promise<void> {
	if (queuedDrafts.length === 0 || batchSubmitting) return;
	batchSubmitting = true;
	batchError = "";
	const total = queuedDrafts.length;
	const created = queuedDrafts.filter((item) => item.mode === "create").length;
	const updated = total - created;
	// 提交信息按真实内容生成：一眼能看出这批是新建多还是改得多
	const detail = [
		created > 0 ? `新建 ${created}` : "",
		updated > 0 ? `更新 ${updated}` : "",
	]
		.filter(Boolean)
		.join(" / ");
	try {
		await writeBatch({
			branch: editor.branch,
			message: `chore(content): 批量提交 ${total} 条内容（${detail}）`,
			items: queuedDrafts.map((item) => ({
				path: item.path,
				text: item.text,
				collectionId: item.collectionId,
				label: item.title,
				mode: item.mode,
			})),
		});
		for (const collectionId of new Set(
			queuedDrafts.map((item) => item.collectionId),
		)) {
			invalidateEntries(collectionId);
		}
		clearQueuedDrafts();
		queueOpen = false;
		closeEditor();
		await refreshList(true);
		notify(`已提交 ${total} 条，正在重新构建，1~3 分钟后生效`);
	} catch (error) {
		// 失败时保留队列：内容是站长攒了很久才攒出来的，不能因为一次网络错误清空
		await handleApiError(error, (message) => {
			batchError = message;
		});
	} finally {
		batchSubmitting = false;
	}
}

async function handleDelete(): Promise<void> {
	if (!doc || !selectedPath || saving) return;
	saving = true;
	docError = "";
	try {
		await removeEntry({
			collection,
			path: selectedPath,
			sha,
			branch: editor.branch,
			label: selectedPath.split("/").pop() ?? selectedPath,
		});
		notify("已提交删除，1~3 分钟后生效");
		closeEditor();
		await refreshList(true);
	} catch (error) {
		await handleApiError(error, (message) => {
			docError = message;
		});
	} finally {
		saving = false;
	}
}

function switchCollection(id: string): void {
	if (id === collectionId) return;
	listRequestSeq += 1;
	mobileListMode = true;
	collectionId = id;
	query = "";
	closeEditor();
	entries = [];
	void refreshList();
}

onMount(() => {
	try {
		const saved = localStorage.getItem(ADMIN_THEME_KEY);
		if (saved === "day" || saved === "night") adminTheme = saved;
	} catch {
		// 读不到就用默认白天
	}

	// 队列早期存在 sessionStorage；搬进 localStorage 后清掉旧键，避免关页即丢
	let raw: string | null = null;
	try {
		raw = localStorage.getItem(BATCH_QUEUE_STORAGE_KEY);
		if (!raw) {
			const legacy = sessionStorage.getItem(BATCH_QUEUE_STORAGE_KEY);
			if (legacy) {
				raw = legacy;
				localStorage.setItem(BATCH_QUEUE_STORAGE_KEY, legacy);
			}
		}
		sessionStorage.removeItem(BATCH_QUEUE_STORAGE_KEY);
	} catch {
		// 存储不可用时队列只活在内存里
	}
	queuedDrafts = parseQueuedDrafts(raw);

	void editor.bootstrap();
	return () => {
		if (toastTimer) clearTimeout(toastTimer);
		if (confettiTimer) clearTimeout(confettiTimer);
	};
});

// bootstrap 是异步的，等登录态落定再拉列表；$effect 比轮询干净
$effect(() => {
	if (!authed || listBooted) return;
	listBooted = true;
	void refreshList();
});
</script>

<div class="admin" data-admin-theme={adminTheme}>
	<AdminStarfield theme={adminTheme} />
	<header class="admin__top">
		<div class="admin__brand">
			<span class="admin__brand-mark" aria-hidden="true">
				<svg viewBox="0 0 24 24" fill="currentColor">
					<path d="M12 1.6l2.1 6.5 6.8.1-5.5 4 2.1 6.5-5.5-4-5.5 4 2.1-6.5-5.5-4 6.8-.1z"></path>
				</svg>
			</span>
			<span class="admin__brand-name">JOJOSTAR</span>
			<span class="admin__brand-tag">后台</span>
		</div>

		<nav class="admin__crumbs">
			<span>内容</span>
			<span class="admin__crumb-sep">/</span>
			<b>{collection.label}</b>
			{#if doc && (isNew || selectedPath)}
				<span class="admin__crumb-sep">/</span>
				<span class="admin__crumb-item"
					>{isNew ? "新建" : selectedPath.split("/").pop()}</span
				>
			{/if}
		</nav>

		<div class="admin__top-right">
			{#if authed}
				<button
					type="button"
					class="admin-icon-btn"
					title={adminTheme === "day" ? "切换到深空夜色" : "切换到晴空白天"}
					aria-label={adminTheme === "day" ? "切换到深空夜色" : "切换到晴空白天"}
					onclick={toggleTheme}
				>
					{#if adminTheme === "day"}
						<Moon size={13} />
					{:else}
						<Sun size={13} />
					{/if}
				</button>
				<button
					type="button"
					class="admin-icon-btn"
					title="重新拉取列表"
					aria-label="重新拉取列表"
					onclick={() => refreshList(true)}
					disabled={listLoading}
				>
					<RefreshCw size={13} class={listLoading ? "spin" : ""} />
				</button>
				<button
					type="button"
					class="admin-btn admin__batch-trigger"
					class:is-active={queuedDrafts.length > 0}
					aria-label={`打开待提交队列，共 ${queuedDrafts.length} 条`}
					onclick={() => {
						batchError = "";
						queueOpen = true;
					}}
				>
					<Files size={14} aria-hidden="true" />
					<span>待提交</span>
					<b aria-live="polite">{queuedDrafts.length}</b>
				</button>
				<a
					class="admin-btn admin__umami-link"
					href="https://cloud.umami.is/"
					target="_blank"
					rel="noopener noreferrer"
					title="打开 Umami 统计控制台"
					aria-label="打开 Umami 统计控制台"
				>
					<BarChart3 size={14} />
					<span>Umami 统计</span>
					<ExternalLink size={12} class="admin__umami-external" />
				</a>
				<span class="admin__user">
					<span class="admin__avatar"
						>{($editor.identity?.name || "jo").slice(0, 2)}</span
					>
					{$editor.identity?.name || $editor.identity?.login || "站长"}
				</span>
			{/if}
			<a class="admin-btn" href="/" data-no-swup>回到站点</a>
		</div>
	</header>

	{#if !authed}
		<div class="admin__gate">
			<div class="admin__gate-card">
				<span class="admin__gate-icon"><Github size={22} /></span>
				<h1>这里是站长后台</h1>
				<p>
					内容都存在 GitHub 仓库里，登录之后才能读写。<br />
					非站长账号授权进来也会被服务端挡回去。
				</p>
				{#if $editor.error}
					<p class="admin__gate-error">{$editor.error}</p>
				{/if}
				<button
					type="button"
					class="admin-btn admin-btn--primary admin__gate-btn"
					disabled={checking}
					onclick={() => editor.startLogin()}
				>
					{#if checking}
						<Loader2 size={14} class="spin" />
						正在检查登录服务…
					{:else}
						<Github size={14} />
						使用 GitHub 登录
					{/if}
				</button>
				<p class="admin__gate-hint">
					本地 <code>pnpm dev</code> 跑不起 Worker，登录只能在线上或用
					<span class="admin__code">.workbuddy/preview/test-worker.mjs</span> 验证接口。
				</p>
			</div>
		</div>
	{:else}
		<div
			class="admin__body"
			class:admin__body--editing={!mobileListMode}
			class:admin__body--board={isPrivateBoard}
		>
			<aside class="admin__collections">
				<div class="admin__group-label">内容</div>
				{#each adminCollections as item (item.id)}
					<button
						type="button"
						class="admin__collection"
						class:is-active={item.id === collectionId}
						onclick={() => switchCollection(item.id)}
					>
						<span class="admin__collection-icon">{item.icon}</span>
						<span class="admin__collection-label">{item.label}</span>
					</button>
				{/each}
			</aside>

			{#if isPrivateBoard}
				<!-- 状态：横跨列表与编辑两栏，自己管时间轴、上传与对比 -->
				<AdminStatusBoard onNotify={notify} />
			{:else}
				<AdminList
					{collection}
					entries={filtered}
					loading={listLoading}
					error={listError}
					selectedPath={selectedPath}
					bind:query
					onSelect={openEntry}
					onCreate={startCreate}
					onRetry={() => refreshList(true)}
				/>

				{#if docLoading}
					<main class="admin__editor admin__editor--state">
						<span class="admin__state"
							><Loader2 size={16} class="spin" /> 正在读取…</span
						>
					</main>
				{:else if doc}
					<AdminEditor
						{collection}
						{doc}
						{isNew}
						path={selectedPath}
						error={docError}
						saving={saving}
						bind:category={draftCategory}
						onSave={isNew ? handleQueue : handleSave}
						onDelete={handleDelete}
						onClose={closeEditor}
						onMobileBack={() => (mobileListMode = true)}
					/>
				{:else}
					<main class="admin__editor admin__editor--state">
						{#if docError}
							<button
								type="button"
								class="admin-editor__mobile-back"
								onclick={() => (mobileListMode = true)}
								aria-label="返回内容列表"
							>
								<ArrowLeft size={16} aria-hidden="true" />
							</button>
						{/if}
						{#if docError}
							<span class="admin__state is-error">{docError}</span>
						{:else}
						<div class="admin__empty">
							<AdminMascot />
							<p>左边选一条，或者新建一篇</p>
							<code>{collection.dir}</code>
						</div>
						{/if}
					</main>
				{/if}
			{/if}
		</div>
	{/if}

	{#if confettiOn}
		{#key confettiKey}
			<div class="admin__confetti" aria-hidden="true">
				{#each CONFETTI as piece}
					<i
						style:--c={piece.color}
						style:--d={piece.delay}
						style:--x={piece.x}
						style:--y={piece.y}
						style:--r={piece.rotate}
					></i>
				{/each}
			</div>
		{/key}
	{/if}

	{#if toast}
		<div class="admin__toast" role="status" aria-live="polite">{toast}</div>
	{/if}

	<AdminBatchQueue
		open={queueOpen}
		items={queuedDrafts}
		submitting={batchSubmitting}
		error={batchError}
		onClose={() => (queueOpen = false)}
		onEdit={editQueuedDraft}
		onRemove={removeQueuedDraft}
		onClear={clearQueuedDrafts}
		onSubmit={submitQueuedDrafts}
	/>
</div>
