"use client";

import { useEffect, useRef, useState } from "react";

import {
	derivePatronActivityState,
	PATRON_ACTIVITY_INPUT_EVENTS,
	PATRON_ACTIVITY_INPUT_THROTTLE_MS,
	PATRON_ACTIVITY_RECOMPUTE_MS,
	type PatronActivityState,
} from "@/lib/patron-activity-tracker";

/**
 * Tracks local patron input + tab visibility to derive active/away for heartbeats.
 * Shared by app-shell and listing presence providers.
 */
export function usePatronActivityTracker(enabled = true): PatronActivityState {
	const lastInputRef = useRef(Date.now());
	const [activityState, setActivityState] =
		useState<PatronActivityState>("active");

	useEffect(() => {
		if (!enabled) {
			setActivityState("active");
			return;
		}

		let throttleTimer: ReturnType<typeof setTimeout> | null = null;

		const recompute = () => {
			const next = derivePatronActivityState({
				nowMs: Date.now(),
				lastInputAtMs: lastInputRef.current,
				documentHidden: document.hidden,
			});
			setActivityState(next);
		};

		// Bump last-input time on patron interaction; throttle noisy events.
		const bumpInput = () => {
			lastInputRef.current = Date.now();
			recompute();
			if (throttleTimer) return;
			throttleTimer = setTimeout(() => {
				throttleTimer = null;
				recompute();
			}, PATRON_ACTIVITY_INPUT_THROTTLE_MS);
		};

		const onVisibility = () => recompute();

		for (const event of PATRON_ACTIVITY_INPUT_EVENTS) {
			window.addEventListener(event, bumpInput, { passive: true });
		}
		document.addEventListener("visibilitychange", onVisibility);
		const interval = setInterval(recompute, PATRON_ACTIVITY_RECOMPUTE_MS);
		recompute();

		return () => {
			for (const event of PATRON_ACTIVITY_INPUT_EVENTS) {
				window.removeEventListener(event, bumpInput);
			}
			document.removeEventListener("visibilitychange", onVisibility);
			clearInterval(interval);
			if (throttleTimer) clearTimeout(throttleTimer);
		};
	}, [enabled]);

	return activityState;
}
