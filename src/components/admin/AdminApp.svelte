<script lang="ts">
/**
 * 站内后台（/admin）
 *
 * 三栏：集合 → 条目 → 编辑。所有数据都走 Cloudflare Worker 代理的 GitHub
 * Contents API，没有第二套存储 —— 保存就是给仓库提交一次 commit，所以
 * 「提交 ≠ 上线」这条得一直摆在界面上。
 *
 * 这个组件只在 /admin 路由里挂载，不在 Swup 容器内，所以进页面时自己
 * bootstrap 一次登录态（正常页面是 EditorRoot 干的活）。
 */
import { Github, Loader2, RefreshCw } from "lucide-svelte";
import { onMount } from "svelte";
import AdminEditor from "@/components/admin/AdminEditor.svelte";
import AdminList from "@/components/admin/AdminList.svelte";
import { adminCollections, findCollection } from "@/config/admin-collections";
import {
	type AdminEntry,
	buildPath,
	listEntries,
	loadEntry,
	removeEntry,
	saveEntry,
} from "@/utils/editor/content-repo";
import {
	type ContentDoc,
	createDocument,
	nowStamp,
	readField,
	writeField,
} from "@/utils/editor/content-serializer";
import { editor } from "@/utils/editor/editor-store";
import "@/styles/pages/admin.css";

let collectionId = $state(adminCollections[0].id);
const collection = $derived(findCollection(collectionId));

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
/** 新建时的分类（目录名），保存时决定文件落在哪 */
let draftCategory = $state("");

let toast = $state("");
let toastTimer: ReturnType<typeof setTimeout> | null = null;
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
	if (toastTimer) clearTimeout(toastTimer);
	toastTimer = setTimeout(() => {
		toast = "";
	}, 3200);
}

async function refreshList(force = false): Promise<void> {
	if (!$editor.isEditor) return;
	listLoading = true;
	listError = "";
	try {
		entries = await listEntries(collection, editor.branch, { force });
	} catch (error) {
		listError = editor.describeError(error);
	} finally {
		listLoading = false;
	}
}

async function openEntry(path: string): Promise<void> {
	if (path === selectedPath && !isNew) return;
	selectedPath = path;
	isNew = false;
	docLoading = true;
	docError = "";
	doc = null;
	try {
		const loaded = await loadEntry(path, editor.branch);
		if (!loaded) {
			docError = "文件读不到了，可能刚被删掉或改名";
			return;
		}
		doc = loaded.doc;
		sha = loaded.sha;
	} catch (error) {
		docError = editor.describeError(error);
	} finally {
		docLoading = false;
	}
}

function startCreate(): void {
	isNew = true;
	selectedPath = "";
	sha = "";
	docError = "";
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
	selectedPath = "";
	isNew = false;
	doc = null;
	sha = "";
	docError = "";
}

async function handleSave(): Promise<void> {
	if (!doc || saving) return;
	saving = true;
	docError = "";

	const titleValue = readField(doc, "title");
	const title =
		(typeof titleValue === "string" && titleValue.trim()) || "未命名";
	const dateValue = readField(doc, collection.dateField);
	const stamp =
		typeof dateValue === "string" && dateValue
			? dateValue
			: nowStamp(!collection.dateOnly);

	const path = isNew
		? buildPath(collection, { title, date: stamp, category: draftCategory })
		: selectedPath;

	try {
		const finalPath = await saveEntry({
			collection,
			path,
			doc,
			sha,
			isNew,
			branch: editor.branch,
			label: title,
		});
		notify("已提交，正在重新构建，1~3 分钟后生效");
		await refreshList(true);
		// 新建后重新打开刚提交的文件：必须拿到它真实的 sha，
		// 否则接着改第二次会被 GitHub 当成「新建」而报 422
		if (isNew) {
			isNew = false;
			selectedPath = "";
			await openEntry(finalPath);
		}
	} catch (error) {
		docError = editor.describeError(error);
	} finally {
		saving = false;
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
		docError = editor.describeError(error);
	} finally {
		saving = false;
	}
}

function switchCollection(id: string): void {
	if (id === collectionId) return;
	collectionId = id;
	query = "";
	closeEditor();
	entries = [];
	void refreshList();
}

onMount(() => {
	void editor.bootstrap();
	return () => {
		if (toastTimer) clearTimeout(toastTimer);
	};
});

// bootstrap 是异步的，等登录态落定再拉列表；$effect 比轮询干净
$effect(() => {
	if (!authed || listBooted) return;
	listBooted = true;
	void refreshList();
});
</script>

<div class="admin">
	<header class="admin__top">
		<div class="admin__brand">
			<span class="admin__brand-mark">✦</span>
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
					title="重新拉取列表"
					aria-label="重新拉取列表"
					onclick={() => refreshList(true)}
					disabled={listLoading}
				>
					<RefreshCw size={13} class={listLoading ? "spin" : ""} />
				</button>
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
		<div class="admin__body">
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

			<AdminList
				{collection}
				entries={filtered}
				loading={listLoading}
				error={listError}
				selectedPath={selectedPath}
				bind:query
				onSelect={openEntry}
				onCreate={startCreate}
			/>

			{#if docLoading}
				<main class="admin__editor admin__editor--state">
					<span class="admin__state"><Loader2 size={16} class="spin" /> 正在读取…</span>
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
					onSave={handleSave}
					onDelete={handleDelete}
					onClose={closeEditor}
				/>
			{:else}
				<main class="admin__editor admin__editor--state">
					{#if docError}
						<span class="admin__state is-error">{docError}</span>
					{:else}
						<div class="admin__empty">
							<span class="admin__empty-mark">✦</span>
							<p>左边选一条，或者新建一篇</p>
							<code>{collection.dir}</code>
						</div>
					{/if}
				</main>
			{/if}
		</div>
	{/if}

	{#if toast}
		<div class="admin__toast" role="status" aria-live="polite">{toast}</div>
	{/if}
</div>
