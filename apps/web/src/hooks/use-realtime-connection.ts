"use client";

import { useContext } from "react";

import { RealtimeContext } from "@/components/realtime/realtime-root-provider";

/**
 * Whether the patron's realtime connection is open.
 * Drop-in replacement for `useLiveblocksConnection` on Wave 1 surfaces.
 */
export function useRealtimeConnection(): boolean {
	const ctx = useContext(RealtimeContext);
	return ctx?.connected ?? false;
}

export function useRealtimeHeartbeat(): {
	transport: "ws" | "sse";
	sendHeartbeat: (room: string, activityState: "active" | "away") => boolean;
} {
	const ctx = useContext(RealtimeContext);
	return {
		transport: ctx?.transport ?? "sse",
		sendHeartbeat: ctx?.sendHeartbeat ?? (() => false),
	};
}
