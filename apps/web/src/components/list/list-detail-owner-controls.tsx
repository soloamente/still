"use client";

import IconPen2Fill from "@still/ui/icons/pen-2-fill";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ListDetailCoverPicker } from "@/components/list/list-detail-cover-picker";
import type { ListDetailFilmRow } from "@/components/list/list-detail-films-grid";
import { ListLobbyEditDialog } from "@/components/list/list-lobby-edit-dialog";
import { DetailMotionButtonWrap } from "@/components/movie/detail-motion-pressable";
import { DETAIL_CANVAS_ON_CARD_HOVER_CLASS } from "@/lib/detail-action-motion";

/**
 * Owner-only controls displayed in list detail hero.
 * Keeps the edit dialog colocated with the cover picker.
 */
export function ListDetailOwnerControls({
	listId,
	films,
	coverMovieId,
	coverTvId,
	coverImageUrl,
	updatedAt,
	initialTitle,
	initialDescription,
	allowEditDetails = true,
}: {
	listId: string;
	films: ListDetailFilmRow[];
	coverMovieId: number | null;
	coverTvId: number | null;
	coverImageUrl: string | null;
	updatedAt: string;
	initialTitle: string;
	initialDescription: string | null;
	/** Favorites list: cover only — title/description stay system-managed. */
	allowEditDetails?: boolean;
}) {
	const router = useRouter();
	const [editOpen, setEditOpen] = useState(false);

	return (
		<div className="mt-4 inline-flex flex-wrap items-center justify-center gap-2">
			<ListDetailCoverPicker
				listId={listId}
				films={films}
				coverMovieId={coverMovieId}
				coverTvId={coverTvId}
				coverImageUrl={coverImageUrl}
				updatedAt={updatedAt}
			/>
			{allowEditDetails ? (
				<>
					<DetailMotionButtonWrap>
						<button
							type="button"
							onClick={() => setEditOpen(true)}
							className={`inline-flex min-h-10 items-center gap-2 rounded-full bg-background px-4 py-2 font-medium text-foreground text-sm ${DETAIL_CANVAS_ON_CARD_HOVER_CLASS}`}
						>
							<IconPen2Fill
								size="18px"
								className="shrink-0 opacity-90"
								aria-hidden
							/>
							Edit details
						</button>
					</DetailMotionButtonWrap>
					<ListLobbyEditDialog
						open={editOpen}
						onOpenChange={setEditOpen}
						listId={listId}
						initialTitle={initialTitle}
						initialDescription={initialDescription}
						// Refresh server-rendered hero title/description right after save.
						onSaved={() => {
							router.refresh();
						}}
					/>
				</>
			) : null}
		</div>
	);
}
