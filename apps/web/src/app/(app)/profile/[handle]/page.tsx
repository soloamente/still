import { Button } from "@still/ui/components/button";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { FollowButton } from "@/components/profile/follow-button";
import { CreditsFooter } from "@/components/cinema/credits-footer";
import { Letterbox } from "@/components/cinema/letterbox";
import { MoviePoster } from "@/components/movie/movie-poster";
import { ReviewCard } from "@/components/review/review-card";
import { Section } from "@/components/ui/section";
import { authServer } from "@/lib/auth-server";
import { profileBannerImageUrl } from "@/lib/profile-banner";
import { serverApi } from "@/lib/server-api";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  return { title: `@${handle}` };
}

type ProfileData = {
  user: { id: string; name: string | null; image: string | null };
  profile: {
    userId: string;
    handle: string;
    displayName: string;
    bio: string | null;
    pronouns: string | null;
    location: string | null;
    website: string | null;
    bannerUrl: string | null;
    accentColor: string | null;
    favoriteMovieIds: number[];
    sectionOrder: string[] | null;
    isPrivate: boolean;
  };
  stats: { followers: number; following: number };
  isFollowing: boolean;
  recentlyWatched: {
    log: {
      id: string;
      watchedAt: string;
      rating: number | null;
      liked: boolean;
    };
    movie: { tmdbId: number; title: string; posterPath: string | null } | null;
  }[];
  recentReviews: {
    review: {
      id: string;
      userId: string;
      movieId: number;
      title: string | null;
      body: string;
      rating: number | null;
      likesCount: number;
      commentsCount: number;
      publishedAt: string;
    };
    movie: { tmdbId: number; title: string; posterPath: string | null } | null;
  }[];
  lists: {
    id: string;
    title: string;
    itemsCount: number;
    coverMovieIds: number[];
    updatedAt: string;
    isPublic: boolean;
    description: string | null;
  }[];
  pinnedBadges: {
    badgeId: string;
    awardedAt: string;
  }[];
};

/** Public profile rails after filmography (“recent posters” folds into credits grid). */
const SECTION_ORDER_KEYS = ["favorites", "reviews", "lists"] as const;

/**
 * Deduplicates watch logs by movie so filmography stays one credit line per title.
 * Tie-break keeps the freshest `watchedAt` when multiple logs exist for the same `tmdbId`.
 */
function filmographyFromRecentlyWatched(
  recentlyWatched: ProfileData["recentlyWatched"],
): ProfileData["recentlyWatched"] {
  const byTmdbId = new Map<number, ProfileData["recentlyWatched"][number]>();
  for (const row of recentlyWatched) {
    if (!row.movie) continue;
    const existing = byTmdbId.get(row.movie.tmdbId);
    const nextTs = new Date(row.log.watchedAt).getTime();
    const prevTs = existing ? new Date(existing.log.watchedAt).getTime() : -Infinity;
    if (!existing || nextTs >= prevTs) {
      byTmdbId.set(row.movie.tmdbId, row);
    }
  }
  return [...byTmdbId.values()].sort(
    (a, b) => new Date(b.log.watchedAt).getTime() - new Date(a.log.watchedAt).getTime(),
  );
}

function creditsRatingLabel(row: ProfileData["recentlyWatched"][number]): string {
  const r = row.log.rating;
  if (r != null && r > 0) return `${String(r)} / 10`;
  return row.log.liked ? "Liked" : "—";
}

function creditsYearISO(isoDate: string): string {
  const y = isoDate.slice(0, 4);
  return y.length === 4 ? y : "—";
}

export default async function ProfilePage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const session = await authServer();
  const api = await serverApi();
  const res = await api.api.profiles({ handle }).get();
  const data = res.data as ProfileData | null;
  if (!data) notFound();
  const { profile, user, stats } = data;
  const isMe = session?.user.id === user.id;

  const favoritesRes = profile.favoriteMovieIds.length
    ? await api.api.movies.batch.post({ ids: profile.favoriteMovieIds }).catch(() => ({ data: [] }))
    : { data: [] };
  const favorites =
    (favoritesRes.data as unknown as {
      tmdbId: number;
      title: string;
      posterPath: string | null;
    }[]) ?? [];

  const orderRaw = profile.sectionOrder?.length ? profile.sectionOrder : [...SECTION_ORDER_KEYS];
  /** Legacy sections like `recent` are ignored now that filmography covers watch history. */
  const order = orderRaw.filter((s): s is (typeof SECTION_ORDER_KEYS)[number] =>
    (SECTION_ORDER_KEYS as readonly string[]).includes(s),
  );

  const accent = profile.accentColor ?? "#b75928";
  const filmographyRows = filmographyFromRecentlyWatched(data.recentlyWatched);

  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 xl:-mx-12 2xl:-mx-16">
      <header className="relative overflow-hidden border-b border-border">
        {profile.bannerUrl ? (
          <Letterbox aspect="21:9" bars className="w-full">
            <div className="absolute inset-0">
              <Image
                // Proxied through the API so private Blob stores work (raw `blob.url` is not public).
                src={profileBannerImageUrl(handle)}
                alt=""
                fill
                sizes="100vw"
                priority
                unoptimized
                className="object-cover opacity-50"
              />
              <div
                className="absolute inset-0"
                style={{
                  background: `linear-gradient(to bottom, color-mix(in oklab, ${accent} 15%, transparent), var(--background))`,
                }}
              />
            </div>
          </Letterbox>
        ) : (
          <div
            className="h-44 w-full sm:h-52"
            style={{
              background: `linear-gradient(to bottom, color-mix(in oklab, ${accent} 22%, transparent), var(--background))`,
            }}
          />
        )}
        <div className="relative z-10 mx-auto flex max-w-7xl flex-col items-start gap-6 px-3 py-10 sm:px-4 md:-mt-10 md:flex-row md:items-end md:px-5 md:py-16">
          <div className="flex-1 space-y-2">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              @{profile.handle}
            </p>
            <h1 className="font-display text-4xl font-medium tracking-[-0.02em] md:text-6xl">
              {profile.displayName}
            </h1>
            {profile.pronouns ? (
              <p className="text-sm text-muted-foreground">{profile.pronouns}</p>
            ) : null}
            {profile.bio ? (
              <p className="font-editorial max-w-2xl text-base text-foreground/85">{profile.bio}</p>
            ) : null}
            <ul className="flex gap-4 pt-2 text-xs text-muted-foreground">
              <li>
                <span className="text-foreground">{stats.followers}</span> followers
              </li>
              <li>
                <span className="text-foreground">{stats.following}</span> following
              </li>
              {profile.location ? <li>· {profile.location}</li> : null}
              {profile.website ? (
                <li>
                  ·{" "}
                  <a
                    href={profile.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-foreground hover:underline"
                  >
                    {profile.website.replace(/^https?:\/\//, "")}
                  </a>
                </li>
              ) : null}
            </ul>
          </div>
          <div className="flex gap-2">
            {isMe ? (
              <>
                <Link href="/me/customization">
                  <Button variant="ghost-light" size="pill">
                    Customize
                  </Button>
                </Link>
                <Link href="/me/settings">
                  <Button variant="accent" size="pill">
                    Edit profile
                  </Button>
                </Link>
              </>
            ) : (
              <FollowButton targetUserId={user.id} />
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-12 px-3 py-12 sm:px-4 md:px-5">
        {/* Phase 5 — Credits-style ledger: YEAR · TITLE · RATING replaces the scattered “recently watched” posters. */}
        {filmographyRows.length ? (
          <Section
            kicker="On the ledger"
            title="Filmography"
            subtitle="A rolling credit line distilled from screenings you’ve stepped out for."
          >
            <div
              className="grid grid-cols-[4.75rem,minmax(0,1fr),minmax(0,7.5rem)] gap-x-4 gap-y-2 border border-border/60 bg-card/40 px-3 py-4 text-sm sm:gap-x-6 sm:px-5 md:grid-cols-[5rem,minmax(0,1fr),minmax(0,8rem)]"
              role="table"
              aria-label="Filmography credits"
            >
              <span
                role="columnheader"
                className="font-display text-[10px] font-medium uppercase tracking-[0.32em] text-muted-foreground"
              >
                Year
              </span>
              <span
                role="columnheader"
                className="font-display text-[10px] font-medium uppercase tracking-[0.32em] text-muted-foreground"
              >
                Title
              </span>
              <span
                role="columnheader"
                className="hidden text-right font-display text-[10px] font-medium uppercase tracking-[0.32em] text-muted-foreground sm:block"
              >
                Score
              </span>
              {filmographyRows.map((row) => {
                const y = creditsYearISO(row.log.watchedAt);
                const titleCell = row.movie ? (
                  <Link
                    href={`/movies/${String(row.movie.tmdbId)}`}
                    className="font-display hover:text-desert-orange"
                  >
                    {row.movie.title}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">Unknown title</span>
                );
                return (
                  <div key={row.log.id} className="contents" role="row">
                    <span
                      className="tabular-nums text-xs uppercase text-muted-foreground"
                      role="cell"
                      aria-label={`Release year watched ${row.log.watchedAt}`}
                    >
                      {y}
                    </span>
                    <span className="leading-snug" role="cell">
                      {titleCell}
                    </span>
                    <span
                      className="text-right tabular-nums text-xs text-muted-foreground"
                      role="cell"
                    >
                      {creditsRatingLabel(row)}
                    </span>
                  </div>
                );
              })}
            </div>
          </Section>
        ) : null}

        {order.some((sec) => {
          if (sec === "favorites" && favorites.length) return true;
          if (sec === "reviews" && data.recentReviews.length) return true;
          if (sec === "lists" && data.lists.length) return true;
          return false;
        }) ? (
          <Section
            kicker="Lobby board"
            title="Also credited for"
            subtitle="The rest of the programme — marquee picks still live here."
          >
            <div className="space-y-12">
              {order.flatMap((sec) => {
                if (sec === "favorites" && favorites.length) {
                  return [
                    <Section key="favorites" title="Favorites">
                      <div className="grid grid-cols-4 gap-4 md:grid-cols-8">
                        {favorites.map((f) => (
                          <MoviePoster
                            key={f.tmdbId}
                            movieId={f.tmdbId}
                            title={f.title}
                            posterUrl={
                              f.posterPath ? `https://image.tmdb.org/t/p/w342${f.posterPath}` : null
                            }
                          />
                        ))}
                      </div>
                    </Section>,
                  ];
                }
                if (sec === "reviews" && data.recentReviews.length) {
                  return [
                    <Section key="reviews" title="Reviews">
                      <ul className="grid gap-4 md:grid-cols-2">
                        {data.recentReviews.map((r) => (
                          <li key={r.review.id}>
                            <ReviewCard review={r.review} />
                          </li>
                        ))}
                      </ul>
                    </Section>,
                  ];
                }
                if (sec === "lists" && data.lists.length) {
                  return [
                    <Section key="lists" title="Lists">
                      <ul className="grid gap-4 md:grid-cols-2">
                        {data.lists.map((l) => (
                          <li key={l.id}>
                            <Link
                              href={`/lists/${l.id}`}
                              className="block rounded-2xl border border-border bg-card/60 p-4 hover:border-desert-orange/40"
                            >
                              <h3 className="font-serif text-lg">{l.title}</h3>
                              <p className="text-xs text-muted-foreground">{l.itemsCount} films</p>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </Section>,
                  ];
                }
                return [];
              })}
            </div>
          </Section>
        ) : null}

        <CreditsFooter
          lines={[
            `Patron · @${profile.handle}`,
            `${stats.followers} followers · ${stats.following} following`,
            `${filmographyRows.length} titles on ledger`,
          ]}
        />
      </div>
    </div>
  );
}
