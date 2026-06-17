"use client";

import type { RealtimeEvent } from "@still/realtime";
import { useContext, useEffect, useRef } from "react";

import { RealtimeContext } from "@/components/realtime/realtime-root-provider";

/** Subscribe to realtime events for a single logical room id. */
export function useRealtimeSubscription({
	room,
	onEvent,
	enabled = true,
}: {
	room: string;
	onEvent: (event: RealtimeEvent) => void;
	enabled?: boolean;
}) {
	const ctx = useContext(RealtimeContext);
	const onEventRef = useRef(onEvent);
	onEventRef.current = onEvent;

	useEffect(() => {
		if (!ctx || !enabled || !room) return;
		return ctx.subscribe(room, (event) => {
			onEventRef.current(event);
		});
	}, [ctx, enabled, room]);
}
