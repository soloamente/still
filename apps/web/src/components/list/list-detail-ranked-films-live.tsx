"use client";

import type { RealtimeEvent } from "@still/realtime";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
	type ListDetailFilmRow,
	ListDetailFilmsGrid,
} from "@/components/list/list-detail-films-grid";
import { ListRealtimeSubscriber } from "@/components/realtime/list-realtime-subscriber";
import {
	filmRowOrderKey,
	sortFilmRowsByItemIds,
	subscribeListReorderedBroadcast,
} from "@/lib/list-reorder-live-sync";

/** Read-only ranked list grid that still follows live reorder events. */
export function ListDetailRankedFilmsLive({
	listId,
	initialItems,
	isRanked,
	systemKind = null,
	viewerCanEdit = false,
	canEditNotes = false,
}: {
	listId: string;
	initialItems: ListDetailFilmRow[];
	isRanked: boolean;
	systemKind?: string | null;
	viewerCanEdit?: boolean;
	canEditNotes?: boolean;
}) {
	const initialKey = useMemo(
		() => filmRowOrderKey(initialItems),
		[initialItems],
	);
	const [items, setItems] = useState(initialItems);

	useEffect(() => {
		setItems(initialItems);
	}, [initialKey, initialItems]);

	const applyRemoteOrder = useCallback((itemIds: string[]) => {
		setItems((current) => {
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
			<ListDetailFilmsGrid
				items={items}
				isRanked={isRanked}
				listId={listId}
				systemKind={systemKind}
				viewerCanEdit={viewerCanEdit}
				canEditNotes={canEditNotes}
			/>
		</>
	);
}
