import { cn } from "@still/ui/lib/utils";
import Link from "next/link";

import { CataloguePosterGroup } from "@/components/catalogue/catalogue-poster-group";
import { MoviePoster } from "@/components/movie/movie-poster";
import {
	CATALOGUE_HORIZONTAL_POSTER_RAIL_SCROLL_CLASSNAME,
	cataloguePosterHoverShellClassName,
} from "@/lib/catalogue-poster-hover";
import { tmdbPosterUrlFromPath } from "@/lib/tmdb-poster-url";
import { formatTvNextEpisodeLabel } from "@/lib/tv-watch-format";
import type { TvWatchBundle } from "@/lib/tv-watch-types";

/** Rail posters — softer than lobby `rounded-[3rem]` but still card-native. */
const CONTINUE_RAIL_POSTER_FRAME_CLASSNAME =
	"rounded-2xl border-0 bg-background";

function tmdbPosterUrl(posterPath: string | null): string | null {
	return tmdbPosterUrlFromPath(posterPath, "w342");
}

/**
 * Signed-in **TV** lobby rail — active `tv_watch` rows with next-episode caption (Mobbin-style horizontal strip).
 * Rendered only when `browse=tv` on `/home` (hidden on Movies / Community).
 * One `<Link>` per tile (`MoviePoster` is not linkable here) to avoid nested anchors.
 */
export function HomeContinueWatchingRail({
	items,
}: {
	items: TvWatchBundle[];
}) {
	if (items.length === 0) return null;

	return (
		<section aria-label="Continue watching" className="shrink-0 space-y-2.5">
			<h2 className="font-medium text-muted-foreground text-xs tracking-wide">
				Continue watching
			</h2>
			{/*
			 * Scroll on a wrapper, not on `.t-avatar-group`. Overflow-x:auto
			 * otherwise forces overflow-y:auto and shears the hover lift.
			 */}
			<div className={CATALOGUE_HORIZONTAL_POSTER_RAIL_SCROLL_CLASSNAME}>
				<CataloguePosterGroup className="flex w-max gap-2">
					{items.map((bundle, index) => {
						const show = bundle.show;
						if (!show) return null;
						const nextLine = formatTvNextEpisodeLabel(bundle.nextEpisode);
						const episodeCaption = nextLine
							? nextLine.replace(/^Next:\s*/, "")
							: null;

						return (
							<Link
								key={bundle.watch?.id ?? show.tmdbId}
								href={`/tv/${show.tmdbId}`}
								aria-label={
									episodeCaption
										? `${show.title}, ${episodeCaption}`
										: show.title
								}
								className={cn(
									cataloguePosterHoverShellClassName(),
									"flex w-27 shrink-0 flex-col items-center text-center sm:w-30",
								)}
							>
								<MoviePoster
									avatarGroupItem={false}
									className="w-full"
									frameClassName={CONTINUE_RAIL_POSTER_FRAME_CLASSNAME}
									hoverEffect="elevation"
									linkable={false}
									listingKind="tv"
									movieId={show.tmdbId}
									posterUrl={tmdbPosterUrl(show.posterPath)}
									priority={index < 4}
									showTitle
									titleLines={2}
									title={show.title}
								/>
								{episodeCaption ? (
									<p className="mt-1.5 line-clamp-2 w-full text-[11px] text-muted-foreground leading-snug">
										{episodeCaption}
									</p>
								) : null}
							</Link>
						);
					})}
				</CataloguePosterGroup>
			</div>
		</section>
	);
}
