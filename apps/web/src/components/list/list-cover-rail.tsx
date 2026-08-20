"use client";

import { cn } from "@still/ui/lib/utils";
import { Film } from "lucide-react";
import Image from "next/image";

import type { ListBoardRow } from "@/lib/list-board-row";
import {
	isListCoverProxySrc,
	listBoardRowPosterUrl,
	listPosterDisplayUrl,
} from "@/lib/list-cover-image";
import { isTmdbCdnUrl } from "@/lib/tmdb-poster-url";

/** Neutral poster edge — pure black/white outline (better-ui image outlines). */
const LIST_POSTER_OUTLINE_CLASS =
	"outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10";

/** One portrait cover — tall enough to read; width stays in the left column only. */
const LIST_COVER_FRAME_CLASS =
	"relative h-[9.5rem] w-[5.25rem] shrink-0 overflow-hidden rounded-xl bg-muted/30 shadow-sm sm:h-[10.5rem] sm:w-[6.5rem]";

/**
 * Single cover for list row tiles (movie detail community, `/lists` lobby rows).
 */
export function ListCoverRail({
	list,
	className,
}: {
	list: Pick<
		ListBoardRow,
		"id" | "coverPosterPaths" | "coverMovieIds" | "updatedAt" | "coverImageUrl"
	>;
	className?: string;
}) {
	const hydratedPaths = list.coverPosterPaths ?? [];
	const paths =
		hydratedPaths.length > 0
			? hydratedPaths
			: list.coverMovieIds.map(() => null);

	const heroSrc =
		listBoardRowPosterUrl(list, "w342") ??
		listPosterDisplayUrl(list.id, paths[0], list.updatedAt, "w342");

	return (
		<div
			className={cn(
				LIST_COVER_FRAME_CLASS,
				LIST_POSTER_OUTLINE_CLASS,
				className,
			)}
		>
			{heroSrc ? (
				<Image
					src={heroSrc}
					alt=""
					fill
					sizes="(max-width: 640px) 84px, 104px"
					className="object-cover"
					unoptimized={isListCoverProxySrc(heroSrc) || isTmdbCdnUrl(heroSrc)}
				/>
			) : (
				<div className="grid size-full place-items-center bg-muted/40">
					<Film
						className="size-5 text-muted-foreground"
						strokeWidth={1.5}
						aria-hidden
					/>
				</div>
			)}
		</div>
	);
}
