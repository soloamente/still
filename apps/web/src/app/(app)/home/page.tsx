import { Button } from "@still/ui/components/button";
import { cn } from "@still/ui/lib/utils";
import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { TICK_COMPACT_FILL_RAIL_TW, TicketStub } from "@/components/cinema/ticket-stub";
import { ActivityItem } from "@/components/feed/activity-item";
import { NewsStrip } from "@/components/news/news-strip";
import { Section } from "@/components/ui/section";
import { serverApi } from "@/lib/server-api";
import { tmdbSetupHint } from "@/lib/tmdb-config";

export const metadata: Metadata = { title: "Home" };
export const dynamic = "force-dynamic";

type ActivityKind = "log" | "review" | "list";
type ActivityItemShape = { kind: ActivityKind; at: string; payload: unknown };

export default async function HomePage() {
  const api = await serverApi();
  const [feedRes, popularRes, upcomingRes, newsRes] = await Promise.all([
    api.api.feed.get().catch(() => ({ data: null })),
    api.api.movies.popular.get().catch(() => ({ data: null })),
    api.api.movies.upcoming.get().catch(() => ({ data: null })),
    api.api.news.get().catch(() => ({ data: null })),
  ]);

  const items: ActivityItemShape[] =
    (feedRes.data as { items?: ActivityItemShape[] } | null)?.items ?? [];
  const popularPayload = popularRes.data as { results?: { id: number; title: string; poster_url: string | null }[] } | null;
  const popular = popularPayload?.results?.slice(0, 12) ?? [];
  const tmdbHint = tmdbSetupHint(popularPayload);
  const upcoming =
    (upcomingRes.data as { results?: { id: number; title: string; poster_url: string | null }[] } | null)
      ?.results?.slice(0, 12) ?? [];
  const news = (newsRes.data as unknown as { article: NewsArticle; source: NewsSource | null }[] | null) ?? [];

  return (
    <div className="space-y-12">
      <Section
        kicker="Lobby chatter"
        title="Your week in film"
        subtitle="What your circle has been watching and writing about — letters from the front row."
        rightSlot={
          <Link href="/diary">
            <Button variant="ghost" size="sm">
              Your diary <ArrowRight className="ml-1 size-3.5" />
            </Button>
          </Link>
        }
      >
        {items.length ? (
          <ul className="space-y-3">
            {items.slice(0, 16).map((item, idx) => (
              <li key={`${item.kind}-${item.at}-${idx}`}>
                <ActivityItem item={item} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyFeed />
        )}
      </Section>

      <Section
        kicker="Now showing"
        title="Popular this week"
        rightSlot={
          <Link href="/movies/popular" className="text-xs text-muted-foreground hover:text-foreground">
            See all
          </Link>
        }
      >
        {tmdbHint ? (
          <p className="text-sm text-muted-foreground" role="status">
            {tmdbHint}
          </p>
        ) : null}
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 sm:gap-5 md:grid-cols-6 md:gap-6 lg:gap-7 xl:gap-8">
          {popular.map((m) => (
            <TicketStub
              key={m.id}
              ariaLabel={`Open film: ${m.title}`}
              href={`/movies/${m.id}`}
              posterAlt={m.title}
              posterFillFlexible
              posterFillTicket
              posterUrl={m.poster_url}
              size="compact"
              stubKicker="Now showing"
            >
              <h3 className="font-sans text-balance line-clamp-2 font-semibold tracking-[-0.015em] sm:tracking-tight">
                {m.title}
              </h3>
            </TicketStub>
          ))}
        </div>
      </Section>

      <Section kicker="Coming attractions" title="Coming soon" subtitle="Admission slips you can skim — tactile contrast to poster grids elsewhere.">
        {/* Horizontal rail: posterFillTicket = full-card cover art + uniform compact stub width */}
        {upcoming.length ? (
          <ul
            aria-label="Upcoming releases as ticket stubs"
            className="-mx-4 flex list-none gap-6 overflow-x-auto overscroll-x-contain px-5 py-2 [scrollbar-width:thin] max-md:snap-x max-md:snap-mandatory sm:-mx-6 sm:gap-8 sm:px-6 lg:-mx-8 lg:gap-10 lg:px-8 xl:-mx-12 xl:gap-12 xl:px-10 2xl:-mx-16 2xl:px-12"
          >
            {upcoming.map((m) => (
              <li key={m.id} className={cn("max-md:snap-start shrink-0 list-none", TICK_COMPACT_FILL_RAIL_TW)}>
                <TicketStub
                  ariaLabel={`Open film: ${m.title}`}
                  href={`/movies/${m.id}`}
                  posterUrl={m.poster_url}
                  posterAlt={m.title}
                  posterFillTicket
                  size="compact"
                  stubKicker="Coming soon"
                >
                  <h3 className="font-sans line-clamp-2 font-medium tracking-[-0.01em]">
                    {m.title}
                  </h3>
                </TicketStub>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground" role="status">
            No upcoming previews from TMDb right now — check back after the catalog sync catches the next runway.
          </p>
        )}
      </Section>

      <Section kicker="Projectionist feed" title="From the wires">
        <NewsStrip items={news.slice(0, 6)} />
      </Section>
    </div>
  );
}

type NewsArticle = {
  id: string;
  title: string;
  summary: string | null;
  url: string;
  imageUrl: string | null;
  publishedAt: string;
  movieIds: number[];
};
type NewsSource = { id: string; name: string; kind: string };

function EmptyFeed() {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center">
      <p className="font-display text-xl">No screenings logged by your circle yet.</p>
      <p className="mt-2 text-sm text-muted-foreground">
        Follow a few people whose taste you trust — their logs and reviews show up like lobby
        chatter while the house lights are still up.
      </p>
      <div className="mt-5 flex justify-center gap-2">
        <Link href="/search">
          <Button variant="accent" size="pill">
            Find people
          </Button>
        </Link>
        <Link href="/home?explore=true">
          <Button variant="ghost-light" size="pill">
            Or just explore
          </Button>
        </Link>
      </div>
    </div>
  );
}
