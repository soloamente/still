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
	activityState: PatronActivityState;
	/** Synchronous read — updated inside visibilitychange before React re-renders. */
	readPatronActivityState: () => PatronActivityState;
	registerActivityFlipHandler: (handler: ActivityFlipHandler) => () => void;
};

const PatronActivityContext = createContext<PatronActivityContextValue | null>(
	null,
);

function usePatronActivityTracker(
	enabled: boolean,
	flipHandlersRef: RefObject<Set<ActivityFlipHandler>>,
	activityStateRef: RefObject<PatronActivityState>,
): PatronActivityState {
	const lastInputRef = useRef(Date.now());
	const prevStateRef = useRef<PatronActivityState | null>(null);
	const [activityState, setActivityState] =
		useState<PatronActivityState>("active");

	useEffect(() => {
		if (!enabled) {
			prevStateRef.current = null;
			activityStateRef.current = "active";
			setActivityState("active");
			return;
		}

		let throttleTimer: ReturnType<typeof setTimeout> | null = null;

		const notifyFlipHandlers = (next: PatronActivityState) => {
			for (const handler of flipHandlersRef.current) {
				handler(next);
			}
		};

		// Recompute synchronously — heartbeats must fire inside visibilitychange
		// before the browser throttles background-tab React effects.
		const recompute = () => {
			const next = derivePatronActivityState({
				nowMs: Date.now(),
				lastInputAtMs: lastInputRef.current,
				documentHidden: document.hidden,
			});
			const prev = prevStateRef.current;
			if (prev === next) return;

			prevStateRef.current = next;
			activityStateRef.current = next;
			setActivityState(next);

			if (shouldEmitPatronActivityFlip(prev, next)) {
				notifyFlipHandlers(next);
			}
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
			prevStateRef.current = null;
			activityStateRef.current = "active";
		};
	}, [activityStateRef, enabled, flipHandlersRef]);

	return activityState;
}

/** Single app-wide activity tracker — shared by global + listing presence heartbeats. */
export function PatronActivityProvider({ children }: { children: ReactNode }) {
	const flipHandlersRef = useRef(new Set<ActivityFlipHandler>());
	const activityStateRef = useRef<PatronActivityState>("active");
	const readPatronActivityState = useCallback(
		() => activityStateRef.current,
		[],
	);
	const activityState = usePatronActivityTracker(
		true,
		flipHandlersRef,
		activityStateRef,
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
			readPatronActivityState,
			registerActivityFlipHandler,
		}),
		[activityState, readPatronActivityState, registerActivityFlipHandler],
	);

	return (
		<PatronActivityContext.Provider value={contextValue}>
			{children}
		</PatronActivityContext.Provider>
	);
}

/** Current local active/away state for presence heartbeats. */
export function usePatronActivityState(): PatronActivityState {
	const context = useContext(PatronActivityContext);
	return context?.activityState ?? "active";
}

/** Synchronous activity read — safe inside visibilitychange / heartbeat timers. */
export function useReadPatronActivityState(): () => PatronActivityState {
	const context = useContext(PatronActivityContext);
	return context?.readPatronActivityState ?? (() => "active" as const);
}

/**
 * Fire presence heartbeats synchronously on active ↔ away flips (not via React
 * effects) so tab-away updates reach the server before background throttling.
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
