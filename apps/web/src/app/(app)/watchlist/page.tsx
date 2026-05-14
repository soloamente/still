import type { Metadata } from "next";

import { TicketStub } from "@/components/cinema/ticket-stub";
import { Section } from "@/components/ui/section";
import { formatDate } from "@/lib/format";
import { serverApi } from "@/lib/server-api";

export const metadata: Metadata = { title: "Watchlist" };
export const dynamic = "force-dynamic";

type WatchlistRow = {
  item: { addedAt: string; movieId: number };
  movie: { tmdbId: number; title: string; posterPath: string | null } | null;
};

export default async function WatchlistPage() {
  const api = await serverApi();
  const res = await api.api.watchlist.get().catch(() => ({ data: [] }));
  const items = (res.data as unknown as WatchlistRow[]) ?? [];

  return (
    <div className="space-y-10">
      <Section
        kicker="Concessions stand"
        title="Watchlist"
        subtitle={`${items.length} film${items.length === 1 ? "" : "s"} clipped to your concession rail — souvenirs for showtimes that haven’t started yet.`}
      >
        {items.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center text-sm text-muted-foreground">
            The booth is empty. When something catches your eye, open its page and tap{" "}
            <strong className="text-foreground">Watchlist</strong> — we&apos;ll hold your seat.
          </p>
        ) : (
          <ul
            className="watchlist-ticket-stack mx-auto flex max-w-7xl flex-wrap justify-center gap-x-10 gap-y-16 pb-12 pt-4"
            aria-label="Watchlist tickets — hover any slip to spotlight it."
          >
            {items.map((row) =>
              row.movie ? (
                <li key={row.item.movieId} className="flex justify-center">
                  {/* `linkHoverGrow={false}` — stack CSS owns lift; avoids nested scale transforms */}
                  <TicketStub
                    linkHoverGrow={false}
                    href={`/movies/${row.movie.tmdbId}`}
                    ariaLabel={`Open film: ${row.movie.title}; held since ${formatDate(new Date(row.item.addedAt))}`}
                    posterUrl={row.movie.posterPath}
                    posterAlt=""
                    stubBackground="#5c1730"
                    size="default"
                    stubKicker="Held ticket"
                  >
                    <h2 className="font-display line-clamp-4 text-center text-[1.05rem] leading-snug font-normal tracking-[-0.02em]">
                      {row.movie.title}
                    </h2>
                    <p className="mt-2 text-center text-[10px] tabular-nums tracking-wide text-white/68">
                      Clipped · {formatDate(new Date(row.item.addedAt), { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  </TicketStub>
                </li>
              ) : null,
            )}
          </ul>
        )}
      </Section>
    </div>
  );
}
