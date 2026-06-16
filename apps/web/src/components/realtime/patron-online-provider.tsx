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
	usePatronActivityFlipHeartbeat,
	usePatronActivityState,
} from "@/hooks/use-patron-activity-tracker";
import { useRealtimeSubscription } from "@/hooks/use-realtime-subscription";
import {
	fetchPatronOnlineHandles,
	leavePatronAppPresenceClient,
	normalizePatronOnlineHandle,
	normalizePatronPresenceSnapshot,
	touchPatronAppPresenceClient,
} from "@/lib/fetch-patron-online";

const HEARTBEAT_MS = 25_000;
const POLL_MS = 20_000;
/** Coalesce portrait registrations into one batch lookup. */
const REGISTER_REFRESH_DEBOUNCE_MS = 200;

type PatronOnlineContextValue = {
	registerHandle: (handle: string) => () => void;
	isOnline: (handle: string | null | undefined) => boolean;
	getPresenceState: (
		handle: string | null | undefined,
	) => "active" | "away" | null;
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
	/** Hide the viewer's own online badge on their portrait surfaces. */
	viewerHandle?: string | null;
}) {
	const active = realtimeClientEnabled();
	const activityState = usePatronActivityState();
	const activityStateRef = useRef(activityState);
	activityStateRef.current = activityState;
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

	const scheduleRefreshFromPresenceEvent = useCallback(() => {
		if (presenceEventDebounceRef.current) {
			clearTimeout(presenceEventDebounceRef.current);
		}
		presenceEventDebounceRef.current = setTimeout(() => {
			presenceEventDebounceRef.current = null;
			refreshOnlineHandlesRef.current?.();
		}, REGISTER_REFRESH_DEBOUNCE_MS);
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
			if (!handle) return () => {};

			const alreadyRegistered = registeredRef.current.has(handle);
			registeredRef.current.add(handle);
			if (!alreadyRegistered) {
				scheduleRegisterRefresh();
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
			if (!handle || handle === viewerHandleKey) return null;
			return presenceByHandle.get(handle) ?? null;
		},
		[presenceByHandle, viewerHandleKey],
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

	// Synchronous flip heartbeats — must not wait for a background-tab React effect.
	usePatronActivityFlipHeartbeat((state) => {
		if (!active || leftRef.current) return;
		void touchPatronAppPresenceClient(state, {
			keepalive: typeof document !== "undefined" && document.hidden,
		});
	}, active);

	// Global heartbeat while the signed-in app shell is mounted.
	useEffect(() => {
		if (!active) return;

		leftRef.current = false;
		let unmounted = false;

		const runHeartbeat = async () => {
			if (unmounted) return;
			await touchPatronAppPresenceClient(activityStateRef.current);
		};

		void runHeartbeat();
		const heartbeatTimer = setInterval(() => {
			void runHeartbeat();
		}, HEARTBEAT_MS);

		return () => {
			unmounted = true;
			clearInterval(heartbeatTimer);
			leavePresence();
		};
	}, [active, leavePresence]);

	useEffect(() => {
		if (!active) return;

		const onPageHide = () => {
			leavePresence({ keepalive: true });
		};

		window.addEventListener("pagehide", onPageHide);
		return () => window.removeEventListener("pagehide", onPageHide);
	}, [active, leavePresence]);

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
			if (handles.length === 0) {
				if (!unmounted) setPresenceByHandle(new Map());
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
		}),
		[registerHandle, isOnline, getPresenceState],
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
