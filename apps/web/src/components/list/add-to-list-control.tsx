"use client";

import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@still/ui/components/popover";
import IconListPlay from "@still/ui/icons/list-play";
import { cn } from "@still/ui/lib/utils";
import { Loader2 } from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { AddToListPicker } from "@/components/list/add-to-list-picker";
import { CreateListDialog } from "@/components/list/create-list-dialog";
import { api } from "@/lib/api";
import {
	DETAIL_MOTION_PRESSABLE_CLASS,
	useDetailActionMotion,
} from "@/lib/detail-action-motion";
import { type ListBoardRow, toListBoardRow } from "@/lib/list-board-row";
import { fetchListsMe } from "@/lib/still-api-fetch";

type AddToListControlProps = {
	movieId: number;
	movieTitle: string;
	disabled?: boolean;
	/** Optional layout wrapper for hero `LayoutGroup` siblings. */
	layout?: boolean;
};

/**
 * Hero “Add to list” control — opens a create sheet when the patron has no lists,
 * otherwise a Mobbin-style picker sheet to search lists or start a new one.
 */
export function AddToListControl({
	movieId,
	movieTitle,
	disabled = false,
	layout = true,
}: AddToListControlProps) {
	const motionProps = useDetailActionMotion();
	const [lists, setLists] = useState<ListBoardRow[] | null>(null);
	const [listsLoading, setListsLoading] = useState(false);
	const [pickerOpen, setPickerOpen] = useState(false);
	const [createOpen, setCreateOpen] = useState(false);
	const [addingListId, setAddingListId] = useState<string | null>(null);
	const [pickerSession, setPickerSession] = useState(0);
	const fetchGen = useRef(0);

	const circle = cn(
		"inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-background text-foreground",
		"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
		"disabled:pointer-events-none disabled:opacity-40",
	);

	const loadLists = useCallback(async () => {
		const gen = ++fetchGen.current;
		setListsLoading(true);
		try {
			const res = await fetchListsMe(movieId);
			if (gen !== fetchGen.current) return null;
			const rows = ((res.data as unknown[]) ?? []).map(toListBoardRow);
			setLists(rows);
			return rows;
		} catch (err) {
			console.error("[add-to-list-control] lists.me", err);
			if (gen === fetchGen.current) setLists([]);
			return [];
		} finally {
			if (gen === fetchGen.current) setListsLoading(false);
		}
	}, [movieId]);

	// Warm patron lists once the hero row is interactive.
	useEffect(() => {
		if (disabled || lists != null) return;
		void loadLists();
	}, [disabled, lists, loadLists]);

	// Refresh rows when the picker opens so counts and covers stay current.
	useEffect(() => {
		if (!pickerOpen || disabled) return;
		void loadLists();
	}, [pickerOpen, disabled, loadLists]);

	function handlePickerOpenChange(next: boolean) {
		setPickerOpen(next);
		if (!next) setPickerSession((n) => n + 1);
	}

	async function handleTriggerActivate() {
		if (disabled || listsLoading) return;
		const rows = lists ?? (await loadLists());
		if (!rows) return;
		if (rows.length === 0) {
			setCreateOpen(true);
			return;
		}
		setPickerOpen(true);
	}

	async function addFilmToList(list: ListBoardRow) {
		if (addingListId) return;
		if (list.containsMovie) {
			toast.message(`Already in ${list.title}`);
			return;
		}
		setAddingListId(list.id);
		try {
			await api.api.lists({ id: list.id }).items.post({ movieId });
			setLists((prev) =>
				(prev ?? []).map((row) =>
					row.id === list.id
						? {
								...row,
								containsMovie: true,
								itemsCount: row.itemsCount + 1,
							}
						: row,
				),
			);
			toast.success(`Added to ${list.title}`);
		} catch (err) {
			console.error("[add-to-list-control] add item", err);
			toast.error(`Couldn't add to ${list.title}`);
		} finally {
			setAddingListId(null);
		}
	}

	function handleListCreated() {
		void loadLists();
		setPickerOpen(false);
		setCreateOpen(false);
	}

	const hasLists = (lists?.length ?? 0) > 0;

	const triggerButton = (
		<motion.button
			type="button"
			className={cn(circle, DETAIL_MOTION_PRESSABLE_CLASS)}
			style={motionProps.style}
			layout={layout ? true : undefined}
			data-primary-action
			whileHover={motionProps.hover}
			whileTap={motionProps.tap}
			transition={motionProps.buttonTransition}
			disabled={disabled || listsLoading}
			aria-label="Add to list"
			aria-haspopup={hasLists ? "dialog" : "dialog"}
			aria-expanded={pickerOpen || createOpen}
			onClick={hasLists ? undefined : () => void handleTriggerActivate()}
		>
			{listsLoading ? (
				<Loader2 className="size-5 animate-spin opacity-70" aria-hidden />
			) : (
				<IconListPlay size="22px" className="shrink-0 opacity-90" aria-hidden />
			)}
		</motion.button>
	);

	return (
		<>
			{hasLists ? (
				<Popover
					open={pickerOpen}
					onOpenChange={handlePickerOpenChange}
					modal={false}
				>
					<PopoverTrigger render={triggerButton} />
					<PopoverContent
						side="top"
						align="center"
						sideOffset={12}
						initialFocus={false}
						className={cn(
							"w-[min(100vw-1.5rem,24rem)] min-w-[300px] max-w-[400px] rounded-[2rem] px-3 py-4 text-base",
						)}
					>
						<AddToListPicker
							key={pickerSession}
							lists={lists ?? []}
							movieTitle={movieTitle}
							addingListId={addingListId}
							onSelectList={(list) => void addFilmToList(list)}
							onCreateNew={() => {
								handlePickerOpenChange(false);
								setCreateOpen(true);
							}}
						/>
					</PopoverContent>
				</Popover>
			) : (
				triggerButton
			)}

			<CreateListDialog
				open={createOpen}
				onOpenChange={setCreateOpen}
				movieId={movieId}
				movieTitle={movieTitle}
				onCreated={handleListCreated}
			/>
		</>
	);
}
