"use client";

import {
	createContext,
	type ReactNode,
	type RefObject,
	useCallback,
	useContext,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { PatronActivityTabSync } from "@/lib/patron-activity-tab-sync";
import {
	derivePatronActivityState,
	PATRON_ACTIVITY_INPUT_EVENTS,
	PATRON_ACTIVITY_INPUT_THROTTLE_MS,
	PATRON_ACTIVITY_RECOMPUTE_MS,
	type PatronActivityState,
	shouldEmitPatronActivityFlip,
} from "@/lib/patron-activity-tracker";

type ActivityFlipHandler = (state: PatronActivityState) => void;

type PatronActivityContextValue = {
	/** This tab only — hidden or idle on this tab. */
	activityState: PatronActivityState;
	/** All Sense tabs — active if any tab is active (used for presence heartbeats). */
	aggregateActivityState: PatronActivityState;
	readPatronActivityState: () => PatronActivityState;
	readAggregatePatronActivityState: () => PatronActivityState;
	registerActivityFlipHandler: (handler: ActivityFlipHandler) => () => void;
};

const PatronActivityContext = createContext<PatronActivityContextValue | null>(
	null,
);

function usePatronActivityTracker(
	enabled: boolean,
	localStateRef: RefObject<PatronActivityState>,
	tabSyncRef: RefObject<PatronActivityTabSync | null>,
): PatronActivityState {
	const lastInputRef = useRef(Date.now());
	const prevLocalStateRef = useRef<PatronActivityState | null>(null);
	const [activityState, setActivityState] =
		useState<PatronActivityState>("active");

	useEffect(() => {
		if (!enabled) {
			prevLocalStateRef.current = null;
			localStateRef.current = "active";
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
			const prev = prevLocalStateRef.current;
			if (prev === next) return;

			prevLocalStateRef.current = next;
			localStateRef.current = next;
			setActivityState(next);
			tabSyncRef.current?.publishLocalState(next);
		};

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
			prevLocalStateRef.current = null;
			localStateRef.current = "active";
		};
	}, [enabled, localStateRef, tabSyncRef]);

	return activityState;
}

/** Single app-wide activity tracker — shared by global + listing presence heartbeats. */
export function PatronActivityProvider({ children }: { children: ReactNode }) {
	const flipHandlersRef = useRef(new Set<ActivityFlipHandler>());
	const localStateRef = useRef<PatronActivityState>("active");
	const aggregateStateRef = useRef<PatronActivityState>("active");
	const tabSyncRef = useRef<PatronActivityTabSync | null>(null);
	const [aggregateActivityState, setAggregateActivityState] =
		useState<PatronActivityState>("active");

	if (tabSyncRef.current === null && typeof window !== "undefined") {
		tabSyncRef.current = new PatronActivityTabSync();
	}

	const readPatronActivityState = useCallback(() => localStateRef.current, []);
	const readAggregatePatronActivityState = useCallback(
		() => aggregateStateRef.current,
		[],
	);

	const notifyAggregateFlip = useCallback((next: PatronActivityState) => {
		const prev = aggregateStateRef.current;
		if (prev === next) return;
		aggregateStateRef.current = next;
		setAggregateActivityState(next);
		if (!shouldEmitPatronActivityFlip(prev, next)) return;
		for (const handler of flipHandlersRef.current) {
			handler(next);
		}
	}, []);

	useEffect(() => {
		const sync = tabSyncRef.current;
		if (!sync) return;

		const initial = sync.readAggregateState();
		aggregateStateRef.current = initial;
		setAggregateActivityState(initial);

		return sync.subscribe((next) => {
			notifyAggregateFlip(next);
		});
	}, [notifyAggregateFlip]);

	useEffect(() => {
		const sync = tabSyncRef.current;
		if (!sync) return;

		const onPageHide = () => {
			sync.publishLeave();
		};

		window.addEventListener("pagehide", onPageHide);
		return () => {
			window.removeEventListener("pagehide", onPageHide);
			sync.destroy();
			tabSyncRef.current = null;
		};
	}, []);

	const activityState = usePatronActivityTracker(
		true,
		localStateRef,
		tabSyncRef,
	);

	const registerActivityFlipHandler = useCallback(
		(handler: ActivityFlipHandler) => {
			flipHandlersRef.current.add(handler);
			return () => {
				flipHandlersRef.current.delete(handler);
			};
		},
		[],
	);

	const contextValue = useMemo(
		() => ({
			activityState,
			aggregateActivityState,
			readPatronActivityState,
			readAggregatePatronActivityState,
			registerActivityFlipHandler,
		}),
		[
			activityState,
			aggregateActivityState,
			readPatronActivityState,
			readAggregatePatronActivityState,
			registerActivityFlipHandler,
		],
	);

	return (
		<PatronActivityContext.Provider value={contextValue}>
			{children}
		</PatronActivityContext.Provider>
	);
}

/** Current local active/away state for this tab. */
export function usePatronActivityState(): PatronActivityState {
	const context = useContext(PatronActivityContext);
	return context?.activityState ?? "active";
}

/** User-global activity across all Sense tabs (for presence heartbeats). */
export function useAggregatePatronActivityState(): PatronActivityState {
	const context = useContext(PatronActivityContext);
	return context?.aggregateActivityState ?? "active";
}

/** Synchronous local activity read — safe inside visibilitychange. */
export function useReadPatronActivityState(): () => PatronActivityState {
	const context = useContext(PatronActivityContext);
	return context?.readPatronActivityState ?? (() => "active" as const);
}

/** Synchronous aggregate read — use before posting presence heartbeats. */
export function useReadAggregatePatronActivityState(): () => PatronActivityState {
	const context = useContext(PatronActivityContext);
	return context?.readAggregatePatronActivityState ?? (() => "active" as const);
}

/**
 * Fire presence heartbeats on aggregate active ↔ away flips (all tabs), not per-tab
 * noise during rapid visibility churn.
 */
export function usePatronActivityFlipHeartbeat(
	onFlip: (state: PatronActivityState) => void,
	enabled = true,
): void {
	const context = useContext(PatronActivityContext);
	const onFlipRef = useRef(onFlip);
	onFlipRef.current = onFlip;

	useLayoutEffect(() => {
		if (!context || !enabled) return;

		return context.registerActivityFlipHandler((state) => {
			onFlipRef.current(state);
		});
	}, [context, enabled]);
}
