"use client";

import { Button } from "@still/ui/components/button";
import { cn } from "@still/ui/lib/utils";
import { Loader2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { useLobbyNavigationOptional } from "@/components/lobby/lobby-navigation-provider";
import { QuoteRow, QuoteSuggestCta } from "@/components/quote/quote-row";
import { QuoteSuggestSheet } from "@/components/quote/quote-suggest-sheet";
import { QuoteTvEpisodePicker } from "@/components/quote/quote-tv-episode-picker";
import { api } from "@/lib/api";
import { MOVIE_DETAIL_ABOUT_COLUMN_CLASSNAME } from "@/lib/movie-detail-sections";
import {
	buildMovieDetailViewHref,
	type MovieDetailListingKind,
	parseMovieDetailTvQuoteEpisode,
} from "@/lib/movie-detail-view";
import type { ListingQuoteItem, ListingQuotesPage } from "@/lib/quote-types";

/** Quotes tab — catalog list, TV episode scope, suggest sheet. */
export function MovieDetailQuotesPanel({
	listingKind,
	listingId,
	tmdbId,
	basePath,
}: {
	listingKind: MovieDetailListingKind;
	listingId: string;
	tmdbId: number;
	basePath: string;
}) {
	const searchParams = useSearchParams();
	const lobbyNav = useLobbyNavigationOptional();
	const urlEpisode = parseMovieDetailTvQuoteEpisode({
		season: searchParams.get("season"),
		episode: searchParams.get("episode"),
	});

	const [seasonNumber, setSeasonNumber] = useState<number | null>(
		urlEpisode?.season ?? null,
	);
	const [episodeNumber, setEpisodeNumber] = useState<number | null>(
		urlEpisode?.episode ?? null,
	);
	const [items, setItems] = useState<ListingQuoteItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [suggestOpen, setSuggestOpen] = useState(false);

	useEffect(() => {
		setSeasonNumber(urlEpisode?.season ?? null);
		setEpisodeNumber(urlEpisode?.episode ?? null);
	}, [urlEpisode?.episode, urlEpisode?.season]);

	const syncTvEpisodeUrl = useCallback(
		(season: number, episode: number) => {
			const href = buildMovieDetailViewHref(basePath, "quotes", {
				listingKind: "tv",
				season,
				episode,
			});
			if (lobbyNav) {
				lobbyNav.navigate(href);
			} else {
				window.history.replaceState(null, "", href);
			}
		},
		[basePath, lobbyNav],
	);

	const fetchQuotes = useCallback(async () => {
		if (listingKind === "tv") {
			if (seasonNumber == null || episodeNumber == null) {
				setItems([]);
				setLoading(false);
				return;
			}
		}

		setLoading(true);
		setLoadError(null);
		try {
			const res =
				listingKind === "movie"
					? await api.api.movies({ id: listingId }).quotes.get({
							query: { sort: "upvotes", page: "1" },
						})
					: await api.api.tv({ id: listingId }).quotes.get({
							query: {
								sort: "upvotes",
								page: "1",
								season: String(seasonNumber),
								episode: String(episodeNumber),
							},
						});

			if (res.error) {
				setLoadError("Couldn't load quotes");
				setItems([]);
				return;
			}
			const page = res.data as ListingQuotesPage;
			setItems(page.items ?? []);
		} catch {
			setLoadError("Couldn't load quotes");
			setItems([]);
		} finally {
			setLoading(false);
		}
	}, [episodeNumber, listingId, listingKind, seasonNumber]);

	useEffect(() => {
		void fetchQuotes();
	}, [fetchQuotes]);

	const handleSeasonChange = useCallback((season: number) => {
		setSeasonNumber(season);
		setEpisodeNumber(null);
	}, []);

	const handleEpisodeChange = useCallback(
		(episode: number, options?: { syncUrl?: boolean }) => {
			setEpisodeNumber(episode);
			if (options?.syncUrl === false || seasonNumber == null) return;
			syncTvEpisodeUrl(seasonNumber, episode);
		},
		[seasonNumber, syncTvEpisodeUrl],
	);

	const showTvPicker = listingKind === "tv";
	const tvReady =
		listingKind === "movie" || (seasonNumber != null && episodeNumber != null);
	const empty = !loading && tvReady && items.length === 0 && !loadError;

	return (
		<div className={MOVIE_DETAIL_ABOUT_COLUMN_CLASSNAME}>
			{showTvPicker ? (
				<div className="mb-8 flex justify-center">
					<QuoteTvEpisodePicker
						tvId={tmdbId}
						seasonNumber={seasonNumber}
						episodeNumber={episodeNumber}
						onSeasonChange={handleSeasonChange}
						onEpisodeChange={handleEpisodeChange}
					/>
				</div>
			) : null}

			{loading ? (
				<div
					className="flex min-h-40 items-center justify-center py-12"
					role="status"
					aria-busy="true"
					aria-label="Loading quotes"
				>
					<Loader2 className="size-6 animate-spin text-muted-foreground" />
				</div>
			) : loadError ? (
				<div className="py-10 text-center">
					<p className="text-muted-foreground text-sm">{loadError}</p>
					<Button
						type="button"
						variant="secondary"
						className="mt-4 rounded-full bg-card"
						onClick={() => void fetchQuotes()}
					>
						Try again
					</Button>
				</div>
			) : empty ? (
				<div
					className="flex min-h-[min(40vh,20rem)] flex-1 flex-col items-center justify-center px-4 py-10 text-center"
					role="status"
				>
					<p className="text-balance font-sans text-lg">No quotes yet</p>
					<p className="mx-auto mt-2 max-w-sm text-pretty text-muted-foreground text-sm leading-relaxed">
						Be the first to suggest a memorable line from this{" "}
						{listingKind === "movie" ? "film" : "episode"}.
					</p>
					<QuoteSuggestCta
						variant="primary"
						className="mt-6"
						onClick={() => setSuggestOpen(true)}
					/>
				</div>
			) : tvReady ? (
				<ul className={cn("mx-auto flex w-full max-w-2xl flex-col gap-4")}>
					{items.map((quote) => (
						<li key={quote.id}>
							<QuoteRow quote={quote} />
						</li>
					))}
				</ul>
			) : null}

			{tvReady && !loading && !loadError && items.length > 0 ? (
				<div className="mt-10 flex justify-center pb-4">
					<QuoteSuggestCta
						variant="primary"
						onClick={() => setSuggestOpen(true)}
					/>
				</div>
			) : null}

			<QuoteSuggestSheet
				open={suggestOpen}
				onOpenChange={setSuggestOpen}
				listingKind={listingKind}
				movieId={listingKind === "movie" ? tmdbId : null}
				tvId={listingKind === "tv" ? tmdbId : null}
				initialSeason={seasonNumber}
				initialEpisode={episodeNumber}
			/>
		</div>
	);
}
