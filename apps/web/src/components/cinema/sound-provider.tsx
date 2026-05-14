"use client";

/**
 * Theater audio is **opt‑in**, gesture‑gated (`AudioContext.resume()`), muted when
 * `prefers-reduced-motion: reduce`, and loaded lazily via Web Audio decode.
 *
 * Profiles persist `preferences.theaterAudio`; Settings PATCH merges shallowly
 * with existing JSON so one flag doesn't clobber unrelated prefs keys.
 */

import { api } from "@/lib/api";
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

export type CinemaSoundClip = "projector-hum" | "reel-clack";

/** Bundled cues under `apps/web/public/audio/*` — short Opus payloads (see Phase 7 plan). */
const SOURCE_MAP: Record<CinemaSoundClip, string> = {
  "projector-hum": "/audio/projector-hum.ogg",
  "reel-clack": "/audio/reel-clack.ogg",
};

/** Master loop playback so we can gentle-fade teardown on route swaps. */
type LoopHandle = { source: AudioBufferSourceNode; gain: GainNode };

type CinematicAudioValue = {
  theaterAudioEnabled: boolean;
  setTheaterAudioEnabled: (enabled: boolean) => void;
  preferencesLoaded: boolean;
  /** One-shot cues + looping hum; no-ops unless armed by user gesture AND toggle on. */
  play: (name: CinemaSoundClip) => Promise<void>;
  /** Stops looping hum (`projector-hum`) cleanly; skips one-shots (`reel-clack`). */
  stopSound: (name: CinemaSoundClip) => void;
  stopAllLoopingCues: () => void;
};

const CinematicAudioContext = createContext<CinematicAudioValue | null>(null);

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
  const [theaterAudioEnabled, setTheaterAudioEnabled] = useState(false);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);

  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    prefersReducedMotion,
    () => false,
  );

  const audioCtxRef = useRef<AudioContext | null>(null);
  const buffersRef = useRef<Map<CinemaSoundClip, AudioBuffer>>(new Map());
  const decodeLocksRef = useRef<Map<CinemaSoundClip, Promise<AudioBuffer>>>(new Map());
  const loopsRef = useRef<Map<CinemaSoundClip, LoopHandle>>(new Map());
  const armedRef = useRef(false);

  /**
   * First pointer / key activates “audience etiquette” autoplay unlocking without
   * spamming resumes before the patron opts into sound.
   */
  useEffect(() => {
    const markArmed = () => {
      armedRef.current = true;
    };
    window.addEventListener("pointerdown", markArmed, { capture: true, passive: true });
    window.addEventListener("keydown", markArmed, { capture: true, passive: true });
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
        const res = await api.api.profiles.me.get().catch(() => ({ data: null }));
        if (cancel) return;
        const row = res.data as { preferences?: Record<string, unknown> } | null | undefined;
        const prefs = row?.preferences;
        setTheaterAudioEnabled(prefs?.theaterAudio === true);
      } finally {
        if (!cancel) setPreferencesLoaded(true);
      }
    }
    void loadPref();
    return () => {
      cancel = true;
    };
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
      if (buffersRef.current.has(name)) return buffersRef.current.get(name)!;
      let pending = decodeLocksRef.current.get(name);
      if (!pending) {
        pending = (async () => {
          const res = await fetch(SOURCE_MAP[name], { credentials: "same-origin" });
          const arr = await res.arrayBuffer();
          return ctx.decodeAudioData(arr.slice(0)); // detach copy so concurrent decodes behave
        })();
        decodeLocksRef.current.set(name, pending);
      }
      const buf = await pending;
      buffersRef.current.set(name, buf);
      return buf;
    },
    [],
  );

  const teardownLoopVisual = useCallback((name: CinemaSoundClip, fadeMs: number) => {
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
    (name: CinemaSoundClip) => teardownLoopVisual(name, 160),
    [teardownLoopVisual],
  );

  const stopAllLoopingCues = useCallback(() => teardownLoopVisual("projector-hum", 180), [teardownLoopVisual]);

  const play = useCallback(
    async (name: CinemaSoundClip) => {
      if (!preferencesLoaded) return;
      if (!armedRef.current || reducedMotion || !theaterAudioEnabled) return;

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
        gain.gain.linearRampToValueAtTime(0.22, ctx.currentTime + 0.6); // restrained booth volume
        source.connect(gain).connect(ctx.destination);
        source.start();
        loopsRef.current.set(name, { source, gain });
        return;
      }

      /** One-shot sprocket clack fired after diary logging completes. */
      const source = ctx.createBufferSource();
      source.buffer = buf;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.74, ctx.currentTime);
      const release = ctx.currentTime + Math.min(buf.duration + 0.02, 0.48);
      gain.gain.linearRampToValueAtTime(0.0001, release);
      source.connect(gain).connect(ctx.destination);
      source.onended = () => {
        source.disconnect();
        gain.disconnect();
      };
      source.start();
    },
    [
      preferencesLoaded,
      reducedMotion,
      theaterAudioEnabled,
      decodeClip,
      ensureCtx,
    ],
  );

  const value = useMemo<CinematicAudioValue>(
    () => ({
      theaterAudioEnabled,
      setTheaterAudioEnabled,
      preferencesLoaded,
      play,
      stopSound,
      stopAllLoopingCues,
    }),
    [preferencesLoaded, play, stopSound, stopAllLoopingCues, theaterAudioEnabled],
  );

  return <CinematicAudioContext.Provider value={value}>{children}</CinematicAudioContext.Provider>;
}

export function useCinematicAudio(): CinematicAudioValue {
  const ctx = useContext(CinematicAudioContext);
  if (!ctx) throw new Error("useCinematicAudio must be rendered under CinemaSoundProvider");
  return ctx;
}
