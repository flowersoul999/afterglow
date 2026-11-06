<script lang="ts">
/**
 * 说说编辑抽屉
 *
 * 新建和编辑共用一套表单，靠 editorUi.momentMode 区分：
 * - create：空白草稿，提交时不带 sha；同一天已有文件会返回 422，自动加 -2、-3 重试
 * - edit：先读源文件拿 sha（更新必须带），提交时带回去，避免覆盖别人的改动
 *
 * 提交成功不等于上线：文件 push 上去之后 GitHub Actions 还要重新构建，完成后才可见。
 * 所以提示语写「已提交」而不是「已发布」，别让人以为立刻生效。
 */
import { ImagePlus, Plus, Trash2, X } from "lucide-svelte";
import { editor } from "@/utils/editor/editor-store";
import { editorUi } from "@/utils/editor/editor-ui";
import {
	deleteFile,
	EditorApiError,
	readFile,
	writeFile,
} from "@/utils/editor/github-client";
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

let draft: MomentDraft | null = $state(null);
let sha: string = $state("");
let loading: boolean = $state(false);
let saving: boolean = $state(false);
let removing: boolean = $state(false);
let errorText: string = $state("");
let confirmDelete: boolean = $state(false);
let tagInput: string = $state("");
let loadSeq = 0;
let confirmTimer: ReturnType<typeof setTimeout> | null = null;

const isEdit = $derived($editorUi.momentMode === "edit");

function dateFromPublished(value: string): Date {
	const matched = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
	if (!matched) return new Date();
	return new Date(
		Number(matched[1]),
		Number(matched[2]) - 1,
		Number(matched[3]),
	);
}

async function load(mode: string, id: string): Promise<void> {
	loadSeq += 1;
	const seq = loadSeq;
	errorText = "";
	sha = "";
	confirmDelete = false;
	tagInput = "";

	if (mode === "create") {
		draft = createEmptyDraft();
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
		draft = parseMomentFile(file.text, id);
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
	if (!$editor.isEditor) {
		editorUi.closeMoment();
		editorUi.openLogin("登录之后才能编辑说说");
		return;
	}
	void load(mode, id);
});

function close(): void {
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

function addTag(): void {
	const value = tagInput.trim().replace(/^#/, "");
	if (!draft || !value) return;
	if (!draft.tags.includes(value)) draft.tags = [...draft.tags, value];
	tagInput = "";
}

function removeTag(index: number): void {
	if (!draft) return;
	draft.tags = draft.tags.filter((_, i) => i !== index);
}

async function save(): Promise<void> {
	if (!draft || saving) return;
	if (!draft.body.trim()) {
		errorText = "内容不能为空";
		return;
	}

	saving = true;
	errorText = "";
	const text = serializeMoment(draft);

	try {
		if (isEdit) {
			await writeFile({
				path: momentPath(draft.id),
				text,
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
						text,
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

		<aside class="editor-drawer" role="dialog" aria-modal="true" aria-label={isEdit ? "编辑说说" : "新建说说"}>
			<header class="editor-drawer__head">
				<div>
					<strong>{isEdit ? "编辑说说" : "新建说说"}</strong>
					{#if draft}
						<span class="editor-drawer__path">{draft.id}.md</span>
					{/if}
				</div>
				<button type="button" class="editor-drawer__close" onclick={close} aria-label="关闭">
					<X size={17} aria-hidden="true" />
				</button>
			</header>

			<div class="editor-drawer__body">
				{#if loading}
					<p class="editor-drawer__state">正在读取源文件…</p>
				{:else if errorText && !draft}
					<p class="editor-drawer__state is-error">{errorText}</p>
				{:else if draft}
					<label class="editor-drawer__label" for="moment-body">正文</label>
					<textarea
						id="moment-body"
						class="editor-drawer__textarea"
						bind:value={draft.body}
						placeholder="此刻在想什么… 支持 Markdown，图片用 ![](url)"
						spellcheck="false"
					></textarea>

					<label class="editor-drawer__label" for="moment-title">标题（可空）</label>
					<input
						id="moment-title"
						class="editor-drawer__input"
						bind:value={draft.title}
						placeholder="留空就只显示正文"
					/>

					<div class="editor-drawer__row">
						<div class="editor-drawer__col">
							<label class="editor-drawer__label" for="moment-published">发布时间</label>
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
							<label class="editor-drawer__label" for="moment-location">地点（可空）</label>
							<input
								id="moment-location"
								class="editor-drawer__input"
								bind:value={draft.location}
								placeholder="比如 杭州"
							/>
						</div>
					</div>

					<label class="editor-drawer__label" for="moment-tags">
						标签
						<span class="editor-drawer__hint">第一个是心情，其余算话题</span>
					</label>
					<div class="editor-drawer__tags">
						{#each draft.tags as tag, index (tag)}
							<span class="editor-drawer__tag">
								{tag}
								<button
									type="button"
									onclick={() => removeTag(index)}
									aria-label={`移除标签 ${tag}`}
								>
									<X size={11} aria-hidden="true" />
								</button>
							</span>
						{/each}
						<input
							id="moment-tags"
							class="editor-drawer__tag-input"
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

					<label class="editor-drawer__check">
						<input type="checkbox" bind:checked={draft.pinned} />
						<span>置顶这条说说</span>
					</label>

					{#if errorText}
						<p class="editor-drawer__error">{errorText}</p>
					{/if}

					<p class="editor-drawer__note">
						<ImagePlus size={13} aria-hidden="true" />
						图片走正文的 Markdown 语法，先传到图床再贴地址
					</p>
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
				<button type="button" class="editor-drawer__btn" onclick={close} disabled={saving}>
					取消
				</button>
				<button
					type="button"
					class="editor-drawer__btn is-primary"
					onclick={save}
					disabled={saving || !draft || loading}
				>
					{#if saving}
						提交中…
					{:else}
						<Plus size={14} aria-hidden="true" />
						提交
					{/if}
				</button>
			</footer>
		</aside>
	</div>
{/if}
