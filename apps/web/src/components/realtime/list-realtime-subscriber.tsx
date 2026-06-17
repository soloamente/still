"use client";

import { listRoomId, type RealtimeEvent } from "@still/realtime";
import { useRef } from "react";

import { useRegisterRealtimeRoom } from "@/components/realtime/realtime-root-provider";
import { useRealtimeSubscription } from "@/hooks/use-realtime-subscription";

function realtimeClientEnabled(): boolean {
	return process.env.NEXT_PUBLIC_REALTIME_ENABLED !== "false";
}

/**
 * Registers the list room on the app-shell SSE connection and fans out events.
 * Uses the shared RealtimeRootProvider socket instead of a second EventSource.
 */
export function ListRealtimeSubscriber({
	listId,
	enabled,
	onEvent,
}: {
	listId: string;
	enabled: boolean;
	onEvent: (event: RealtimeEvent) => void;
}) {
	const onEventRef = useRef(onEvent);
	onEventRef.current = onEvent;

	const active = enabled && Boolean(listId) && realtimeClientEnabled();
	const room = active ? listRoomId(listId) : null;

	useRegisterRealtimeRoom(room);

	useRealtimeSubscription({
		room: room ?? "",
		enabled: active,
		onEvent: (event) => {
			onEventRef.current(event);
		},
	});

	return null;
}
