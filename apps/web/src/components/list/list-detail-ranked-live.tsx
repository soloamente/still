"use client";

import type { RealtimeEvent } from "@still/realtime";
import { useCallback, useEffect, useMemo, useState } from "react";

import { itemIdsFromRows } from "@/components/list/list-detail-page-branching";
import {
	RankedListReorderGrid,
	type RankedListReorderRow,
} from "@/components/list/ranked-list-reorder-grid";
import { ListRealtimeSubscriber } from "@/components/realtime/list-realtime-subscriber";
import {
	filmRowOrderKey,
	sortFilmRowsByItemIds,
	subscribeListReorderedBroadcast,
} from "@/lib/list-reorder-live-sync";

/**
 * Ranked reorder grid with Redis SSE fan-out — collaborators see live rank updates.
 */
export function ListDetailRankedLive({
	listId,
	initialRows,
	allItemIds,
	systemKind = null,
	viewerCanEdit = false,
	canEditNotes = false,
}: {
	listId: string;
	initialRows: RankedListReorderRow[];
	allItemIds: string[];
	systemKind?: string | null;
	viewerCanEdit?: boolean;
	canEditNotes?: boolean;
}) {
	const initialKey = useMemo(
		() => itemIdsFromRows(initialRows).join("\u0001"),
		[initialRows],
	);
	const [rows, setRows] = useState(initialRows);

	useEffect(() => {
		setRows(initialRows);
	}, [initialKey, initialRows]);

	const applyRemoteOrder = useCallback((itemIds: string[]) => {
		setRows((current) => {
			const next = sortFilmRowsByItemIds(current, itemIds);
			if (filmRowOrderKey(next) === filmRowOrderKey(current)) return current;
			return next;
		});
	}, []);

	const handleRealtimeEvent = useCallback(
		(event: RealtimeEvent) => {
			if (event.type !== "list.reordered") return;
			applyRemoteOrder(event.itemIds);
		},
		[applyRemoteOrder],
	);

	useEffect(() => {
		return subscribeListReorderedBroadcast((broadcastListId, itemIds) => {
			if (broadcastListId !== listId) return;
			applyRemoteOrder(itemIds);
		});
	}, [applyRemoteOrder, listId]);

	return (
		<>
			<ListRealtimeSubscriber
				listId={listId}
				enabled
				onEvent={handleRealtimeEvent}
			/>
			<RankedListReorderGrid
				listId={listId}
				items={rows}
				allItemIds={allItemIds}
				canEditNotes={canEditNotes}
				systemKind={systemKind}
				viewerCanEdit={viewerCanEdit}
			/>
		</>
	);
}
