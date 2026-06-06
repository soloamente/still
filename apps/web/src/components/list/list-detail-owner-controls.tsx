"use client";

import IconPen2Fill from "@still/ui/icons/pen-2-fill";
import { cn } from "@still/ui/lib/utils";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ListCollaboratorInvite } from "@/components/list/list-collaborator-invite";
import type { ListCollaboratorSummary } from "@/components/list/list-detail-collaborators-byline";
import { ListDetailCoverPicker } from "@/components/list/list-detail-cover-picker";
import { ListDetailDiscoverabilityNudge } from "@/components/list/list-detail-discoverability-nudge";
import type { ListDetailFilmRow } from "@/components/list/list-detail-films-grid";
import { ListLobbyEditDialog } from "@/components/list/list-lobby-edit-dialog";
import { DetailMotionButtonWrap } from "@/components/movie/detail-motion-pressable";
import { DETAIL_CANVAS_ON_CARD_HOVER_CLASS } from "@/lib/detail-action-motion";
import { listHasDiscoverabilityDescription } from "@/lib/list-quality";

/**
 * Owner-only controls displayed in list detail hero.
 * Quick actions (cover, edit) sit above the collaborator panel for clearer hierarchy.
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
	isPublic = true,
	showDiscoverabilityNudge = false,
	collaborators = [],
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
	isPublic?: boolean;
	showDiscoverabilityNudge?: boolean;
	collaborators?: ListCollaboratorSummary[];
}) {
	const router = useRouter();
	const [editOpen, setEditOpen] = useState(false);
	const needsDescription =
		showDiscoverabilityNudge &&
		isPublic &&
		allowEditDetails &&
		!listHasDiscoverabilityDescription(initialDescription);

	return (
		<div className="flex w-full max-w-md flex-col items-stretch gap-4">
			{needsDescription ? (
				<ListDetailDiscoverabilityNudge
					className="mt-0"
					onEditDetails={() => setEditOpen(true)}
				/>
			) : null}

			{/* Primary owner actions — canvas controls on the list hero card surface. */}
			<div
				className={cn(
					"flex flex-wrap items-center justify-center gap-2",
					allowEditDetails ? "pb-1" : undefined,
				)}
			>
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
							isPublic={isPublic}
							// Refresh server-rendered hero title/description right after save.
							onSaved={() => {
								router.refresh();
							}}
						/>
					</>
				) : null}
			</div>

			{allowEditDetails ? (
				<ListCollaboratorInvite
					listId={listId}
					initialCollaborators={collaborators}
				/>
			) : null}
		</div>
	);
}
