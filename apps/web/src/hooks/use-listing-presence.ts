"use client";

import { listingMovieRoomId, listingTvRoomId } from "@still/realtime";
import { useCallback, useEffect, useRef, useState } from "react";

import { useRegisterRealtimeRoom } from "@/components/realtime/realtime-root-provider";
import {
	usePatronActivityFlipHeartbeat,
	useReadAggregatePatronActivityState,
} from "@/hooks/use-patron-activity-tracker";
import {
	useRealtimeConnection,
	useRealtimeHeartbeat,
} from "@/hooks/use-realtime-connection";
import { useRealtimeSubscription } from "@/hooks/use-realtime-subscription";
import {
	fetchListingPresenceSnapshot,
	type ListingPresenceSnapshot,
	leaveListingPresenceClient,
	touchListingPresenceClient,
} from "@/lib/fetch-listing-presence";
import { createPresenceHeartbeatScheduler } from "@/lib/presence-heartbeat-scheduler";
import { trackSenseProductEvent } from "@/lib/sense-product-analytics";

const HEARTBEAT_MS = 25_000;
const POLL_MS = 30_000;
/**
 * Hard floor between presence-event-driven snapshot refetches. A popular title's
 * room emits `presence.updated` repeatedly as viewers flip active/away; a debounce
 * never settles under a continuous stream, so use a min-interval throttle to cap
 * the server→Worker→Neon refetch rate.
 */
const REFETCH_THROTTLE_MS = 8_000;

export type ListingPresenceSurface = "movie" | "tv";

const EMPTY_SNAPSHOT: ListingPresenceSnapshot = {
	viewerCount: 0,
	viewingPatrons: [],
};

function realtimeClientEnabled(): boolean {
	return process.env.NEXT_PUBLIC_REALTIME_ENABLED !== "false";
}

/** Build the listing SSE room id from kind + TMDb id when `roomId` is omitted. */
export function resolveListingPresenceRoomId(
	listingKind: ListingPresenceSurface,
	listingId: number | string,
): string {
	return listingKind === "movie"
		? listingMovieRoomId(listingId)
		: listingTvRoomId(listingId);
}

/**
 * Heartbeat + leave lifecycle for movie/TV detail presence.
 * Registers the listing room on the app-shell SSE socket and refetches on
 * `presence.updated`; polls when disconnected.
 */
export function useListingPresence({
	roomId: roomIdProp,
	listingKind,
	listingId,
	enabled = true,
}: {
	roomId?: string;
	listingKind: ListingPresenceSurface;
	listingId: number | string;
	enabled?: boolean;
}): ListingPresenceSnapshot {
	const roomId =
		roomIdProp ?? resolveListingPresenceRoomId(listingKind, listingId);
	const connected = useRealtimeConnection();
	const { transport, sendHeartbeat } = useRealtimeHeartbeat();
	const active = enabled && Boolean(roomId) && realtimeClientEnabled();
	const readAggregatePatronActivityState =
		useReadAggregatePatronActivityState();
	const heartbeatSchedulerRef = useRef<ReturnType<
		typeof createPresenceHeartbeatScheduler
	> | null>(null);

	const [snapshot, setSnapshot] =
		useState<ListingPresenceSnapshot>(EMPTY_SNAPSHOT);

	const joinedRef = useRef(false);
	const leftRef = useRef(false);
	const refetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const lastRefetchRef = useRef(0);

	const refetchSnapshot = useCallback(
		async (signal?: AbortSignal) => {
			const next = await fetchListingPresenceSnapshot(roomId, signal);
			if (!next) return;
			setSnapshot(next);
		},
		[roomId],
	);

	// Throttle (not debounce): one refetch per REFETCH_THROTTLE_MS regardless of how
	// many presence.updated events arrive, guaranteeing a hard ceiling on refetch rate.
	const scheduleRefetch = useCallback(() => {
		if (refetchTimerRef.current) return;
		const elapsed = Date.now() - lastRefetchRef.current;
		const delay = Math.max(0, REFETCH_THROTTLE_MS - elapsed);
		refetchTimerRef.current = setTimeout(() => {
			refetchTimerRef.current = null;
			lastRefetchRef.current = Date.now();
			void refetchSnapshot();
		}, delay);
	}, [refetchSnapshot]);

	const leavePresence = useCallback(
		(opts?: { keepalive?: boolean; trackLeave?: boolean }) => {
			if (leftRef.current) return;
			leftRef.current = true;

			if (opts?.trackLeave !== false && joinedRef.current) {
				joinedRef.current = false;
				trackSenseProductEvent("realtime.presence.leave", {
					surface: listingKind,
					listingId: String(listingId),
				});
			}

			void leaveListingPresenceClient(roomId, {
				keepalive: opts?.keepalive,
			});
		},
		[listingId, listingKind, roomId],
	);

	usePatronActivityFlipHeartbeat((state) => {
		if (!active || leftRef.current) return;
		heartbeatSchedulerRef.current?.onActivityChange(state);
	}, active);

	useRegisterRealtimeRoom(active ? roomId : null);

	useRealtimeSubscription({
		room: roomId,
		enabled: active,
		onEvent: (event) => {
			if (event.type !== "presence.updated") return;
			scheduleRefetch();
		},
	});

	// Initial snapshot, heartbeat loop, and cleanup leave.
	useEffect(() => {
		if (!active) {
			setSnapshot(EMPTY_SNAPSHOT);
			joinedRef.current = false;
			leftRef.current = false;
			return;
		}

		leftRef.current = false;
		let unmounted = false;
		const abort = new AbortController();

		const scheduler = createPresenceHeartbeatScheduler(
			readAggregatePatronActivityState,
			async (state, opts) => {
				// WS updates the Worker DO; HTTP POST updates Upstash Redis — always
				// mirror patron-online-provider and post both when WS is connected.
				if (transport === "ws" && !opts?.keepalive) {
					sendHeartbeat(roomId, state);
				}
				const ok = await touchListingPresenceClient(roomId, state, opts);
				if (!ok || unmounted) return false;

				if (!joinedRef.current) {
					joinedRef.current = true;
					trackSenseProductEvent("realtime.presence.join", {
						surface: listingKind,
						listingId: String(listingId),
					});
				}

				await refetchSnapshot(abort.signal);
				return true;
			},
		);
		heartbeatSchedulerRef.current = scheduler;
		void scheduler.tick();

		const heartbeatTimer = setInterval(() => {
			if (!unmounted) void scheduler.tick();
		}, HEARTBEAT_MS);

		return () => {
			unmounted = true;
			abort.abort();
			clearInterval(heartbeatTimer);
			scheduler.dispose();
			heartbeatSchedulerRef.current = null;
			if (refetchTimerRef.current) {
				clearTimeout(refetchTimerRef.current);
				refetchTimerRef.current = null;
			}
			leavePresence();
		};
	}, [
		active,
		leavePresence,
		listingId,
		listingKind,
		readAggregatePatronActivityState,
		refetchSnapshot,
		roomId,
		sendHeartbeat,
		transport,
	]);

	// Keepalive leave when the tab closes before React cleanup runs.
	useEffect(() => {
		if (!active) return;

		const onPageHide = () => {
			leavePresence({ keepalive: true, trackLeave: false });
		};

		window.addEventListener("pagehide", onPageHide);
		return () => window.removeEventListener("pagehide", onPageHide);
	}, [active, leavePresence]);

	// Poll fallback while SSE is disconnected.
	useEffect(() => {
		if (!active || connected) return;

		const pollTimer = setInterval(() => {
			void refetchSnapshot();
		}, POLL_MS);

		return () => clearInterval(pollTimer);
	}, [active, connected, refetchSnapshot]);

	return snapshot;
}
