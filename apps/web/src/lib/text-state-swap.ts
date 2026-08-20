"use client";

import { useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";

function readTextSwapDurationMs(): number {
	if (typeof document === "undefined") return 150;
	const parsed = Number.parseFloat(
		getComputedStyle(document.documentElement)
			.getPropertyValue("--text-swap-dur")
			.trim(),
	);
	return Number.isFinite(parsed) ? parsed : 150;
}

/** transitions.dev text-states-swap — three-phase exit / swap / enter. */
export function runTextStateSwap(el: HTMLElement, next: string) {
	const dur = readTextSwapDurationMs();
	el.classList.add("is-exit");
	window.setTimeout(() => {
		el.textContent = next;
		el.classList.remove("is-exit");
		el.classList.add("is-enter-start");
		void el.offsetHeight;
		el.classList.remove("is-enter-start");
	}, dur);
}

/** Bind a `t-text-swap` span to a changing label. */
export function useTextStateSwap(text: string) {
	const reduceMotion = useReducedMotion();
	const ref = useRef<HTMLSpanElement>(null);
	const prev = useRef(text);

	useEffect(() => {
		const el = ref.current;
		if (!el || prev.current === text) return;
		prev.current = text;
		if (reduceMotion) {
			el.textContent = text;
			return;
		}
		runTextStateSwap(el, text);
	}, [reduceMotion, text]);

	return ref;
}
