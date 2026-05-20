import Link from "next/link";

import { MoviePoster } from "@/components/movie/movie-poster";

type DoubleFeaturePick = {
	id: number;
	title: string;
	poster_path: string | null;
};

/**
 * Surfaces a single “pair it with” pick from TMDb recommendations — cheap double-bill energy
 * without a recommender service.
 */
export function DoubleFeatureSuggestion({
	currentTitle,
	pick,
	listingKind = "movie",
}: {
	currentTitle: string;
	pick: DoubleFeaturePick;
	/** TV picks link to `/tv/[id]` instead of film routes. */
	listingKind?: "movie" | "tv";
}) {
	const posterUrl = pick.poster_path
		? `https://image.tmdb.org/t/p/w342${pick.poster_path}`
		: null;
	const href = listingKind === "tv" ? `/tv/${pick.id}` : `/movies/${pick.id}`;

	return (
		<div className="rounded-2xl border border-border bg-card/50 p-5 md:flex md:items-center md:gap-6">
			<div className="max-w-[15.5rem] shrink-0">
				<MoviePoster
					movieId={pick.id}
					title={pick.title}
					posterUrl={posterUrl}
					size="md"
					showTitle={false}
					filmFrame
					listingKind={listingKind}
				/>
			</div>
			<div className="mt-4 min-w-0 flex-1 md:mt-0">
				<p className="font-semibold text-[10px] text-desert-orange uppercase tracking-[0.28em]">
					Double feature
				</p>
				<h3 className="mt-2 font-display text-2xl tracking-[-0.02em]">
					Pair with{" "}
					<Link href={href} className="text-desert-orange hover:underline">
						{pick.title}
					</Link>
				</h3>
				<p className="mt-2 text-muted-foreground text-sm">
					Still member rooms love a good twin bill — follow up{" "}
					<span className="text-foreground/90">{currentTitle}</span> with
					something that rhymes tonally.
				</p>
				<Link
					href={href}
					className="mt-4 inline-block font-medium text-foreground text-xs uppercase tracking-wider hover:text-desert-orange"
				>
					Second screening →
				</Link>
			</div>
		</div>
	);
}
