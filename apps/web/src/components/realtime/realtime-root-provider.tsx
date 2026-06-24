"use client";

import type { RealtimeEvent } from "@still/realtime";
import { parseRealtimeEvent, userInboxRoomId } from "@still/realtime";
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
	transport: "ws" | "sse";
	subscribe: (
		room: string,
		onEvent: (event: RealtimeEvent) => void,
	) => () => void;
	sendHeartbeat: (room: string, activityState: "active" | "away") => boolean;
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

function realtimeTransport(): "ws" | "sse" {
	if (
		process.env.NEXT_PUBLIC_REALTIME_TRANSPORT === "ws" &&
		process.env.NEXT_PUBLIC_REALTIME_WS_URL
	) {
		return "ws";
	}
	return "sse";
}

/** Build the multiplexed SSE URL for the patron's subscribed rooms. */
export function buildRealtimeStreamUrl(rooms: string[]): string {
	const params = new URLSearchParams({ rooms: rooms.join(",") });
	return `/api/realtime/stream?${params.toString()}`;
}

/** Register a logical room on the shared app-shell socket (e.g. open list detail). */
export function useRegisterRealtimeRoom(room: string | null | undefined): void {
	const ctx = useContext(RealtimeRoomsRegistrationContext);

	useEffect(() => {
		if (!ctx || !room) return;
		return ctx.registerRoom(room);
	}, [ctx, room]);
}

async function fetchConnectToken(): Promise<string | null> {
	try {
		const res = await fetch("/api/realtime/token");
		if (!res.ok) return null;
		const data = (await res.json()) as { token?: string };
		return data.token ?? null;
	} catch {
		return null;
	}
}

/**
 * One socket per signed-in app shell; fans out parsed events to room listeners.
 * Inbox is always subscribed; surfaces register extra rooms while mounted.
 * Transport is controlled by NEXT_PUBLIC_REALTIME_TRANSPORT (default: sse).
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
	const wsRef = useRef<WebSocket | null>(null);
	const transport = realtimeTransport();

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
		setRegisteredVersion((v) => v + 1);
		return () => {
			registeredRoomsRef.current.delete(room);
			setRegisteredVersion((v) => v + 1);
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

	const sendHeartbeat = useCallback(
		(room: string, activityState: "active" | "away"): boolean => {
			const ws = wsRef.current;
			if (!ws || ws.readyState !== WebSocket.OPEN) return false;
			ws.send(JSON.stringify({ kind: "heartbeat", room, activityState }));
			return true;
		},
		[],
	);

	const dispatch = useCallback((room: string, event: RealtimeEvent) => {
		for (const listener of listenersRef.current) {
			if (listener.room === room) listener.onEvent(event);
		}
	}, []);

	// SSE transport
	useEffect(() => {
		if (transport !== "sse") return;
		if (!userId || !realtimeClientEnabled()) {
			setConnected(false);
			return;
		}

		let unmounted = false;
		let source: EventSource | null = null;
		let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
		let reconnectAttempt = 0;

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
	}, [subscribedRooms, userId, transport, dispatch]);

	// WS transport
	useEffect(() => {
		if (transport !== "ws") return;
		if (!userId || !realtimeClientEnabled()) {
			setConnected(false);
			return;
		}

		const wsUrl = process.env.NEXT_PUBLIC_REALTIME_WS_URL;
		if (!wsUrl) return;

		let unmounted = false;
		let ws: WebSocket | null = null;
		let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
		let reconnectAttempt = 0;
		let pingTimer: ReturnType<typeof setInterval> | null = null;

		const scheduleReconnect = () => {
			if (unmounted) return;
			const delay = Math.min(
				INITIAL_RECONNECT_MS * 2 ** reconnectAttempt,
				MAX_RECONNECT_MS,
			);
			reconnectAttempt += 1;
			reconnectTimer = setTimeout(() => void connect(), delay);
		};

		const connect = async () => {
			if (unmounted) return;
			ws?.close();
			wsRef.current = null;

			const token = await fetchConnectToken();
			if (!token || unmounted) {
				scheduleReconnect();
				return;
			}

			const params = new URLSearchParams({
				token,
				rooms: subscribedRooms.join(","),
			});
			const socket = new WebSocket(`${wsUrl}/connect?${params.toString()}`);
			ws = socket;
			wsRef.current = socket;

			socket.onopen = () => {
				if (unmounted) return;
				reconnectAttempt = 0;
				setConnected(true);
				pingTimer = setInterval(() => {
					if (socket.readyState === WebSocket.OPEN) {
						socket.send(JSON.stringify({ kind: "ping" }));
					}
				}, 30_000);
			};

			socket.onmessage = (raw) => {
				if (unmounted) return;
				try {
					const frame = JSON.parse(raw.data as string) as Record<
						string,
						unknown
					>;
					if (frame.kind === "event" && typeof frame.room === "string") {
						const event = parseRealtimeEvent(frame.event);
						if (event) dispatch(frame.room, event);
					}
				} catch {
					// Ignore malformed frames.
				}
			};

			socket.onclose = () => {
				if (unmounted) return;
				setConnected(false);
				wsRef.current = null;
				if (pingTimer) {
					clearInterval(pingTimer);
					pingTimer = null;
				}
				scheduleReconnect();
			};

			socket.onerror = () => {
				socket.close();
			};
		};

		void connect();

		return () => {
			unmounted = true;
			if (reconnectTimer) clearTimeout(reconnectTimer);
			if (pingTimer) clearInterval(pingTimer);
			ws?.close();
			wsRef.current = null;
			setConnected(false);
		};
	}, [userId, transport, dispatch]);

	// Send join/leave when subscribedRooms changes (WS only)
	const prevRoomsRef = useRef<string[]>([]);
	useEffect(() => {
		if (transport !== "ws") {
			prevRoomsRef.current = subscribedRooms;
			return;
		}
		const ws = wsRef.current;
		if (!ws || ws.readyState !== WebSocket.OPEN) {
			prevRoomsRef.current = subscribedRooms;
			return;
		}
		const prev = new Set(prevRoomsRef.current);
		const next = new Set(subscribedRooms);
		for (const room of next) {
			if (!prev.has(room)) ws.send(JSON.stringify({ kind: "join", room }));
		}
		for (const room of prev) {
			if (!next.has(room)) ws.send(JSON.stringify({ kind: "leave", room }));
		}
		prevRoomsRef.current = subscribedRooms;
	}, [subscribedRooms, transport]);

	const value = useMemo<RealtimeContextValue>(
		() => ({ connected, transport, subscribe, sendHeartbeat }),
		[connected, transport, subscribe, sendHeartbeat],
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
