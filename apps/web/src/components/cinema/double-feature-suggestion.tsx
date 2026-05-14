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
}: {
  currentTitle: string;
  pick: DoubleFeaturePick;
}) {
  const posterUrl = pick.poster_path
    ? `https://image.tmdb.org/t/p/w342${pick.poster_path}`
    : null;

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
        />
      </div>
      <div className="mt-4 min-w-0 flex-1 md:mt-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-desert-orange">
          Double feature
        </p>
        <h3 className="mt-2 font-display text-2xl tracking-[-0.02em]">
          Pair with{" "}
          <Link href={`/movies/${pick.id}`} className="text-desert-orange hover:underline">
            {pick.title}
          </Link>
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Still member rooms love a good twin bill — follow up{" "}
          <span className="text-foreground/90">{currentTitle}</span> with something that rhymes
          tonally.
        </p>
        <Link
          href={`/movies/${pick.id}`}
          className="mt-4 inline-block text-xs font-medium uppercase tracking-wider text-foreground hover:text-desert-orange"
        >
          Second screening →
        </Link>
      </div>
    </div>
  );
}
