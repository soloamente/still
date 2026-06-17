"use client";

import { type RealtimeEvent, reviewRoomId } from "@still/realtime";
import { useEffect, useRef } from "react";

import { buildRealtimeStreamUrl } from "@/components/realtime/realtime-root-provider";
import { parseRealtimeSseMessage } from "@/lib/realtime-sse";

const INITIAL_RECONNECT_MS = 1_000;
const MAX_RECONNECT_MS = 30_000;

function realtimeClientEnabled(): boolean {
	return process.env.NEXT_PUBLIC_REALTIME_ENABLED !== "false";
}

/**
 * Dedicated SSE connection for one open review reader (v1 per-surface EventSource).
 * Tears down when the drawer closes or `reviewId` changes.
 */
export function ReviewRealtimeSubscriber({
	reviewId,
	enabled,
	onEvent,
}: {
	reviewId: string;
	enabled: boolean;
	onEvent: (event: RealtimeEvent) => void;
}) {
	const onEventRef = useRef(onEvent);
	onEventRef.current = onEvent;

	useEffect(() => {
		if (!enabled || !reviewId || !realtimeClientEnabled()) return;

		const room = reviewRoomId(reviewId);
		const url = buildRealtimeStreamUrl([room]);
		let unmounted = false;
		let source: EventSource | null = null;
		let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
		let reconnectAttempt = 0;

		const connect = () => {
			if (unmounted) return;
			source?.close();
			source = new EventSource(url);

			source.onopen = () => {
				reconnectAttempt = 0;
			};

			source.onmessage = (message) => {
				try {
					const parsed = parseRealtimeSseMessage(JSON.parse(message.data));
					if (!parsed || parsed.room !== room) return;
					onEventRef.current(parsed.event);
				} catch {
					// Ignore malformed frames — keep the stream alive.
				}
			};

			source.onerror = () => {
				source?.close();
				source = null;
				const delay = Math.min(
					INITIAL_RECONNECT_MS * 2 ** reconnectAttempt,
					MAX_RECONNECT_MS,
				);
				reconnectAttempt += 1;
				reconnectTimer = setTimeout(connect, delay);
			};
		};

		connect();

		return () => {
			unmounted = true;
			if (reconnectTimer) clearTimeout(reconnectTimer);
			source?.close();
		};
	}, [enabled, reviewId]);

	return null;
}
