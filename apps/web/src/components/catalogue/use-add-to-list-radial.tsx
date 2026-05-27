"use client";

import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@still/ui/components/popover";
import { stillToast } from "@still/ui/components/still-toast";
import { useCallback, useEffect, useRef, useState } from "react";

import { AddToListPicker } from "@/components/list/add-to-list-picker";
import { CreateListDialog } from "@/components/list/create-list-dialog";
import {
	type AddToListMedia,
	addToListEntityLabel,
	addToListItemPostBody,
} from "@/lib/add-to-list-media";
import { api } from "@/lib/api";
import { type ListBoardRow, toListBoardRow } from "@/lib/list-board-row";
import { fetchListsMe } from "@/lib/still-api-fetch";

/**
 * Headless add-to-list flow for radial menus — opens the same picker sheet as hero
 * `AddToListControl` without rendering the circle trigger.
 */
export function useAddToListRadial(media: AddToListMedia) {
	const [lists, setLists] = useState<ListBoardRow[] | null>(null);
	const [listsLoading, setListsLoading] = useState(false);
	const [pickerOpen, setPickerOpen] = useState(false);
	const [createOpen, setCreateOpen] = useState(false);
	const [addingListId, setAddingListId] = useState<string | null>(null);
	const [pickerSession, setPickerSession] = useState(0);
	const fetchGen = useRef(0);
	const entityLabel = addToListEntityLabel(media.listingKind);

	const loadLists = useCallback(async () => {
		const gen = ++fetchGen.current;
		setListsLoading(true);
		try {
			const res = await fetchListsMe({
				listingKind: media.listingKind,
				tmdbId: media.tmdbId,
			});
			if (gen !== fetchGen.current) return null;
			const rows = ((res.data as unknown[]) ?? [])
				.map(toListBoardRow)
				.filter((row) => row.systemKind !== "favorites");
			setLists(rows);
			return rows;
		} catch (err) {
			console.error("[use-add-to-list-radial] lists.me", err);
			if (gen === fetchGen.current) setLists([]);
			return [];
		} finally {
			if (gen === fetchGen.current) setListsLoading(false);
		}
	}, [media.listingKind, media.tmdbId]);

	useEffect(() => {
		if (lists != null) return;
		void loadLists();
	}, [lists, loadLists]);

	const handlePickerOpenChange = useCallback((next: boolean) => {
		setPickerOpen(next);
		if (!next) setPickerSession((n) => n + 1);
	}, []);

	const openPicker = useCallback(async () => {
		if (listsLoading) return;
		const rows = lists ?? (await loadLists());
		if (!rows) return;
		if (rows.length === 0) {
			setCreateOpen(true);
			return;
		}
		setPickerOpen(true);
		void loadLists();
	}, [lists, listsLoading, loadLists]);

	function bumpListCounts(row: ListBoardRow): ListBoardRow {
		const isMovie = media.listingKind === "movie";
		return {
			...row,
			containsTitle: true,
			containsMovie: true,
			itemsCount: row.itemsCount + 1,
			movieItemsCount: row.movieItemsCount + (isMovie ? 1 : 0),
			tvItemsCount: row.tvItemsCount + (isMovie ? 0 : 1),
		};
	}

	const addTitleToList = useCallback(
		async (list: ListBoardRow) => {
			if (addingListId) return;
			if (list.containsTitle ?? list.containsMovie) {
				stillToast.alreadyInCollection({
					entityLabel,
					listTitle: list.title,
				});
				return;
			}
			setAddingListId(list.id);
			try {
				await api.api
					.lists({ id: list.id })
					.items.post(addToListItemPostBody(media));
				setLists((prev) =>
					(prev ?? []).map((row) =>
						row.id === list.id ? bumpListCounts(row) : row,
					),
				);
				stillToast.addedToCollection({
					entityLabel,
					destinationName: list.title,
				});
			} catch (err) {
				console.error("[use-add-to-list-radial] add item", err);
				stillToast.error(`Couldn't add to ${list.title}`);
			} finally {
				setAddingListId(null);
			}
		},
		[addingListId, entityLabel, media],
	);

	// Mount popover only while open — avoids one hidden `PopoverTrigger` per lobby poster cell.
	const pickerHost = (
		<>
			{pickerOpen ? (
				<Popover
					open={pickerOpen}
					onOpenChange={handlePickerOpenChange}
					modal={false}
				>
					<PopoverTrigger
						render={
							<button
								type="button"
								tabIndex={-1}
								aria-hidden
								className="pointer-events-none fixed top-1/2 left-1/2 size-px border-0 bg-transparent p-0 opacity-0"
							/>
						}
					/>
					<PopoverContent
						side="top"
						align="center"
						sideOffset={12}
						initialFocus={false}
						className="z-[260] w-[min(100vw-1.5rem,24rem)] min-w-[300px] max-w-[400px] rounded-[2rem] px-3 py-4 text-base"
					>
						<AddToListPicker
							key={pickerSession}
							lists={lists ?? []}
							titleLabel={media.title}
							addingListId={addingListId}
							onSelectList={(list) => void addTitleToList(list)}
							onCreateNew={() => {
								handlePickerOpenChange(false);
								setCreateOpen(true);
							}}
						/>
					</PopoverContent>
				</Popover>
			) : null}
			<CreateListDialog
				open={createOpen}
				onOpenChange={setCreateOpen}
				media={media}
				onCreated={() => {
					void loadLists();
					setCreateOpen(false);
				}}
			/>
		</>
	);

	return { openPicker, pickerHost, listsLoading };
}
