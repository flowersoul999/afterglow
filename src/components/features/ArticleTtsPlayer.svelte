<script lang="ts">
import { onDestroy, onMount } from "svelte";
import Icon from "@/components/common/Icon.svelte";
import { siteConfig, ttsConfig } from "@/config";
import I18nKey from "@/i18n/i18nKey";
import { i18n } from "@/i18n/translation";
import { extractReadableText, splitForSpeech } from "@/utils/tts-text";

interface Props {
	title: string;
	cover?: string | null;
}

let { title, cover = null }: Props = $props();

let open = $state(false);
let playing = $state(false);
let loading = $state(false);
let mode = $state<"server" | "speech">("server");
let rate = $state(1);
let voice = $state(ttsConfig.defaultVoice);
let elapsed = $state(0);
let duration = $state(0);
let notice = $state("");

let audio: HTMLAudioElement | null = null;
let text = "";
let speechQueue = $state<string[]>([]);
let speechIndex = $state(0);
let speechEpoch = 0;
let requestSeq = 0;
let activeController: AbortController | null = null;
let noticeTimer: ReturnType<typeof setTimeout> | null = null;
let elapsedTimer: ReturnType<typeof setInterval> | null = null;

const hasServer = ttsConfig.enable && ttsConfig.serverUrl.length > 0;
const speechPercent = $derived(
	speechQueue.length > 0
		? Math.min(100, (speechIndex / speechQueue.length) * 100)
		: 0,
);

onMount(() => {
	const savedRate = Number(safeGetStorage("firefly-tts-rate") || "1");
	if (ttsConfig.speeds.includes(savedRate)) {
		rate = savedRate;
	}
	const savedVoice = safeGetStorage("firefly-tts-voice");
	if (savedVoice && ttsConfig.voices.some((item) => item.name === savedVoice)) {
		voice = savedVoice;
	}
});

onDestroy(() => {
	stopAll();
	if (noticeTimer) clearTimeout(noticeTimer);
});

function safeGetStorage(key: string): string | null {
	try {
		return localStorage.getItem(key);
	} catch {
		return null;
	}
}

function safeSetStorage(key: string, value: string): void {
	try {
		localStorage.setItem(key, value);
	} catch {
		// 隐私模式/受限环境：忽略即可
	}
}

function showNotice(message: string): void {
	if (!message) return;
	notice = message;
	if (noticeTimer) clearTimeout(noticeTimer);
	noticeTimer = setTimeout(() => {
		notice = "";
	}, 6000);
}

function formatTime(value: number): string {
	if (!Number.isFinite(value) || value <= 0) return "00:00";
	const minutes = Math.floor(value / 60);
	const seconds = Math.floor(value % 60);
	return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function collectText(): string {
	const root = document.querySelector("#post-container .markdown-content");
	const result = extractReadableText(root);
	if (!result.text) {
		showNotice(i18n(I18nKey.ttsEmpty));
	} else if (result.truncated) {
		showNotice(i18n(I18nKey.ttsTruncated));
	}
	return result.text;
}

function cancelSpeech(): void {
	if (typeof window === "undefined") return;
	stopElapsedTimer();
	speechEpoch += 1;
	window.speechSynthesis.cancel();
	window.speechSynthesis.resume();
}

function startElapsedTimer(): void {
	if (elapsedTimer) return;
	elapsedTimer = setInterval(() => {
		elapsed += 1;
	}, 1000);
}

function stopElapsedTimer(): void {
	if (!elapsedTimer) return;
	clearInterval(elapsedTimer);
	elapsedTimer = null;
}

function abortServerRequest(): void {
	if (activeController) {
		activeController.abort();
		activeController = null;
	}
}

function invalidateRequest(): void {
	requestSeq += 1;
	abortServerRequest();
}

function releaseAudio(): void {
	if (!audio) return;
	audio.onerror = null;
	audio.ontimeupdate = null;
	audio.onended = null;
	audio.pause();
	audio.removeAttribute("src");
	audio.load();
	audio = null;
}

function stopAll(): void {
	releaseAudio();
	cancelSpeech();
	invalidateRequest();
	clearMediaSession();
	stopElapsedTimer();
	playing = false;
	loading = false;
	elapsed = 0;
	duration = 0;
}

function setupMediaSession(): void {
	if (typeof navigator === "undefined" || !("mediaSession" in navigator))
		return;
	navigator.mediaSession.metadata = new MediaMetadata({
		title,
		artist: siteConfig.title,
		album: i18n(I18nKey.ttsRead),
		artwork: cover ? [{ src: cover }] : [],
	});
	navigator.mediaSession.setActionHandler("play", () => {
		if (mode === "server" && audio) {
			audio
				.play()
				.then(() => {
					playing = true;
				})
				.catch(() => {
					playing = false;
				});
		}
	});
	navigator.mediaSession.setActionHandler("pause", () => {
		if (mode !== "server" || !audio) return;
		audio.pause();
		playing = false;
	});
}

function clearMediaSession(): void {
	if (typeof navigator === "undefined" || !("mediaSession" in navigator))
		return;
	navigator.mediaSession.metadata = null;
	navigator.mediaSession.setActionHandler("play", null);
	navigator.mediaSession.setActionHandler("pause", null);
}

function speakNext(epoch: number): void {
	if (epoch !== speechEpoch || speechIndex >= speechQueue.length) {
		if (epoch === speechEpoch) {
			playing = false;
			stopElapsedTimer();
		}
		return;
	}
	const utterance = new SpeechSynthesisUtterance(speechQueue[speechIndex]);
	utterance.lang = document.documentElement.lang || "zh-CN";
	utterance.rate = rate;
	utterance.onend = () => {
		speechIndex += 1;
		speakNext(epoch);
	};
	utterance.onerror = () => {
		speechIndex += 1;
		speakNext(epoch);
	};
	playing = true;
	startElapsedTimer();
	window.speechSynthesis.speak(utterance);
}

function startSpeech(message: string): void {
	clearMediaSession();
	if (message) showNotice(message);
	invalidateRequest();
	mode = "speech";
	cancelSpeech();
	elapsed = 0;
	speechQueue = splitForSpeech(text);
	speechIndex = 0;
	if (speechQueue.length === 0) {
		playing = false;
		return;
	}
	speakNext(speechEpoch);
}

async function startServer(): Promise<void> {
	releaseAudio();
	cancelSpeech();
	invalidateRequest();
	mode = "server";
	loading = true;
	const seq = requestSeq;
	const controller = new AbortController();
	activeController = controller;
	const timeout = setTimeout(
		() => controller.abort(),
		ttsConfig.requestTimeoutMs,
	);
	try {
		const response = await fetch(`${ttsConfig.serverUrl}/tts`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ text, voice }),
			signal: controller.signal,
		});
		if (!response.ok) {
			throw new Error(`HTTP ${response.status}`);
		}
		const data = (await response.json()) as { id: string };
		if (seq !== requestSeq || !open) {
			return;
		}
		const player = new Audio(`${ttsConfig.serverUrl}/audio/${data.id}`);
		player.playbackRate = rate;
		player.ontimeupdate = () => {
			elapsed = player.currentTime;
			duration = Number.isFinite(player.duration) ? player.duration : 0;
		};
		player.onended = () => {
			playing = false;
			elapsed = 0;
		};
		player.onerror = () => {
			releaseAudio();
			startSpeech(i18n(I18nKey.ttsFallback));
		};
		audio = player;
		activeController = null;
		setupMediaSession();
		try {
			await player.play();
			playing = true;
		} catch {
			playing = false;
		}
	} catch {
		if (seq === requestSeq && open) {
			startSpeech(i18n(I18nKey.ttsFallback));
		}
	} finally {
		clearTimeout(timeout);
		if (seq === requestSeq) {
			loading = false;
		}
	}
}

async function start(): Promise<void> {
	stopAll();
	open = true;
	text = collectText();
	if (!text) {
		loading = false;
		open = true;
		return;
	}
	if (hasServer) {
		await startServer();
	} else {
		startSpeech(i18n(I18nKey.ttsNoServer));
	}
}

function toggle(): void {
	if (!open) {
		void start();
		return;
	}
	if (loading) return;
	if (mode === "server" && audio) {
		if (playing) {
			audio.pause();
			playing = false;
		} else {
			audio
				.play()
				.then(() => {
					playing = true;
				})
				.catch(() => {
					playing = false;
				});
		}
		return;
	}
	if (mode === "server") {
		void start();
		return;
	}
	if (mode === "speech") {
		if (playing) {
			cancelSpeech();
			playing = false;
		} else if (speechIndex >= speechQueue.length) {
			speechIndex = 0;
			speakNext(speechEpoch);
		} else {
			speakNext(speechEpoch);
		}
	}
}

function changeRate(event: Event): void {
	const value = Number((event.currentTarget as HTMLSelectElement).value);
	rate = value;
	safeSetStorage("firefly-tts-rate", String(value));
	if (mode === "server" && audio) {
		audio.playbackRate = value;
		return;
	}
	if (mode === "speech") {
		if (playing) {
			cancelSpeech();
			speakNext(speechEpoch);
		}
	}
}

function changeVoice(event: Event): void {
	voice = (event.currentTarget as HTMLSelectElement).value;
	safeSetStorage("firefly-tts-voice", voice);
	if (mode === "server" && open) {
		void startServer();
	}
}

function seek(event: Event): void {
	const value = Number((event.currentTarget as HTMLInputElement).value);
	if (mode === "server" && audio) {
		audio.currentTime = value;
		elapsed = value;
	}
}

function close(): void {
	stopAll();
	open = false;
	notice = "";
}
</script>

<span class="tts-player__trigger">
	<button
		type="button"
		class="tts-player__button"
		disabled={loading}
		onclick={toggle}
		aria-label={i18n(I18nKey.ttsRead)}
	>
		<Icon icon="material-symbols:headphones" />
		<span class="tts-player__button-text">{i18n(I18nKey.ttsRead)}</span>
	</button>
</span>

{#if open}
	<div class="tts-player" role="region" aria-label={i18n(I18nKey.ttsRead)}>
		<button
			type="button"
			class="tts-player__control"
			onclick={toggle}
			aria-label={playing ? i18n(I18nKey.ttsPause) : i18n(I18nKey.ttsResume)}
		>
			{#if playing}
				<Icon icon="material-symbols:pause-rounded" />
			{:else}
				<Icon icon="material-symbols:play-arrow-rounded" />
			{/if}
		</button>

		<div class="tts-player__timeline">
			<input
				class="tts-player__seek"
				type="range"
				min="0"
				max={mode === "speech" ? 100 : duration > 0 ? duration : 0}
				step="0.5"
				value={mode === "speech" ? speechPercent : elapsed}
				oninput={seek}
				aria-label={i18n(I18nKey.ttsRead)}
				disabled={mode === "server" ? duration === 0 : true}
			/>
			<span class="tts-player__time">
				{formatTime(elapsed)} / {mode === "server" && duration > 0 ? formatTime(duration) : "--:--"}
			</span>
		</div>

		<label class="tts-player__field">
			<span>{i18n(I18nKey.ttsSpeed)}</span>
			<select class="tts-player__select" value={rate} onchange={changeRate}>
				{#each ttsConfig.speeds as speed (speed)}
					<option value={speed}>{speed === 1 ? "1x" : `${speed}x`}</option>
				{/each}
			</select>
		</label>

		{#if mode === "server"}
			<label class="tts-player__field">
				<span>{i18n(I18nKey.ttsVoice)}</span>
				<select class="tts-player__select" value={voice} onchange={changeVoice}>
					{#each ttsConfig.voices as item (item.name)}
						<option value={item.name}>{item.label}</option>
					{/each}
				</select>
			</label>
		{/if}

		<button
			type="button"
			class="tts-player__control"
			onclick={close}
			aria-label={i18n(I18nKey.ttsClose)}
		>
			<Icon icon="material-symbols:close" />
		</button>

		{#if loading}
			<span class="tts-player__notice" role="status" aria-live="polite">{i18n(I18nKey.ttsPreparing)}</span>
		{:else if notice}
			<span class="tts-player__notice" role="status" aria-live="polite">{notice}</span>
		{/if}
	</div>
{/if}
