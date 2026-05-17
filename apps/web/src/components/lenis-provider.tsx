"use client";

import type { LenisOptions } from "lenis";
import "lenis/dist/lenis.css";
import { ReactLenis } from "lenis/react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

/** Default feel — slightly softer than Lenis’ stock `lerp` so long pages don’t overshoot on fast wheels. */
const LENIS_SMOOTH: LenisOptions = {
	autoRaf: true,
	smoothWheel: true,
	lerp: 0.09,
	wheelMultiplier: 1,
	touchMultiplier: 1,
	/** Next.js client navigations: kill wheel inertia so the new route doesn’t “coast” from the old one. */
	stopInertiaOnNavigate: true,
};

/** Respect OS “reduce motion” — keep Lenis mounted (stable tree) but turn off wheel smoothing / inertia. */
const LENIS_REDUCED: LenisOptions = {
	autoRaf: true,
	smoothWheel: false,
	lerp: 1,
	stopInertiaOnNavigate: true,
};

/**
 * Global smooth scrolling (Lenis). `root` mode attaches to `window` / `document.documentElement`
 * without wrapping `{children}` in extra scroll divs — see `lenis/react` implementation.
 */
export function LenisProvider({ children }: { children: ReactNode }) {
	const [options, setOptions] = useState<LenisOptions>(LENIS_SMOOTH);

	useEffect(() => {
		const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
		const sync = () => setOptions(mq.matches ? LENIS_REDUCED : LENIS_SMOOTH);
		sync();
		mq.addEventListener("change", sync);
		return () => mq.removeEventListener("change", sync);
	}, []);

	return (
		<ReactLenis root options={options}>
			{children}
		</ReactLenis>
	);
}
