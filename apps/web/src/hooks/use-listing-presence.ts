"use client";

import { listingMovieRoomId, listingTvRoomId } from "@still/realtime";
import { useCallback, useEffect, useRef, useState } from "react";

import { useRegisterRealtimeRoom } from "@/components/realtime/realtime-root-provider";
import {
	usePatronActivityFlipHeartbeat,
	useReadPatronActivityState,
} from "@/hooks/use-patron-activity-tracker";
import { useRealtimeConnection } from "@/hooks/use-realtime-connection";
import { useRealtimeSubscription } from "@/hooks/use-realtime-subscription";
import {
	fetchListingPresenceSnapshot,
	type ListingPresenceSnapshot,
	leaveListingPresenceClient,
	touchListingPresenceClient,
} from "@/lib/fetch-listing-presence";
import { resolvePresenceHeartbeatActivityState } from "@/lib/patron-activity-tracker";
import { trackSenseProductEvent } from "@/lib/sense-product-analytics";

const HEARTBEAT_MS = 25_000;
const POLL_MS = 20_000;
const REFETCH_DEBOUNCE_MS = 300;

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
	const active = enabled && Boolean(roomId) && realtimeClientEnabled();
	const readPatronActivityState = useReadPatronActivityState();

	const [snapshot, setSnapshot] =
		useState<ListingPresenceSnapshot>(EMPTY_SNAPSHOT);

	const joinedRef = useRef(false);
	const leftRef = useRef(false);
	const refetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const refetchSnapshot = useCallback(
		async (signal?: AbortSignal) => {
			const next = await fetchListingPresenceSnapshot(roomId, signal);
			if (!next) return;
			setSnapshot(next);
		},
		[roomId],
	);

	const scheduleRefetch = useCallback(() => {
		if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current);
		refetchTimerRef.current = setTimeout(() => {
			refetchTimerRef.current = null;
			void refetchSnapshot();
		}, REFETCH_DEBOUNCE_MS);
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
		const heartbeatState = resolvePresenceHeartbeatActivityState(state);
		void touchListingPresenceClient(roomId, heartbeatState, {
			keepalive: typeof document !== "undefined" && document.hidden,
		});
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

		const runHeartbeat = async () => {
			const heartbeatState = resolvePresenceHeartbeatActivityState(
				readPatronActivityState(),
			);
			const ok = await touchListingPresenceClient(roomId, heartbeatState, {
				keepalive: typeof document !== "undefined" && document.hidden,
			});
			if (!ok || unmounted) return;

			if (!joinedRef.current) {
				joinedRef.current = true;
				trackSenseProductEvent("realtime.presence.join", {
					surface: listingKind,
					listingId: String(listingId),
				});
			}

			await refetchSnapshot(abort.signal);
		};

		void runHeartbeat();
		const heartbeatTimer = setInterval(() => {
			void runHeartbeat();
		}, HEARTBEAT_MS);

		return () => {
			unmounted = true;
			abort.abort();
			clearInterval(heartbeatTimer);
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
		readPatronActivityState,
		refetchSnapshot,
		roomId,
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
