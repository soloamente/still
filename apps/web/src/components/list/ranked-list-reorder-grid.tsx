"use client";

import {
	closestCenter,
	DndContext,
	type DragEndEvent,
	DragOverlay,
	type DragStartEvent,
	PointerSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import {
	arrayMove,
	rectSortingStrategy,
	SortableContext,
	useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@still/ui/lib/utils";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { ListDetailFilmRow } from "@/components/list/list-detail-films-grid";
import { MoviePoster } from "@/components/movie/movie-poster";
import {
	HOME_LOBBY_CATALOGUE_POSTER_FRAME_CLASSNAME,
	HOME_LOBBY_CATALOGUE_POSTER_GRID_MONOCHROME_CLASSNAME,
	HOME_LOBBY_CATALOGUE_POSTER_LINK_CLASSNAME,
	LIST_DETAIL_FILMS_GRID_CLASSNAME,
} from "@/lib/home-lobby-catalogue-layout";
import { profilePosterUrlFromPath } from "@/lib/profile-filmography-map";
import { postListReorder } from "@/lib/still-api-fetch";

export type RankedListReorderRow = ListDetailFilmRow & {
	item: ListDetailFilmRow["item"] & { id: string };
};

type SaveOrderFn = (
	listId: string,
	itemIds: string[],
) => Promise<{ ok: boolean }>;

type ReorderControllerSnapshot = {
	rows: RankedListReorderRow[];
	committedRows: RankedListReorderRow[];
	undoRows: RankedListReorderRow[] | null;
	isSaving: boolean;
};

function cloneRows(rows: RankedListReorderRow[]): RankedListReorderRow[] {
	return rows.slice();
}

export function moveRankedRows(
	rows: RankedListReorderRow[],
	activeId: string,
	overId: string,
): RankedListReorderRow[] {
	if (!activeId || !overId || activeId === overId) return rows;
	const fromIndex = rows.findIndex((row) => row.item.id === activeId);
	const toIndex = rows.findIndex((row) => row.item.id === overId);
	if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return rows;
	const next = rows.slice();
	const [moved] = next.splice(fromIndex, 1);
	if (!moved) return rows;
	next.splice(toIndex, 0, moved);
	return next;
}

export function itemIdsFromRows(rows: RankedListReorderRow[]): string[] {
	return rows.map((row) => row.item.id);
}

/**
 * Server reorder expects the full list item id set.
 * If some list items are currently not renderable (no joined movie/tv row),
 * keep their original slots untouched and only rewrite visible slots.
 */
export function buildReorderPayloadIds({
	reorderedVisibleIds,
	allItemIds,
}: {
	reorderedVisibleIds: string[];
	allItemIds: string[];
}): string[] {
	if (reorderedVisibleIds.length === allItemIds.length)
		return reorderedVisibleIds;
	const visibleSet = new Set(reorderedVisibleIds);
	const visibleSlotIndexes: number[] = [];
	for (const [index, id] of allItemIds.entries()) {
		if (visibleSet.has(id)) visibleSlotIndexes.push(index);
	}
	if (visibleSlotIndexes.length !== reorderedVisibleIds.length) {
		// Fallback to the original list order if visible IDs diverge from all-item set.
		return allItemIds;
	}
	const merged = allItemIds.slice();
	for (const [offset, slotIndex] of visibleSlotIndexes.entries()) {
		const nextId = reorderedVisibleIds[offset];
		if (!nextId) continue;
		merged[slotIndex] = nextId;
	}
	return merged;
}

export function createRankedListReorderController({
	listId,
	initialRows,
	saveOrder,
}: {
	listId: string;
	initialRows: RankedListReorderRow[];
	saveOrder: SaveOrderFn;
}) {
	let snapshot: ReorderControllerSnapshot = {
		rows: cloneRows(initialRows),
		committedRows: cloneRows(initialRows),
		undoRows: null,
		isSaving: false,
	};

	const readSnapshot = (): ReorderControllerSnapshot => ({
		rows: cloneRows(snapshot.rows),
		committedRows: cloneRows(snapshot.committedRows),
		undoRows: snapshot.undoRows ? cloneRows(snapshot.undoRows) : null,
		isSaving: snapshot.isSaving,
	});

	const reorder = async (nextRows: RankedListReorderRow[]) => {
		if (snapshot.isSaving) {
			return { ok: false as const, blocked: true as const };
		}
		const previousRows = cloneRows(snapshot.rows);
		snapshot = {
			...snapshot,
			rows: cloneRows(nextRows),
			isSaving: true,
		};
		const response = await saveOrder(listId, itemIdsFromRows(nextRows));
		if (response.ok) {
			snapshot = {
				rows: cloneRows(nextRows),
				committedRows: cloneRows(nextRows),
				undoRows: previousRows,
				isSaving: false,
			};
			return { ok: true as const };
		}
		snapshot = {
			...snapshot,
			rows: previousRows,
			committedRows: previousRows,
			isSaving: false,
		};
		return { ok: false as const, blocked: false as const };
	};

	const undo = async () => {
		if (snapshot.isSaving || !snapshot.undoRows) {
			return { ok: false as const, blocked: true as const };
		}
		const currentRows = cloneRows(snapshot.rows);
		const restoreRows = cloneRows(snapshot.undoRows);
		snapshot = {
			...snapshot,
			rows: restoreRows,
			isSaving: true,
		};
		const response = await saveOrder(listId, itemIdsFromRows(restoreRows));
		if (response.ok) {
			snapshot = {
				rows: restoreRows,
				committedRows: restoreRows,
				undoRows: currentRows,
				isSaving: false,
			};
			return { ok: true as const };
		}
		snapshot = {
			...snapshot,
			rows: currentRows,
			committedRows: currentRows,
			isSaving: false,
		};
		return { ok: false as const, blocked: false as const };
	};

	return {
		readSnapshot,
		reorder,
		undo,
	};
}

export function RankedListReorderGrid({
	listId,
	items,
	allItemIds,
}: {
	listId: string;
	items: RankedListReorderRow[];
	allItemIds?: string[];
}) {
	const canonicalAllItemIds = allItemIds ?? itemIdsFromRows(items);
	const [rows, setRows] = useState<RankedListReorderRow[]>(items);
	const [isSaving, setIsSaving] = useState(false);
	const isSavingRef = useRef(false);
	const [activeDragId, setActiveDragId] = useState<string | null>(null);
	const [isClientMounted, setIsClientMounted] = useState(false);
	const committedRowsRef = useRef<RankedListReorderRow[]>(cloneRows(items));
	const undoRowsRef = useRef<RankedListReorderRow[] | null>(null);
	const wasDraggedRef = useRef(false);
	const sensors = useSensors(
		useSensor(PointerSensor, {
			activationConstraint: { distance: 6 },
		}),
	);

	useEffect(() => {
		setIsClientMounted(true);
	}, []);

	useEffect(() => {
		isSavingRef.current = isSaving;
	}, [isSaving]);

	const persistReorder = useCallback(
		async (
			nextRows: RankedListReorderRow[],
			previousRows: RankedListReorderRow[],
		) => {
			setIsSaving(true);
			const response = await postListReorder(
				listId,
				buildReorderPayloadIds({
					reorderedVisibleIds: itemIdsFromRows(nextRows),
					allItemIds: canonicalAllItemIds,
				}),
			);
			if (response.ok) {
				committedRowsRef.current = cloneRows(nextRows);
				undoRowsRef.current = cloneRows(previousRows);
				toast.success("Ranking updated", {
					actionButtonStyle: { borderRadius: 9999 },
					action: {
						label: "Undo",
						onClick: () => {
							if (isSavingRef.current) return;
							void (async () => {
								const undoRows = undoRowsRef.current;
								if (!undoRows || isSavingRef.current) return;
								const currentRows = cloneRows(committedRowsRef.current);
								setRows(undoRows);
								setIsSaving(true);
								const undoResponse = await postListReorder(
									listId,
									buildReorderPayloadIds({
										reorderedVisibleIds: itemIdsFromRows(undoRows),
										allItemIds: canonicalAllItemIds,
									}),
								);
								if (undoResponse.ok) {
									committedRowsRef.current = cloneRows(undoRows);
									undoRowsRef.current = currentRows;
									toast.success("Ranking restored");
								} else {
									setRows(currentRows);
									committedRowsRef.current = currentRows;
									toast.error("Couldn't undo ranking");
								}
								setIsSaving(false);
							})();
						},
					},
				});
			} else {
				setRows(previousRows);
				committedRowsRef.current = cloneRows(previousRows);
				const errorDetail =
					typeof response.error?.raw === "string"
						? response.error.raw
						: response.error?.raw &&
								typeof response.error.raw === "object" &&
								"detail" in response.error.raw &&
								typeof (response.error.raw as { detail?: unknown }).detail ===
									"string"
							? ((response.error.raw as { detail?: string }).detail ?? "")
							: "";
				toast.error(
					errorDetail
						? `Couldn't save ranking (${response.status}): ${errorDetail}`
						: `Couldn't save ranking (${response.status})`,
				);
			}
			setIsSaving(false);
		},
		[canonicalAllItemIds, listId],
	);

	const handleDragStart = useCallback(
		(event: DragStartEvent) => {
			if (isSaving) return;
			setActiveDragId(String(event.active.id));
		},
		[isSaving],
	);

	const handleDragEnd = useCallback(
		(event: DragEndEvent) => {
			setActiveDragId(null);
			const activeId = String(event.active.id);
			const overId = event.over ? String(event.over.id) : null;
			if (!overId || activeId === overId || isSaving) return;
			const fromIndex = rows.findIndex((row) => row.item.id === activeId);
			const toIndex = rows.findIndex((row) => row.item.id === overId);
			if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;
			const previousRows = cloneRows(rows);
			const nextRows = arrayMove(rows, fromIndex, toIndex);
			// DnD kit confirms a real sort happened; block accidental click-through to detail pages.
			wasDraggedRef.current = true;
			setRows(nextRows);
			void persistReorder(nextRows, previousRows);
		},
		[isSaving, persistReorder, rows],
	);

	const activeRow = activeDragId
		? (rows.find((row) => row.item.id === activeDragId) ?? null)
		: null;

	const orderedIds = rows.map((row) => row.item.id);

	if (!isClientMounted) {
		// dnd-kit generates runtime aria ids that can mismatch between SSR and hydration.
		// Render a static poster grid first, then enable DnD after client mount.
		return (
			<div
				className={cn(
					LIST_DETAIL_FILMS_GRID_CLASSNAME,
					HOME_LOBBY_CATALOGUE_POSTER_GRID_MONOCHROME_CLASSNAME,
				)}
				aria-busy={isSaving}
			>
				{rows.map((row, index) => {
					const listing = row.movie ?? row.tv;
					if (!listing) return null;
					return (
						<div key={row.item.id} className="relative min-w-0 touch-none">
							<MoviePoster
								movieId={listing.tmdbId}
								title={listing.title}
								posterUrl={profilePosterUrlFromPath(listing.posterPath)}
								listingKind={row.movie ? "movie" : "tv"}
								priority={index < 6}
								showTitle={false}
								hoverEffect="elevation"
								className={HOME_LOBBY_CATALOGUE_POSTER_LINK_CLASSNAME}
								frameClassName={HOME_LOBBY_CATALOGUE_POSTER_FRAME_CLASSNAME}
							/>
							<div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center bg-linear-to-t from-card/95 via-card/50 to-transparent px-2 pt-8 pb-2.5">
								<span className="font-medium text-foreground text-sm tabular-nums tracking-tight">
									{index + 1}
								</span>
							</div>
						</div>
					);
				})}
			</div>
		);
	}

	return (
		<DndContext
			sensors={sensors}
			collisionDetection={closestCenter}
			onDragStart={handleDragStart}
			onDragEnd={handleDragEnd}
		>
			<SortableContext items={orderedIds} strategy={rectSortingStrategy}>
				<div
					className={cn(
						LIST_DETAIL_FILMS_GRID_CLASSNAME,
						HOME_LOBBY_CATALOGUE_POSTER_GRID_MONOCHROME_CLASSNAME,
						"cursor-grab",
						activeDragId && "cursor-grabbing",
					)}
					aria-busy={isSaving}
				>
					{rows.map((row, index) => (
						<RankedSortableTile
							key={row.item.id}
							row={row}
							index={index}
							isSaving={isSaving}
							isActive={activeDragId === row.item.id}
							onSuppressClick={() => {
								if (!wasDraggedRef.current) return false;
								wasDraggedRef.current = false;
								return true;
							}}
						/>
					))}
				</div>
			</SortableContext>
			<DragOverlay>
				{activeRow ? (
					<RankedOverlayTile
						row={activeRow}
						index={rows.findIndex((r) => r.item.id === activeRow.item.id)}
					/>
				) : null}
			</DragOverlay>
		</DndContext>
	);
}

function RankedSortableTile({
	row,
	index,
	isSaving,
	isActive,
	onSuppressClick,
}: {
	row: RankedListReorderRow;
	index: number;
	isSaving: boolean;
	isActive: boolean;
	onSuppressClick: () => boolean;
}) {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: row.item.id, disabled: isSaving });
	const listing = row.movie ?? row.tv;
	if (!listing) return null;
	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
	};
	const reorderLabel = `${listing.title}, rank ${index + 1}. Drag to reorder.`;

	return (
		// biome-ignore lint/a11y/useSemanticElements: dnd-kit sortable cell; poster may render a link when not dragging.
		<div
			ref={setNodeRef}
			style={style}
			role="button"
			aria-label={reorderLabel}
			aria-disabled={isSaving || undefined}
			className={cn(
				"relative min-w-0 cursor-grab touch-none",
				(isDragging || isActive) && "z-50 cursor-grabbing",
				isSaving && "pointer-events-none opacity-80",
			)}
			onDragStart={(event) => {
				// Always block native image/link drag in favor of dnd-kit sensors.
				event.preventDefault();
			}}
			onClickCapture={(event) => {
				if (!onSuppressClick()) return;
				event.preventDefault();
				event.stopPropagation();
			}}
			{...attributes}
			{...listeners}
			tabIndex={isSaving ? -1 : (attributes.tabIndex ?? 0)}
		>
			<MoviePoster
				movieId={listing.tmdbId}
				title={listing.title}
				posterUrl={profilePosterUrlFromPath(listing.posterPath)}
				listingKind={row.movie ? "movie" : "tv"}
				priority={index < 6}
				showTitle={false}
				hoverEffect="elevation"
				className={HOME_LOBBY_CATALOGUE_POSTER_LINK_CLASSNAME}
				frameClassName={HOME_LOBBY_CATALOGUE_POSTER_FRAME_CLASSNAME}
				linkable={!(isDragging || isActive)}
			/>
			<div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center bg-linear-to-t from-card/95 via-card/50 to-transparent px-2 pt-8 pb-2.5">
				<span className="font-medium text-foreground text-sm tabular-nums tracking-tight">
					{index + 1}
				</span>
			</div>
		</div>
	);
}

function RankedOverlayTile({
	row,
	index,
}: {
	row: RankedListReorderRow;
	index: number;
}) {
	const listing = row.movie ?? row.tv;
	if (!listing) return null;
	return (
		<div className="relative min-w-0 cursor-grabbing">
			<MoviePoster
				movieId={listing.tmdbId}
				title={listing.title}
				posterUrl={profilePosterUrlFromPath(listing.posterPath)}
				listingKind={row.movie ? "movie" : "tv"}
				priority={false}
				showTitle={false}
				hoverEffect="elevation"
				className={HOME_LOBBY_CATALOGUE_POSTER_LINK_CLASSNAME}
				frameClassName={HOME_LOBBY_CATALOGUE_POSTER_FRAME_CLASSNAME}
				linkable={false}
			/>
			<div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center bg-linear-to-t from-card/95 via-card/50 to-transparent px-2 pt-8 pb-2.5">
				<span className="font-medium text-foreground text-sm tabular-nums tracking-tight">
					{index + 1}
				</span>
			</div>
		</div>
	);
}
