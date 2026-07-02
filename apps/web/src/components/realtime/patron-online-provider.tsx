"use client";

import { patronAppRoomId } from "@still/realtime";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useRegisterRealtimeRoom } from "@/components/realtime/realtime-root-provider";
import {
	useAggregatePatronActivityState,
	usePatronActivityFlipHeartbeat,
	useReadAggregatePatronActivityState,
} from "@/hooks/use-patron-activity-tracker";
import { useRealtimeHeartbeat } from "@/hooks/use-realtime-connection";
import { useRealtimeSubscription } from "@/hooks/use-realtime-subscription";
import {
	fetchPatronOnlineHandles,
	isPatronPresenceHandle,
	leavePatronAppPresenceClient,
	normalizePatronOnlineHandle,
	normalizePatronPresenceSnapshot,
	touchPatronAppPresenceClient,
} from "@/lib/fetch-patron-online";
import { createPresenceHeartbeatScheduler } from "@/lib/presence-heartbeat-scheduler";

const HEARTBEAT_MS = 25_000;
const POLL_MS = 30_000;
/** Coalesce portrait registrations into one batch lookup. */
const REGISTER_REFRESH_DEBOUNCE_MS = 200;
/**
 * Hard floor between presence-event-driven `/online` refetches. The global
 * `patron:app` room emits `presence.updated` many times per second across all
 * users; without this throttle each event would fire its own server→Worker→Neon
 * round-trip (a ~3 req/s storm). Throttling keeps the live feel while capping load.
 */
const PRESENCE_EVENT_REFRESH_THROTTLE_MS = 10_000;

type PatronOnlineContextValue = {
	registerHandle: (handle: string) => () => void;
	isOnline: (handle: string | null | undefined) => boolean;
	getPresenceState: (
		handle: string | null | undefined,
	) => "active" | "away" | null;
	viewerHandle: string | null;
};

const PatronOnlineContext = createContext<PatronOnlineContextValue | null>(
	null,
);

function realtimeClientEnabled(): boolean {
	return process.env.NEXT_PUBLIC_REALTIME_ENABLED !== "false";
}

/**
 * App-wide patron online status — heartbeats while signed in and batches
 * online lookups for avatars that register a handle.
 */
export function PatronOnlineProvider({
	children,
	viewerHandle,
}: {
	children: ReactNode;
	/** Normalized handle for self presence labels and batch registration. */
	viewerHandle?: string | null;
}) {
	const active = realtimeClientEnabled();
	const { transport, sendHeartbeat } = useRealtimeHeartbeat();
	const aggregateActivityState = useAggregatePatronActivityState();
	const readAggregatePatronActivityState =
		useReadAggregatePatronActivityState();
	const heartbeatSchedulerRef = useRef<ReturnType<
		typeof createPresenceHeartbeatScheduler
	> | null>(null);
	const viewerHandleKey = viewerHandle
		? normalizePatronOnlineHandle(viewerHandle)
		: null;

	const registeredRef = useRef(new Set<string>());
	const refreshOnlineHandlesRef = useRef<(() => void) | null>(null);
	const registerRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
		null,
	);
	const presenceEventDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(
		null,
	);
	const lastPresenceRefreshRef = useRef(0);
	const [presenceByHandle, setPresenceByHandle] = useState<
		ReadonlyMap<string, "active" | "away">
	>(() => new Map());
	const leftRef = useRef(false);

	const scheduleRegisterRefresh = useCallback(() => {
		if (registerRefreshTimerRef.current) {
			clearTimeout(registerRefreshTimerRef.current);
		}
		registerRefreshTimerRef.current = setTimeout(() => {
			registerRefreshTimerRef.current = null;
			refreshOnlineHandlesRef.current?.();
		}, REGISTER_REFRESH_DEBOUNCE_MS);
	}, []);

	// Throttle (not debounce): coalesce the steady stream of `presence.updated`
	// events into at most one `/online` refetch per PRESENCE_EVENT_REFRESH_THROTTLE_MS.
	// A debounce would never settle under a continuous event stream; a min-interval
	// throttle guarantees a hard ceiling on refetch rate.
	const scheduleRefreshFromPresenceEvent = useCallback(() => {
		if (presenceEventDebounceRef.current) return;
		const elapsed = Date.now() - lastPresenceRefreshRef.current;
		const delay = Math.max(0, PRESENCE_EVENT_REFRESH_THROTTLE_MS - elapsed);
		presenceEventDebounceRef.current = setTimeout(() => {
			presenceEventDebounceRef.current = null;
			lastPresenceRefreshRef.current = Date.now();
			refreshOnlineHandlesRef.current?.();
		}, delay);
	}, []);

	useRegisterRealtimeRoom(active ? patronAppRoomId() : null);

	useRealtimeSubscription({
		room: patronAppRoomId(),
		enabled: active,
		onEvent: (event) => {
			if (event.type !== "presence.updated") return;
			scheduleRefreshFromPresenceEvent();
		},
	});

	const registerHandle = useCallback(
		(rawHandle: string) => {
			const handle = normalizePatronOnlineHandle(rawHandle);
			if (!handle || !isPatronPresenceHandle(handle)) return () => {};

			const alreadyRegistered = registeredRef.current.has(handle);
			registeredRef.current.add(handle);
			if (!alreadyRegistered) {
				scheduleRegisterRefresh();
				// Portraits mount after this provider's effects — nudge an immediate
				// batch lookup instead of waiting for the debounce/poll window.
				queueMicrotask(() => {
					refreshOnlineHandlesRef.current?.();
				});
			}
			return () => {
				registeredRef.current.delete(handle);
			};
		},
		[scheduleRegisterRefresh],
	);

	const getPresenceState = useCallback(
		(rawHandle: string | null | undefined) => {
			if (!rawHandle) return null;
			const handle = normalizePatronOnlineHandle(rawHandle);
			if (!handle) return null;
			const serverState = presenceByHandle.get(handle);
			if (serverState) return serverState;
			// Self dot: show local active/away immediately while the server mirror
			// catches up after the first heartbeat (avoids mount race with /online).
			if (viewerHandleKey && handle === viewerHandleKey) {
				return aggregateActivityState;
			}
			return null;
		},
		[presenceByHandle, viewerHandleKey, aggregateActivityState],
	);

	const isOnline = useCallback(
		(rawHandle: string | null | undefined) => {
			return getPresenceState(rawHandle) != null;
		},
		[getPresenceState],
	);

	const leavePresence = useCallback((opts?: { keepalive?: boolean }) => {
		if (leftRef.current) return;
		leftRef.current = true;
		void leavePatronAppPresenceClient({ keepalive: opts?.keepalive });
	}, []);

	// Aggregate flips + periodic heartbeats — debounced away, immediate active.
	usePatronActivityFlipHeartbeat((state) => {
		if (!active || leftRef.current) return;
		heartbeatSchedulerRef.current?.onActivityChange(state);
	}, active);

	// Global heartbeat while the signed-in app shell is mounted.
	useEffect(() => {
		if (!active) return;

		leftRef.current = false;
		let unmounted = false;

		const scheduler = createPresenceHeartbeatScheduler(
			readAggregatePatronActivityState,
			async (state, opts) => {
				// WS updates the Worker DO; HTTP POST updates Upstash Redis. Production
				// reads merge both — skipping Redis when WS succeeds hid the self dot.
				if (transport === "ws" && !opts?.keepalive) {
					sendHeartbeat(patronAppRoomId(), state);
				}
				const ok = await touchPatronAppPresenceClient(state, opts);
				if (ok) {
					refreshOnlineHandlesRef.current?.();
				}
				return ok;
			},
		);
		heartbeatSchedulerRef.current = scheduler;
		void (async () => {
			await scheduler.tick();
			if (!unmounted) {
				refreshOnlineHandlesRef.current?.();
			}
		})();

		const heartbeatTimer = setInterval(() => {
			if (!unmounted) void scheduler.tick();
		}, HEARTBEAT_MS);

		return () => {
			unmounted = true;
			clearInterval(heartbeatTimer);
			scheduler.dispose();
			heartbeatSchedulerRef.current = null;
			leavePresence();
		};
	}, [
		active,
		leavePresence,
		readAggregatePatronActivityState,
		sendHeartbeat,
		transport,
	]);

	useEffect(() => {
		if (!active) return;

		const onPageHide = () => {
			leavePresence({ keepalive: true });
		};

		window.addEventListener("pagehide", onPageHide);
		return () => window.removeEventListener("pagehide", onPageHide);
	}, [active, leavePresence]);

	// Keep the viewer handle in batch lookups so self dot uses server mirror state.
	useEffect(() => {
		if (!viewerHandleKey || !isPatronPresenceHandle(viewerHandleKey)) return;
		return registerHandle(viewerHandleKey);
	}, [registerHandle, viewerHandleKey]);

	// Batch-resolve online handles for every portrait that registered interest.
	useEffect(() => {
		if (!active) {
			setPresenceByHandle(new Map());
			refreshOnlineHandlesRef.current = null;
			return;
		}

		let unmounted = false;
		const abort = new AbortController();

		const refreshOnlineHandles = async () => {
			const handles = Array.from(registeredRef.current);
			// Portraits register in child effects after this provider mounts — an empty
			// batch on first paint must not wipe optimistic self state.
			if (handles.length === 0) {
				return;
			}

			try {
				const snapshot = await fetchPatronOnlineHandles(handles, abort.signal);
				if (!snapshot || unmounted) return;
				setPresenceByHandle(normalizePatronPresenceSnapshot(snapshot));
			} catch {
				// Presence is best-effort — keep the last known snapshot on failure.
			}
		};

		refreshOnlineHandlesRef.current = () => {
			void refreshOnlineHandles();
		};

		void refreshOnlineHandles();
		const pollTimer = setInterval(() => {
			void refreshOnlineHandles();
		}, POLL_MS);

		return () => {
			unmounted = true;
			refreshOnlineHandlesRef.current = null;
			if (registerRefreshTimerRef.current) {
				clearTimeout(registerRefreshTimerRef.current);
				registerRefreshTimerRef.current = null;
			}
			if (presenceEventDebounceRef.current) {
				clearTimeout(presenceEventDebounceRef.current);
				presenceEventDebounceRef.current = null;
			}
			abort.abort();
			clearInterval(pollTimer);
		};
	}, [active]);

	const value = useMemo(
		() => ({
			registerHandle,
			isOnline,
			getPresenceState,
			viewerHandle: viewerHandleKey,
		}),
		[registerHandle, isOnline, getPresenceState, viewerHandleKey],
	);

	return (
		<PatronOnlineContext.Provider value={value}>
			{children}
		</PatronOnlineContext.Provider>
	);
}

/** Register a portrait handle and read whether it is online for the viewer. */
export function usePatronOnlineStatus(
	handle: string | null | undefined,
	enabled = true,
): boolean {
	const context = useContext(PatronOnlineContext);

	useEffect(() => {
		if (!context || !enabled || !handle?.trim()) return;
		return context.registerHandle(handle);
	}, [context, enabled, handle]);

	if (!context || !enabled || !handle?.trim()) return false;
	return context.isOnline(handle);
}

/** Active/away state for a registered portrait handle (null when offline or hidden). */
export function usePatronPresenceState(
	handle: string | null | undefined,
	enabled = true,
): "active" | "away" | null {
	const context = useContext(PatronOnlineContext);

	useEffect(() => {
		if (!context || !enabled || !handle?.trim()) return;
		return context.registerHandle(handle);
	}, [context, enabled, handle]);

	if (!context || !enabled || !handle?.trim()) return null;
	return context.getPresenceState(handle);
}

/** Normalized signed-in viewer handle for self presence labels. */
export function useViewerHandleForPresence(): string | null {
	return useContext(PatronOnlineContext)?.viewerHandle ?? null;
}
