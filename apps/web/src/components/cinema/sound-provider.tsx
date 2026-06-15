"use client";

/**
 * Sense audio is **opt-in**, gesture-gated (`AudioContext.resume()`), muted when
 * `prefers-reduced-motion: reduce`, and loaded lazily via Web Audio decode.
 *
 * Patrons persist nested `preferences.audio` (master · atmosphere · feedback);
 * legacy `theaterAudio` still migrates on read.
 */

import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
	useSyncExternalStore,
} from "react";
import { api } from "@/lib/api";
import {
	type ProfileAudioPreferences,
	readProfileAudioPreferences,
} from "@/lib/profile-audio-preferences";

export type CinemaSoundClip =
	| "projector-hum"
	| "reel-clack"
	| "curtain-rise"
	| "streak-ping";

export type CinemaSoundCategory = "atmosphere" | "feedback";

/** Bundled cues under `apps/web/public/audio/*` — short Opus payloads. */
const SOURCE_MAP: Record<CinemaSoundClip, string> = {
	"projector-hum": "/audio/projector-hum.ogg",
	"reel-clack": "/audio/reel-clack.ogg",
	"curtain-rise": "/audio/curtain.ogg",
	"streak-ping": "/audio/streak-ping.ogg",
};

const LOOPING_CLIPS = new Set<CinemaSoundClip>(["projector-hum"]);

/** Restrained booth levels — feedback cues stay ≤0.65 per sound-layer spec. */
const CLIP_PEAK_GAIN: Record<CinemaSoundClip, number> = {
	"projector-hum": 0.22,
	"reel-clack": 0.58,
	"curtain-rise": 0.62,
	"streak-ping": 0.58,
};

const FEEDBACK_DEBOUNCE_MS = 400;

/** Master loop playback so we can gentle-fade teardown on route swaps. */
type LoopHandle = { source: AudioBufferSourceNode; gain: GainNode };

type PlayOptions = {
	category?: CinemaSoundCategory;
};

type CinematicAudioValue = {
	audioPreferences: ProfileAudioPreferences;
	/** Legacy alias — mirrors `audioPreferences.enabled`. */
	theaterAudioEnabled: boolean;
	setTheaterAudioEnabled: (enabled: boolean) => void;
	setAudioPreferences: (next: ProfileAudioPreferences) => void;
	preferencesLoaded: boolean;
	/** One-shot cues + looping hum; gated by master, category, gesture, reduced motion. */
	play: (name: CinemaSoundClip, opts?: PlayOptions) => Promise<void>;
	/** Stops looping hum (`projector-hum`) cleanly; no-ops for one-shots. */
	stopSound: (name: CinemaSoundClip) => void;
	stopAllLoopingCues: () => void;
};

const CinematicAudioContext = createContext<CinematicAudioValue | null>(null);

const DEFAULT_AUDIO_PREFERENCES: ProfileAudioPreferences = {
	enabled: false,
	atmosphere: false,
	feedback: false,
	streakMilestonesCelebrated: [],
};

function defaultCategory(name: CinemaSoundClip): CinemaSoundCategory {
	return name === "projector-hum" ? "atmosphere" : "feedback";
}

function prefersReducedMotion(): boolean {
	if (typeof window === "undefined") return false;
	return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function subscribeReducedMotion(listener: () => void): () => void {
	if (typeof window === "undefined") return () => undefined;
	const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
	mq.addEventListener("change", listener);
	return () => mq.removeEventListener("change", listener);
}

export function CinemaSoundProvider({ children }: { children: ReactNode }) {
	const [audioPreferences, setAudioPreferencesState] =
		useState<ProfileAudioPreferences>(DEFAULT_AUDIO_PREFERENCES);
	const [preferencesLoaded, setPreferencesLoaded] = useState(false);

	const reducedMotion = useSyncExternalStore(
		subscribeReducedMotion,
		prefersReducedMotion,
		() => false,
	);

	const audioCtxRef = useRef<AudioContext | null>(null);
	const buffersRef = useRef<Map<CinemaSoundClip, AudioBuffer>>(new Map());
	const decodeLocksRef = useRef<Map<CinemaSoundClip, Promise<AudioBuffer>>>(
		new Map(),
	);
	const loopsRef = useRef<Map<CinemaSoundClip, LoopHandle>>(new Map());
	const armedRef = useRef(false);
	const lastFeedbackPlayAtRef = useRef(0);

	/**
	 * First pointer / key activates “audience etiquette” autoplay unlocking without
	 * spamming resumes before the patron opts into sound.
	 */
	useEffect(() => {
		const markArmed = () => {
			armedRef.current = true;
		};
		window.addEventListener("pointerdown", markArmed, {
			capture: true,
			passive: true,
		});
		window.addEventListener("keydown", markArmed, {
			capture: true,
			passive: true,
		});
		return () => {
			window.removeEventListener("pointerdown", markArmed, true);
			window.removeEventListener("keydown", markArmed, true);
		};
	}, []);

	/** Bootstrap persisted preference from `/profiles/me` (silent default off on errors). */
	useEffect(() => {
		let cancel = false;
		async function loadPref() {
			try {
				const res = await api.api.profiles.me
					.get()
					.catch(() => ({ data: null }));
				if (cancel) return;
				const row = res.data as {
					preferences?: Record<string, unknown>;
				} | null;
				setAudioPreferencesState(
					readProfileAudioPreferences(row?.preferences ?? null),
				);
			} finally {
				if (!cancel) setPreferencesLoaded(true);
			}
		}
		void loadPref();
		return () => {
			cancel = true;
		};
	}, []);

	const setAudioPreferences = useCallback((next: ProfileAudioPreferences) => {
		setAudioPreferencesState(next);
	}, []);

	/** Legacy Settings hook — toggles all three flags together. */
	const setTheaterAudioEnabled = useCallback((enabled: boolean) => {
		setAudioPreferencesState((prev) =>
			enabled
				? {
						...prev,
						enabled: true,
						atmosphere: true,
						feedback: true,
					}
				: {
						...prev,
						enabled: false,
						atmosphere: false,
						feedback: false,
					},
		);
	}, []);

	/** Lazily allocates + resumes the backing graph exactly once audible work is queued. */
	const ensureCtx = useCallback(async () => {
		if (typeof window === "undefined") return null;
		if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
		const ctx = audioCtxRef.current;
		if (ctx.state === "suspended") await ctx.resume().catch(() => undefined);
		return ctx;
	}, []);

	const decodeClip = useCallback(
		async (ctx: AudioContext, name: CinemaSoundClip) => {
			const cached = buffersRef.current.get(name);
			if (cached) return cached;
			let pending = decodeLocksRef.current.get(name);
			if (!pending) {
				pending = (async () => {
					const res = await fetch(SOURCE_MAP[name], {
						credentials: "same-origin",
					});
					const arr = await res.arrayBuffer();
					return ctx.decodeAudioData(arr.slice(0));
				})();
				decodeLocksRef.current.set(name, pending);
			}
			const buf = await pending;
			buffersRef.current.set(name, buf);
			return buf;
		},
		[],
	);

	const teardownLoop = useCallback((name: CinemaSoundClip, fadeMs: number) => {
		const handle = loopsRef.current.get(name);
		if (!handle) return;
		const ctx = audioCtxRef.current;
		if (!ctx) {
			loopsRef.current.delete(name);
			return;
		}
		try {
			const now = ctx.currentTime;
			const current = Math.max(handle.gain.gain.value, 0);
			handle.gain.gain.cancelScheduledValues(now);
			handle.gain.gain.setValueAtTime(current, now);
			handle.gain.gain.linearRampToValueAtTime(0.00001, now + fadeMs / 1000);
		} finally {
			const stopMs = fadeMs + 40;
			window.setTimeout(() => {
				handle.source.stop();
				handle.source.disconnect();
				handle.gain.disconnect();
				loopsRef.current.delete(name);
			}, stopMs);
		}
	}, []);

	const stopSound = useCallback(
		(name: CinemaSoundClip) => {
			if (!LOOPING_CLIPS.has(name)) return;
			teardownLoop(name, 160);
		},
		[teardownLoop],
	);

	const stopAllLoopingCues = useCallback(
		() => teardownLoop("projector-hum", 180),
		[teardownLoop],
	);

	const playOneShot = useCallback(
		(ctx: AudioContext, buf: AudioBuffer, name: CinemaSoundClip) => {
			const source = ctx.createBufferSource();
			source.buffer = buf;
			const gain = ctx.createGain();
			const peak = CLIP_PEAK_GAIN[name];
			gain.gain.setValueAtTime(peak, ctx.currentTime);
			const release = ctx.currentTime + Math.min(buf.duration + 0.02, 0.48);
			gain.gain.linearRampToValueAtTime(0.0001, release);
			source.connect(gain).connect(ctx.destination);
			source.onended = () => {
				source.disconnect();
				gain.disconnect();
			};
			source.start();
		},
		[],
	);

	const play = useCallback(
		async (name: CinemaSoundClip, opts?: PlayOptions) => {
			if (!preferencesLoaded) return;
			if (!armedRef.current || reducedMotion) return;

			const category = opts?.category ?? defaultCategory(name);
			if (!audioPreferences.enabled) return;
			if (category === "atmosphere" && !audioPreferences.atmosphere) return;
			if (category === "feedback" && !audioPreferences.feedback) return;

			if (category === "feedback") {
				const now = Date.now();
				if (now - lastFeedbackPlayAtRef.current < FEEDBACK_DEBOUNCE_MS) return;
				lastFeedbackPlayAtRef.current = now;
			}

			const ctx = await ensureCtx();
			if (!ctx) return;

			const buf = await decodeClip(ctx, name);

			if (name === "projector-hum") {
				if (loopsRef.current.has(name)) return;
				const source = ctx.createBufferSource();
				source.buffer = buf;
				source.loop = true;
				source.loopStart = 0;
				source.loopEnd = buf.duration;
				const gain = ctx.createGain();
				gain.gain.setValueAtTime(0, ctx.currentTime);
				gain.gain.linearRampToValueAtTime(
					CLIP_PEAK_GAIN[name],
					ctx.currentTime + 0.6,
				);
				source.connect(gain).connect(ctx.destination);
				source.start();
				loopsRef.current.set(name, { source, gain });
				return;
			}

			playOneShot(ctx, buf, name);
		},
		[
			audioPreferences,
			preferencesLoaded,
			reducedMotion,
			decodeClip,
			ensureCtx,
			playOneShot,
		],
	);

	const theaterAudioEnabled = audioPreferences.enabled;

	const value = useMemo<CinematicAudioValue>(
		() => ({
			audioPreferences,
			theaterAudioEnabled,
			setTheaterAudioEnabled,
			setAudioPreferences,
			preferencesLoaded,
			play,
			stopSound,
			stopAllLoopingCues,
		}),
		[
			audioPreferences,
			theaterAudioEnabled,
			setTheaterAudioEnabled,
			setAudioPreferences,
			preferencesLoaded,
			play,
			stopSound,
			stopAllLoopingCues,
		],
	);

	return (
		<CinematicAudioContext.Provider value={value}>
			{children}
		</CinematicAudioContext.Provider>
	);
}

export function useCinematicAudio(): CinematicAudioValue {
	const ctx = useContext(CinematicAudioContext);
	if (!ctx)
		throw new Error(
			"useCinematicAudio must be rendered under CinemaSoundProvider",
		);
	return ctx;
}
