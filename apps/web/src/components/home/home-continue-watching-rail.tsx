import { cn } from "@still/ui/lib/utils";
import Link from "next/link";

import { MoviePoster } from "@/components/movie/movie-poster";
import { formatTvNextEpisodeLabel } from "@/lib/tv-watch-format";
import type { TvWatchBundle } from "@/lib/tv-watch-types";

/** Rail posters — softer than lobby `rounded-[3rem]` but still card-native. */
const CONTINUE_RAIL_POSTER_FRAME_CLASSNAME =
	"rounded-2xl border-0 bg-background";

function tmdbPosterUrl(posterPath: string | null): string | null {
	if (!posterPath?.length) return null;
	if (posterPath.startsWith("http")) return posterPath;
	const fragment = posterPath.startsWith("/") ? posterPath : `/${posterPath}`;
	return `https://image.tmdb.org/t/p/w780${fragment}`;
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
			<div
				className={cn(
					"scrollbar-none flex gap-2 overflow-x-auto overscroll-x-contain pb-0.5",
					"[-webkit-overflow-scrolling:touch]",
				)}
			>
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
								episodeCaption ? `${show.title}, ${episodeCaption}` : show.title
							}
							className={cn(
								"flex w-27 shrink-0 flex-col items-center text-center sm:w-30",
								"min-w-0 rounded-2xl transition-[box-shadow] duration-200 ease-out",
								"[@media(hover:hover)]:hover:shadow-[0_0_0_1px_color-mix(in_oklab,var(--card)_92%,var(--border)),0_8px_24px_-8px_color-mix(in_oklab,var(--card)_80%,transparent)]",
							)}
						>
							<MoviePoster
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
			</div>
		</section>
	);
}
