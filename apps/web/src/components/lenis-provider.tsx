"use client";

import type { LenisOptions } from "lenis";
import "lenis/dist/lenis.css";
import { ReactLenis } from "lenis/react";
import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useMemo,
	useState,
	useSyncExternalStore,
} from "react";

import { api } from "@/lib/api";
import { readSmoothScrollPref } from "@/lib/profile-preferences";

/** Default feel — slightly softer than Lenis’ stock `lerp` so long pages don’t overshoot on fast wheels. */
const LENIS_SMOOTH: LenisOptions = {
	autoRaf: true,
	smoothWheel: true,
	lerp: 0.09,
	wheelMultiplier: 1,
	touchMultiplier: 1,
	/** Let `overflow-x-auto` rails (e.g. streaming providers) use native smooth wheel / Shift+scroll. */
	allowNestedScroll: true,
	/** Next.js client navigations: kill wheel inertia so the new route doesn’t “coast” from the old one. */
	stopInertiaOnNavigate: true,
};

/** Native wheel / touch — default for everyone until Settings opt-in. */
const LENIS_NATIVE: LenisOptions = {
	autoRaf: true,
	smoothWheel: false,
	lerp: 1,
	stopInertiaOnNavigate: true,
};

type SmoothScrollPreferenceValue = {
	smoothScrollEnabled: boolean;
	setSmoothScrollEnabled: (enabled: boolean) => void;
	preferencesLoaded: boolean;
};

const SmoothScrollPreferenceContext =
	createContext<SmoothScrollPreferenceValue | null>(null);

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

/** Syncs Settings → Lenis + `html.smooth-scroll-enabled` for in-page anchors. */
export function useSmoothScrollPreference(): SmoothScrollPreferenceValue {
	const ctx = useContext(SmoothScrollPreferenceContext);
	if (ctx == null) {
		throw new Error(
			"useSmoothScrollPreference must be used within LenisProvider",
		);
	}
	return ctx;
}

/**
 * Global scrolling (Lenis). Smooth wheel is **opt-in** via profile `preferences.smoothScroll`
 * (Settings → Experience). `root` mode attaches to `window` without extra scroll wrappers.
 */
export function LenisProvider({ children }: { children: ReactNode }) {
	const [smoothScrollEnabled, setSmoothScrollEnabled] = useState(false);
	const [preferencesLoaded, setPreferencesLoaded] = useState(false);

	const reducedMotion = useSyncExternalStore(
		subscribeReducedMotion,
		prefersReducedMotion,
		() => false,
	);

	/** Bootstrap persisted preference from `/profiles/me` (default off on errors / signed out). */
	useEffect(() => {
		let cancel = false;
		async function loadPref() {
			try {
				const res = await api.api.profiles.me
					.get()
					.catch(() => ({ data: null }));
				if (cancel) return;
				const row = res.data as
					| { preferences?: Record<string, unknown> }
					| null
					| undefined;
				setSmoothScrollEnabled(readSmoothScrollPref(row?.preferences ?? null));
			} finally {
				if (!cancel) setPreferencesLoaded(true);
			}
		}
		void loadPref();
		return () => {
			cancel = true;
		};
	}, []);

	const smoothScrollActive = smoothScrollEnabled && !reducedMotion;

	useEffect(() => {
		document.documentElement.classList.toggle(
			"smooth-scroll-enabled",
			smoothScrollActive,
		);
		return () => {
			document.documentElement.classList.remove("smooth-scroll-enabled");
		};
	}, [smoothScrollActive]);

	const options = useMemo(
		() => (smoothScrollActive ? LENIS_SMOOTH : LENIS_NATIVE),
		[smoothScrollActive],
	);

	const preferenceValue = useMemo(
		(): SmoothScrollPreferenceValue => ({
			smoothScrollEnabled,
			setSmoothScrollEnabled,
			preferencesLoaded,
		}),
		[smoothScrollEnabled, preferencesLoaded],
	);

	return (
		<SmoothScrollPreferenceContext.Provider value={preferenceValue}>
			<ReactLenis root options={options}>
				{children}
			</ReactLenis>
		</SmoothScrollPreferenceContext.Provider>
	);
}
