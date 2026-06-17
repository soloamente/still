import type { ListDetailFilmRow } from "@/components/list/list-detail-films-grid";

const LIST_REORDER_BROADCAST_CHANNEL = "still-list-reorder";

/** Apply a remote ranked order to list film rows without a full refetch. */
export function sortFilmRowsByItemIds<T extends ListDetailFilmRow>(
	rows: T[],
	itemIds: string[],
): T[] {
	const rank = new Map(itemIds.map((id, index) => [id, index]));
	return [...rows].sort(
		(a, b) =>
			(rank.get(a.item.id) ?? Number.MAX_SAFE_INTEGER) -
			(rank.get(b.item.id) ?? Number.MAX_SAFE_INTEGER),
	);
}

/** Stable order key for React effects when only rank changes. */
export function filmRowOrderKey(
	rows: Pick<ListDetailFilmRow, "item">[],
): string {
	return rows.map((row) => row.item.id).join("\u0001");
}

/** Same-browser tab fan-out when SSE/dev relay misses a reorder (local dev fallback). */
export function broadcastListReordered(
	listId: string,
	itemIds: string[],
): void {
	if (typeof BroadcastChannel === "undefined") return;
	const channel = new BroadcastChannel(LIST_REORDER_BROADCAST_CHANNEL);
	channel.postMessage({ listId, itemIds });
	channel.close();
}

/** Listen for reorder broadcasts from other tabs on the same origin. */
export function subscribeListReorderedBroadcast(
	onReorder: (listId: string, itemIds: string[]) => void,
): () => void {
	if (typeof BroadcastChannel === "undefined") return () => {};
	const channel = new BroadcastChannel(LIST_REORDER_BROADCAST_CHANNEL);
	channel.onmessage = (message) => {
		const payload = message.data;
		if (
			typeof payload !== "object" ||
			payload === null ||
			typeof payload.listId !== "string" ||
			!Array.isArray(payload.itemIds) ||
			payload.itemIds.some((id: unknown) => typeof id !== "string")
		) {
			return;
		}
		onReorder(payload.listId, payload.itemIds);
	};
	return () => {
		channel.close();
	};
}
