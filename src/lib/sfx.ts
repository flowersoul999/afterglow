/**
 * 修仙音效：纯 WebAudio 程序化合成，不依赖任何音频文件。
 *
 * 为什么不用 mp3：博客仓库不想塞二进制资源，而且合成音效能随主题/连斩数动态变化。
 * 浏览器自动播放策略要求音频在「用户手势」内启动——勾选清单正是手势，
 * 所以这里在每次播放前尝试 resume AudioContext，无需额外引导。
 *
 * 静音开关持久化在 localStorage（aemeath-sfx-muted），用户在面板里一键切换。
 */

const MUTE_KEY = "aemeath-sfx-muted";

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
	if (typeof window === "undefined") return null;
	const AC =
		window.AudioContext ||
		(window as unknown as { webkitAudioContext?: typeof AudioContext })
			.webkitAudioContext;
	if (!AC) return null;
	if (!ctx) ctx = new AC();
	if (ctx.state === "suspended") void ctx.resume();
	return ctx;
}

export function isMuted(): boolean {
	if (typeof localStorage === "undefined") return false;
	return localStorage.getItem(MUTE_KEY) === "1";
}

export function setMuted(muted: boolean): void {
	if (typeof localStorage === "undefined") return;
	try {
		localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
	} catch {
		/* 忽略 */
	}
}

function guard(): AudioContext | null {
	if (isMuted()) return null;
	return getCtx();
}

/** 一个带包络的振荡器音 */
function tone(
	c: AudioContext,
	opts: {
		type: OscillatorType;
		freq: number;
		start: number;
		dur: number;
		gain: number;
		detune?: number;
		glideTo?: number;
	},
): void {
	const osc = c.createOscillator();
	const g = c.createGain();
	osc.type = opts.type;
	osc.frequency.setValueAtTime(opts.freq, opts.start);
	if (opts.glideTo)
		osc.frequency.exponentialRampToValueAtTime(
			opts.glideTo,
			opts.start + opts.dur,
		);
	if (opts.detune) osc.detune.setValueAtTime(opts.detune, opts.start);
	// 快速起音 + 指数衰减，听感干净不刺耳
	g.gain.setValueAtTime(0.0001, opts.start);
	g.gain.exponentialRampToValueAtTime(opts.gain, opts.start + 0.008);
	g.gain.exponentialRampToValueAtTime(0.0001, opts.start + opts.dur);
	osc.connect(g).connect(c.destination);
	osc.start(opts.start);
	osc.stop(opts.start + opts.dur + 0.02);
}

/** 一段噪声爆发（剑光「唰」的金属感） */
function noiseBurst(
	c: AudioContext,
	start: number,
	dur: number,
	gain: number,
	bandHz: number,
	q = 6,
): void {
	const len = Math.floor(c.sampleRate * dur);
	const buf = c.createBuffer(1, len, c.sampleRate);
	const data = buf.getChannelData(0);
	for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
	const src = c.createBufferSource();
	src.buffer = buf;
	const bp = c.createBiquadFilter();
	bp.type = "bandpass";
	bp.frequency.value = bandHz;
	bp.Q.value = q;
	const g = c.createGain();
	g.gain.setValueAtTime(gain, start);
	g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
	src.connect(bp).connect(g).connect(c.destination);
	src.start(start);
	src.stop(start + dur + 0.02);
}

/** 斩妖：短促金属剑光 + 一声清脆叮 */
export function playSlay(): void {
	const c = guard();
	if (!c) return;
	const t = c.currentTime;
	noiseBurst(c, t, 0.14, 0.18, 3200, 9);
	tone(c, {
		type: "triangle",
		freq: 1500,
		start: t + 0.01,
		dur: 0.16,
		gain: 0.12,
		glideTo: 2400,
	});
}

/** 连斩：随连击数升调的 whoosh + 叠音 */
export function playCombo(n: number): void {
	const c = guard();
	if (!c) return;
	const t = c.currentTime;
	const base = 420 + Math.min(n, 8) * 70;
	noiseBurst(c, t, 0.22, 0.16, base * 4, 4);
	tone(c, {
		type: "sawtooth",
		freq: base,
		start: t,
		dur: 0.24,
		gain: 0.1,
		glideTo: base * 1.6,
	});
	tone(c, {
		type: "sine",
		freq: base * 1.5,
		start: t + 0.03,
		dur: 0.2,
		gain: 0.08,
	});
}

/** 突破：两声钟鸣（带泛音，余韵更长） */
export function playBreakthrough(): void {
	const c = guard();
	if (!c) return;
	const t = c.currentTime;
	tone(c, { type: "sine", freq: 523.25, start: t, dur: 1.4, gain: 0.16 });
	tone(c, { type: "sine", freq: 784, start: t + 0.06, dur: 1.2, gain: 0.1 });
	tone(c, {
		type: "sine",
		freq: 1046.5,
		start: t + 0.12,
		dur: 1.0,
		gain: 0.06,
	});
}

/** 飞剑传书：柔和铃音（一封信抵达） */
export function playStory(): void {
	const c = guard();
	if (!c) return;
	const t = c.currentTime;
	tone(c, { type: "triangle", freq: 880, start: t, dur: 0.5, gain: 0.09 });
	tone(c, {
		type: "triangle",
		freq: 1318.5,
		start: t + 0.08,
		dur: 0.45,
		gain: 0.06,
	});
}
