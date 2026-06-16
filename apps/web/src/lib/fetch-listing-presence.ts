import type { DiaryMetalTier } from "@/lib/diary-metal-tier";
import type { PatronActivityState } from "@/lib/patron-activity-tracker";
import { buildPresenceHeartbeatBody } from "@/lib/patron-activity-tracker";
import { postPresenceHeartbeat } from "@/lib/presence-heartbeat-post";
import { stillApiOrigin } from "@/lib/still-api-origin";

/** Public-profile patron chip returned by GET /api/realtime/presence. */
export type ListingPresenceViewingPatron = {
	userId: string;
	handle: string;
	displayName: string;
	image: string | null;
	avatarIsAnimated: boolean;
	diaryMetalTier: DiaryMetalTier | null;
	/** Explicit server signal used to render online-now badges. */
	presenceState: "active" | "away";
};

export type ListingPresenceSnapshot = {
	viewerCount: number;
	viewingPatrons: ListingPresenceViewingPatron[];
};

function presenceApiUrl(): string {
	return `${stillApiOrigin()}/api/realtime/presence`;
}

/** Server-filtered occupancy snapshot for a listing room. */
export async function fetchListingPresenceSnapshot(
	roomId: string,
	signal?: AbortSignal,
): Promise<ListingPresenceSnapshot | null> {
	const url = new URL(presenceApiUrl());
	url.searchParams.set("room", roomId);

	const response = await fetch(url, {
		credentials: "include",
		cache: "no-store",
		signal,
	});

	if (!response.ok) return null;

	return (await response.json()) as ListingPresenceSnapshot;
}

/** Heartbeat — registers the patron in the listing room ZSET. */
export async function touchListingPresenceClient(
	roomId: string,
	activityState: PatronActivityState = "active",
	opts?: { keepalive?: boolean },
): Promise<boolean> {
	return postPresenceHeartbeat(
		buildPresenceHeartbeatBody(roomId, activityState),
		opts,
	);
}

/** Leave on unmount; `keepalive` survives abrupt tab close via `pagehide`. */
export async function leaveListingPresenceClient(
	roomId: string,
	opts?: { keepalive?: boolean },
): Promise<boolean> {
	const response = await fetch(presenceApiUrl(), {
		method: "DELETE",
		credentials: "include",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ room: roomId }),
		keepalive: opts?.keepalive ?? false,
	});

	return response.ok;
}
