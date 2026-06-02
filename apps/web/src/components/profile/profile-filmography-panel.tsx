"use client";

import Link from "next/link";

import { useLobbyNavigation } from "@/components/lobby/lobby-navigation-provider";

import type { PopularMovieSeed } from "@/components/movie/popular-movies-infinite";
import { ProfileLobbyCatalogue } from "@/components/profile/profile-lobby-catalogue";
import type { FilmographyQueryOpts } from "@/lib/profile-filmography-fetch";

export type ProfileFilmographyRow = {
	log: {
		id: string;
		watchedAt: string | Date;
		rating: number | null;
		liked: boolean;
		watchVenue?: "theaters" | "streaming";
	};
	movie: { tmdbId: number; title: string; posterPath: string | null } | null;
	tv: { tmdbId: number; title: string; posterPath: string | null } | null;
};

type ProfileFilmographyPanelProps = {
	handle: string;
	seeds: PopularMovieSeed[];
	totalPages: number;
	totalResults: number;
	query: Omit<FilmographyQueryOpts, "signal">;
	kind: "movies" | "tv";
	catalogueWaveKey: string;
	monochromePeersOnHover?: boolean;
	hasLogsOtherVenue?: boolean;
	hasRowsWhenFavoritesOff?: boolean;
	favoritesOnly?: boolean;
	showAllLedgerHref?: string;
	switchVenueHref?: string;
	lobbyVenue?: "theaters" | "streaming";
};

/** Patron ledger — `/home` lobby poster grid for films or TV only. */
export function ProfileFilmographyPanel({
	handle,
	seeds,
	totalPages,
	totalResults,
	query,
	kind,
	catalogueWaveKey,
	monochromePeersOnHover = true,
	hasLogsOtherVenue = false,
	hasRowsWhenFavoritesOff = false,
	favoritesOnly = false,
	showAllLedgerHref,
	switchVenueHref,
	lobbyVenue = "streaming",
}: ProfileFilmographyPanelProps) {
	const { navigate } = useLobbyNavigation();

	if (seeds.length === 0) {
		const label = kind === "tv" ? "TV shows" : "films";
		const venueLabel = lobbyVenue === "theaters" ? "in cinemas" : "at home";
		return (
			<div
				className="flex min-h-[min(40vh,20rem)] flex-1 flex-col items-center justify-center px-1 py-6 text-center sm:px-4 sm:py-10"
				role="status"
			>
				{hasRowsWhenFavoritesOff && showAllLedgerHref ? (
					<>
						<p className="font-sans font-semibold text-foreground text-lg tracking-tight">
							No favorited {label} {venueLabel}
						</p>
						<p className="mt-2 max-w-sm text-balance text-muted-foreground text-sm leading-relaxed">
							This patron has logged {label} here, but none are favorited in
							this venue slice. Switch to All or favorite a title from its
							detail page.
						</p>
						<button
							type="button"
							className="mt-4 inline-flex min-h-10 items-center justify-center rounded-full bg-background px-5 py-2.5 font-medium text-foreground text-sm"
							onClick={() => navigate(showAllLedgerHref)}
						>
							Show all {label}
						</button>
					</>
				) : hasLogsOtherVenue && switchVenueHref ? (
					<>
						<p className="font-sans font-semibold text-foreground text-lg tracking-tight">
							No {label} logged {venueLabel}
						</p>
						<p className="mt-2 max-w-sm text-balance text-muted-foreground text-sm leading-relaxed">
							Switch the venue chip above to see logs from the other watch
							setting.
						</p>
						<button
							type="button"
							className="mt-4 inline-flex min-h-10 items-center justify-center rounded-full bg-background px-5 py-2.5 font-medium text-foreground text-sm"
							onClick={() => navigate(switchVenueHref)}
						>
							Show {lobbyVenue === "theaters" ? "at home" : "in cinemas"}{" "}
							instead
						</button>
					</>
				) : favoritesOnly ? (
					<>
						<p className="font-sans font-semibold text-foreground text-lg tracking-tight">
							No favorited {label} yet
						</p>
						<p className="mt-2 max-w-sm text-balance text-muted-foreground text-sm leading-relaxed">
							Favorite {kind === "tv" ? "a series" : "a film"} from its detail
							page and it will appear here.
						</p>
					</>
				) : (
					<>
						<p className="font-sans font-semibold text-foreground text-lg tracking-tight">
							No {label} logged yet
						</p>
						<p className="mt-2 max-w-sm text-balance text-muted-foreground text-sm leading-relaxed">
							Log {kind === "tv" ? "a series" : "a film"} from{" "}
							<Link href="/home" className="text-foreground underline">
								browse
							</Link>{" "}
							or your{" "}
							<Link href="/diary" className="text-foreground underline">
								diary
							</Link>{" "}
							and it will show up here.
						</p>
					</>
				)}
			</div>
		);
	}

	return (
		<ProfileLobbyCatalogue
			handle={handle}
			seeds={seeds}
			totalPages={totalPages}
			totalResults={totalResults}
			query={query}
			catalogueWaveKeyOverride={catalogueWaveKey}
			monochromePeersOnHover={monochromePeersOnHover}
		/>
	);
}
