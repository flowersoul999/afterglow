<script lang="ts">
import { onMount } from "svelte";

type PostSummary = {
	category?: string | null;
	tags: string[];
	published: number;
};

// 统计卡：数字在挂载后从 0 递增到目标值，减少动态效果时直接落定
let {
	totalPosts = 0,
	currentYearPosts = 0,
	currentMonthPosts = 0,
	currentMonthNumber = 1,
	postSummaries = [],
	annualPostGoal = 0,
	totalPostsLabel = "",
	monthPostsLabel = "",
	writingSpanLabel = "",
	categoryPostsLabel = "",
	tagPostsLabel = "",
	progressLabel = "",
	goalLabel = "",
	unavailableLabel = "--",
	evaluationAheadTemplate = "",
	evaluationOnTrackTemplate = "",
	evaluationBehindTemplate = "",
	evaluationCompleteTemplate = "",
}: {
	totalPosts?: number;
	currentYearPosts?: number;
	currentMonthPosts?: number;
	currentMonthNumber?: number;
	postSummaries?: PostSummary[];
	annualPostGoal?: number;
	totalPostsLabel?: string;
	monthPostsLabel?: string;
	writingSpanLabel?: string;
	categoryPostsLabel?: string;
	tagPostsLabel?: string;
	progressLabel?: string;
	goalLabel?: string;
	unavailableLabel?: string;
	evaluationAheadTemplate?: string;
	evaluationOnTrackTemplate?: string;
	evaluationBehindTemplate?: string;
	evaluationCompleteTemplate?: string;
} = $props();

let displayedScopePosts = $state(totalPosts);
let displayedMonthPosts = $state(currentMonthPosts);
let displayedWritingSpanDays = $state<number | null>(null);
let displayedProgress = $state<number | null>(null);
let writingSpanDays = $state<number | null>(null);
let scopePostsLabel = $state(totalPostsLabel);
let animationFrames: number[] = [];

// 超额完成时封顶 100%，避免出现「650%」这种读起来像 bug 的数字
const progressTarget = $derived(
	annualPostGoal > 0
		? Math.min(100, Math.round((currentYearPosts / annualPostGoal) * 100))
		: null,
);

function formatNumber(value: number): string {
	return String(Math.max(0, Math.round(value)));
}

function normalizeFilterValue(value: string | null | undefined): string {
	return (value ?? "").trim();
}

function getScopeSummary(): {
	label: string;
	count: number;
	spanDays: number | null;
} {
	if (postSummaries.length === 0) {
		return { label: totalPostsLabel, count: totalPosts, spanDays: null };
	}

	const params = new URLSearchParams(window.location.search);
	const tags = params.getAll("tag").map(normalizeFilterValue).filter(Boolean);
	const categories = params
		.getAll("category")
		.map(normalizeFilterValue)
		.filter(Boolean);
	const hasUncategorized = params.has("uncategorized");

	let filtered = postSummaries;
	if (tags.length > 0) {
		filtered = filtered.filter((post) =>
			post.tags.some((tag) => tags.includes(normalizeFilterValue(tag))),
		);
	}
	if (categories.length > 0) {
		filtered = filtered.filter((post) =>
			categories.includes(normalizeFilterValue(post.category)),
		);
	}
	if (hasUncategorized) {
		filtered = filtered.filter(
			(post) => normalizeFilterValue(post.category).length === 0,
		);
	}

	const label =
		tags.length > 0
			? tagPostsLabel
			: categories.length > 0 || hasUncategorized
				? categoryPostsLabel
				: totalPostsLabel;
	const timestamps = filtered.map((post) => post.published);
	const spanDays =
		timestamps.length > 1
			? Math.max(
					0,
					Math.round(
						(Math.max(...timestamps) - Math.min(...timestamps)) / 86_400_000,
					),
				)
			: null;
	return { label, count: filtered.length, spanDays };
}

function getEvaluation(): string {
	if (annualPostGoal <= 0) return "";
	if (currentYearPosts >= annualPostGoal) return evaluationCompleteTemplate;

	const remainingPosts = annualPostGoal - currentYearPosts;
	const remainingMonths = Math.max(1, 12 - currentMonthNumber);
	const requiredMonthlyPace = Math.ceil(remainingPosts / remainingMonths);
	const expectedProgress = (currentMonthNumber / 12) * 100;
	const actualProgress = progressTarget ?? 0;
	const template =
		actualProgress >= expectedProgress + 10
			? evaluationAheadTemplate
			: actualProgress >= expectedProgress - 10
				? evaluationOnTrackTemplate
				: evaluationBehindTemplate;
	return template
		.replace("{remaining}", formatNumber(remainingPosts))
		.replace("{months}", formatNumber(remainingMonths))
		.replace("{pace}", formatNumber(requiredMonthlyPace));
}

function animateNumber(
	target: number,
	setter: (value: number) => void,
	reducedMotion: boolean,
): void {
	if (reducedMotion) {
		setter(target);
		return;
	}

	let frameId = 0;
	const startedAt = performance.now();
	const duration = 900;
	const frame = (now: number) => {
		if (frameId) {
			const index = animationFrames.indexOf(frameId);
			if (index >= 0) animationFrames.splice(index, 1);
		}
		const progress = Math.min(1, (now - startedAt) / duration);
		const eased = 1 - (1 - progress) ** 3;
		setter(Math.round(target * eased));
		if (progress < 1) {
			frameId = requestAnimationFrame(frame);
			animationFrames.push(frameId);
		}
	};

	frameId = requestAnimationFrame(frame);
	animationFrames.push(frameId);
}

function cancelAnimations(): void {
	for (const frameId of animationFrames) cancelAnimationFrame(frameId);
	animationFrames = [];
}

onMount(() => {
	const reducedMotion = window.matchMedia(
		"(prefers-reduced-motion: reduce)",
	).matches;
	const scopeSummary = getScopeSummary();
	scopePostsLabel = scopeSummary.label;
	writingSpanDays = scopeSummary.spanDays;
	displayedWritingSpanDays = writingSpanDays;

	if (!reducedMotion) {
		displayedScopePosts = 0;
		displayedWritingSpanDays = writingSpanDays === null ? null : 0;
		displayedMonthPosts = 0;
		displayedProgress = progressTarget === null ? null : 0;
	}

	animateNumber(
		scopeSummary.count,
		(value) => (displayedScopePosts = value),
		reducedMotion,
	);
	if (writingSpanDays !== null) {
		animateNumber(
			writingSpanDays,
			(value) => (displayedWritingSpanDays = value),
			reducedMotion,
		);
	}
	animateNumber(
		currentMonthPosts,
		(value) => (displayedMonthPosts = value),
		reducedMotion,
	);
	if (progressTarget !== null) {
		animateNumber(
			progressTarget,
			(value) => (displayedProgress = value),
			reducedMotion,
		);
	}

	return cancelAnimations;
});

const progressValue = $derived(
	displayedProgress === null
		? unavailableLabel
		: `${formatNumber(displayedProgress)}%`,
);
const evaluationText = $derived(getEvaluation());
</script>

<section class="archive-stats">
	<div class="archive-stats__grid">
		<div
			class="archive-stats__metric"
			role="group"
			aria-label={`${scopePostsLabel}: ${formatNumber(displayedScopePosts)}`}
		>
			<span class="archive-stats__value" aria-hidden="true">{formatNumber(displayedScopePosts)}</span>
			<span class="archive-stats__label">{scopePostsLabel}</span>
		</div>
		{#if displayedWritingSpanDays !== null}
			<div
				class="archive-stats__metric"
				role="group"
				aria-label={`${writingSpanLabel}: ${formatNumber(displayedWritingSpanDays)}`}
			>
				<span class="archive-stats__value" aria-hidden="true">{formatNumber(displayedWritingSpanDays)}</span>
				<span class="archive-stats__label">{writingSpanLabel}</span>
			</div>
		{/if}
		<div
			class="archive-stats__metric"
			role="group"
			aria-label={`${monthPostsLabel}: ${formatNumber(displayedMonthPosts)}`}
		>
			<span class="archive-stats__value" aria-hidden="true">{formatNumber(displayedMonthPosts)}</span>
			<span class="archive-stats__label">{monthPostsLabel}</span>
		</div>
		<div
			class="archive-stats__metric"
			role="group"
			aria-label={`${progressLabel}: ${progressValue}`}
		>
			<span class="archive-stats__value" aria-hidden="true">{progressValue}</span>
			<span class="archive-stats__label">{progressLabel}</span>
			{#if annualPostGoal > 0}
				<span class="archive-stats__goal">{goalLabel} {annualPostGoal}</span>
			{/if}
		</div>
	</div>
	{#if evaluationText}
		<p class="archive-stats__evaluation">{evaluationText}</p>
	{/if}
</section>
