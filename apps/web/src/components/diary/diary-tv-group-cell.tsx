"use client";

import { cn } from "@still/ui/lib/utils";
import { useRef, useState } from "react";
import { CataloguePosterTile } from "@/components/catalogue/catalogue-poster-tile";
import { DiaryTvEpisodeDialog } from "@/components/diary/diary-tv-episode-dialog";
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
 * Radial menu stays on the poster tile (right-click / long-press).
 */
export function DiaryTvGroupCell({
	tmdbId,
	title,
	posterPath,
	logCount,
	primaryLabel,
	expanded,
	onToggleExpand,
	onDismiss,
	priority = false,
}: {
	tmdbId: number;
	title: string;
	posterPath: string | null;
	/** Total diary entries for this show (from the endpoint). */
	logCount: number;
	/** Front-face scope caption (server-computed most-specific scope). */
	primaryLabel: string;
	/** Dialog open flag — the lobby keeps a single expanded key. */
	expanded: boolean;
	/** Poster click — opens this show, or closes it when it is already the key. */
	onToggleExpand: () => void;
	/** Dialog scrim, Close, and Escape — sets the lobby key to null. Never toggles. */
	onDismiss: () => void;
	priority?: boolean;
}) {
	const cellRef = useRef<HTMLElement | null>(null);
	// True while the dialog clone is flying or the dialog is open.
	// The cell poster returns only after the flight home finishes.
	// Reduced motion never sets this — there is no clone.
	const [concealPoster, setConcealPoster] = useState(false);
	const entryCountLine = logCount > 1 ? `${logCount} diary entries` : null;

	return (
		<div ref={cellRef} className="w-full min-w-0" data-diary-group>
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
						onClick={onToggleExpand}
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
			<DiaryTvEpisodeDialog
				open={expanded}
				onOpenChange={(next) => {
					if (next) return;
					onDismiss();
				}}
				tmdbId={tmdbId}
				title={title}
				posterPath={posterPath}
				cellRef={cellRef}
				onConcealPoster={setConcealPoster}
			/>
		</div>
	);
}
