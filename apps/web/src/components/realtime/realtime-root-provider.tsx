"use client";

import type { RealtimeEvent } from "@still/realtime";
import { userInboxRoomId } from "@still/realtime";
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

import { parseRealtimeSseMessage } from "@/lib/realtime-sse";

const INITIAL_RECONNECT_MS = 1_000;
const MAX_RECONNECT_MS = 30_000;

type RealtimeListener = {
	room: string;
	onEvent: (event: RealtimeEvent) => void;
};

export type RealtimeContextValue = {
	connected: boolean;
	subscribe: (
		room: string,
		onEvent: (event: RealtimeEvent) => void,
	) => () => void;
};

type RealtimeRoomsRegistrationContextValue = {
	registerRoom: (room: string) => () => void;
};

export const RealtimeContext = createContext<RealtimeContextValue | null>(null);

const RealtimeRoomsRegistrationContext =
	createContext<RealtimeRoomsRegistrationContextValue | null>(null);

function realtimeClientEnabled(): boolean {
	return process.env.NEXT_PUBLIC_REALTIME_ENABLED !== "false";
}

/** Build the multiplexed SSE URL for the patron's subscribed rooms. */
export function buildRealtimeStreamUrl(rooms: string[]): string {
	const params = new URLSearchParams({ rooms: rooms.join(",") });
	return `/api/realtime/stream?${params.toString()}`;
}

/** Register a logical room on the shared app-shell SSE connection (e.g. open list detail). */
export function useRegisterRealtimeRoom(room: string | null | undefined): void {
	const ctx = useContext(RealtimeRoomsRegistrationContext);

	useEffect(() => {
		if (!ctx || !room) return;
		return ctx.registerRoom(room);
	}, [ctx, room]);
}

/**
 * One EventSource per signed-in app shell; fans out parsed events to room listeners.
 * Inbox is always subscribed; surfaces register extra rooms while mounted.
 */
export function RealtimeRootProvider({
	userId,
	rooms,
	children,
}: {
	userId: string;
	rooms?: string[];
	children: ReactNode;
}) {
	const [connected, setConnected] = useState(false);
	const [registeredVersion, setRegisteredVersion] = useState(0);
	const listenersRef = useRef(new Set<RealtimeListener>());
	const registeredRoomsRef = useRef(new Set<string>());

	const baseRooms = useMemo(
		() => rooms ?? [userInboxRoomId(userId)],
		[rooms, userId],
	);

	const subscribedRooms = useMemo(() => {
		void registeredVersion;
		return [...new Set([...baseRooms, ...registeredRoomsRef.current])];
	}, [baseRooms, registeredVersion]);

	const registerRoom = useCallback((room: string) => {
		registeredRoomsRef.current.add(room);
		setRegisteredVersion((version) => version + 1);
		return () => {
			registeredRoomsRef.current.delete(room);
			setRegisteredVersion((version) => version + 1);
		};
	}, []);

	const subscribe = useCallback(
		(room: string, onEvent: (event: RealtimeEvent) => void) => {
			const listener: RealtimeListener = { room, onEvent };
			listenersRef.current.add(listener);
			return () => {
				listenersRef.current.delete(listener);
			};
		},
		[],
	);

	useEffect(() => {
		if (!userId || !realtimeClientEnabled()) {
			setConnected(false);
			return;
		}

		let unmounted = false;
		let source: EventSource | null = null;
		let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
		let reconnectAttempt = 0;

		const dispatch = (room: string, event: RealtimeEvent) => {
			for (const listener of listenersRef.current) {
				if (listener.room === room) {
					listener.onEvent(event);
				}
			}
		};

		const scheduleReconnect = () => {
			if (unmounted) return;
			const delay = Math.min(
				INITIAL_RECONNECT_MS * 2 ** reconnectAttempt,
				MAX_RECONNECT_MS,
			);
			reconnectAttempt += 1;
			reconnectTimer = setTimeout(connect, delay);
		};

		const connect = () => {
			if (unmounted) return;

			source?.close();
			source = new EventSource(buildRealtimeStreamUrl(subscribedRooms));

			source.onopen = () => {
				if (unmounted) return;
				reconnectAttempt = 0;
				setConnected(true);
			};

			source.onmessage = (message) => {
				if (unmounted) return;
				try {
					const parsed = parseRealtimeSseMessage(JSON.parse(message.data));
					if (!parsed) return;
					dispatch(parsed.room, parsed.event);
				} catch {
					// Ignore malformed SSE payloads.
				}
			};

			source.onerror = () => {
				if (unmounted) return;
				setConnected(false);
				source?.close();
				source = null;
				scheduleReconnect();
			};
		};

		connect();

		return () => {
			unmounted = true;
			if (reconnectTimer) clearTimeout(reconnectTimer);
			source?.close();
			setConnected(false);
		};
	}, [subscribedRooms, userId]);

	const value = useMemo<RealtimeContextValue>(
		() => ({ connected, subscribe }),
		[connected, subscribe],
	);

	const registrationValue = useMemo<RealtimeRoomsRegistrationContextValue>(
		() => ({ registerRoom }),
		[registerRoom],
	);

	return (
		<RealtimeRoomsRegistrationContext.Provider value={registrationValue}>
			<RealtimeContext.Provider value={value}>
				{children}
			</RealtimeContext.Provider>
		</RealtimeRoomsRegistrationContext.Provider>
	);
}
