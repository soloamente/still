"use client";

import { cn } from "@still/ui/lib/utils";
import { useCallback, useRef } from "react";
import { CataloguePosterTile } from "@/components/catalogue/catalogue-poster-tile";
import { MoviePoster } from "@/components/movie/movie-poster";
import {
	HOME_LOBBY_CATALOGUE_POSTER_FRAME_CLASSNAME,
	HOME_LOBBY_CATALOGUE_POSTER_LINK_CLASSNAME,
} from "@/lib/home-lobby-catalogue-layout";
import { tmdbPosterUrlFromPath } from "@/lib/tmdb-poster-url";

function tmdbPosterUrl(posterPath: string | null): string | null {
	return tmdbPosterUrlFromPath(posterPath, "w342");
}

/**
 * One diary grid cell for a TV series — left click opens the episode dialog.
 * The lobby owns that dialog so a second poster cannot mount another one.
 * Radial menu stays on the poster tile (right-click / long-press).
 */
export function DiaryTvGroupCell({
	tmdbId,
	title,
	posterPath,
	logCount,
	primaryLabel,
	expanded,
	concealPoster,
	onPosterClick,
	onCellNode,
	priority = false,
}: {
	tmdbId: number;
	title: string;
	posterPath: string | null;
	/** Total diary entries for this show (from the endpoint). */
	logCount: number;
	/** Front-face scope caption (server-computed most-specific scope). */
	primaryLabel: string;
	/** True while this show's dialog is open or flying home. */
	expanded: boolean;
	/**
	 * Hide the poster while the clone is in flight or the dialog is open.
	 * The lobby clears this when the flight home finishes. Reduced motion
	 * stays false — there is no clone, so the cell poster stays visible.
	 */
	concealPoster: boolean;
	/** Poster click — the lobby opens this show, or queues it behind the current flight. */
	onPosterClick: () => void;
	/** Cell root, so the lobby dialog can measure this poster. Null when the cell unmounts. */
	onCellNode: (node: HTMLElement | null) => void;
	priority?: boolean;
}) {
	const onCellNodeRef = useRef(onCellNode);
	onCellNodeRef.current = onCellNode;
	// Stable ref so a parent re-render does not detach and reattach the node.
	const bindCell = useCallback((node: HTMLDivElement | null) => {
		onCellNodeRef.current(node);
	}, []);
	const entryCountLine = logCount > 1 ? `${logCount} diary entries` : null;

	return (
		<div ref={bindCell} className="w-full min-w-0" data-diary-group>
			<div
				className={cn(
					HOME_LOBBY_CATALOGUE_POSTER_LINK_CLASSNAME,
					"relative aspect-2/3 w-full",
				)}
			>
				<CataloguePosterTile
					className="size-full"
					hoverEffect="elevation"
					listingKind="tv"
					posterCaption={primaryLabel}
					posterCaptionSubline={entryCountLine}
					posterUrl={tmdbPosterUrl(posterPath)}
					priority={priority}
					surface="diary"
					title={title}
					tmdbId={tmdbId}
				>
					<button
						type="button"
						data-diary-poster-trigger
						aria-expanded={expanded}
						aria-label={`${title}, ${primaryLabel}${entryCountLine ? `, ${entryCountLine}` : ""}. Show diary entries.`}
						className={cn(
							"size-full cursor-pointer select-none border-0 bg-transparent p-0 text-left",
							concealPoster && "invisible",
						)}
						onClick={onPosterClick}
					>
						<MoviePoster
							className="pointer-events-none size-full"
							frameClassName={HOME_LOBBY_CATALOGUE_POSTER_FRAME_CLASSNAME}
							hoverEffect="elevation"
							linkable={false}
							listingKind="tv"
							movieId={tmdbId}
							posterCaption={primaryLabel}
							posterCaptionSubline={entryCountLine}
							posterUrl={tmdbPosterUrl(posterPath)}
							priority={priority}
							showTitle={false}
							title={title}
						/>
					</button>
				</CataloguePosterTile>
			</div>
		</div>
	);
}
