import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Calendar, Clapperboard } from "lucide-react";

import { MoviePoster } from "@/components/movie/movie-poster";
import { Section } from "@/components/ui/section";
import { formatDate } from "@/lib/format";
import { serverApi } from "@/lib/server-api";

export const dynamic = "force-dynamic";

/**
 * Mirrors `(app)/layout.tsx` `main` bottom padding reserve for the floating nav + safe-area.
 * Short person pages span this height so profile content can sit visually centered vertically.
 */
const APP_SHELL_MIN_HEIGHT_ABOVE_NAV: CSSProperties = {
  minHeight: "calc(100svh - max(6rem, calc(4.75rem + env(safe-area-inset-bottom, 0px))))",
};

type PersonPayload = {
  code?: "TMDB_UNCONFIGURED";
  hint?: string;
  person: {
    id: number;
    name: string;
    biography: string;
    birthday: string | null;
    deathday: string | null;
    knownForDepartment?: string;
    profilePath: string | null;
    profileUrl: string | null;
  } | null;
  filmography: {
    tmdbId: number;
    title: string;
    posterUrl: string | null;
    /** ISO date string from the API; may deserialize oddly on the client in some stacks. */
    releaseDate: string | null;
    roles: string[];
  }[];
};

/**
 * Filmography rows use `releaseDate` for sorting and display; treat strings and
 * revived `Date` instances the same so `.slice` never runs on non-strings.
 */
function filmographyReleaseYear(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw === "string") {
    const s = raw.trim();
    return s.length >= 4 ? s.slice(0, 4) : s || null;
  }
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return String(raw.getFullYear());
  }
  return null;
}

type Params = { id: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isFinite(numericId)) return { title: "Person" };

  const api = await serverApi();
  const res = await api.api.people({ id }).get().catch(() => ({ data: null as PersonPayload | null }));
  const data = res.data as PersonPayload | null;
  const name = data?.person?.name;
  return { title: name ? `${name} · Filmography` : "Person" };
}

export default async function PersonPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isFinite(numericId)) notFound();

  const api = await serverApi();
  const res = await api.api.people({ id }).get().catch(() => ({ data: null as PersonPayload | null }));
  const data = res.data as PersonPayload | null;

  if (!data) notFound();

  if (data.code === "TMDB_UNCONFIGURED") {
    return (
      <div className="flex w-full flex-col justify-center" style={APP_SHELL_MIN_HEIGHT_ABOVE_NAV}>
        <div className="mx-auto max-w-lg text-center">
          <p className="text-sm text-muted-foreground">{data.hint}</p>
        </div>
      </div>
    );
  }

  const person = data.person;
  if (!person) notFound();

  const lifeSpan =
    person.birthday || person.deathday
      ? [
          person.birthday ? formatDate(new Date(person.birthday)) : "?",
          person.deathday ? formatDate(new Date(person.deathday)) : null,
        ]
          .filter(Boolean)
          .join(" — ")
      : null;

  // Horizontal: narrower column centered in `max-w-7xl`.
  // Vertical: flex + min-height aligns short pages in the band above the bottom nav (`(app)` layout).
  return (
    <div className="flex w-full flex-col justify-center" style={APP_SHELL_MIN_HEIGHT_ABOVE_NAV}>
      <article className="mx-auto w-full max-w-5xl space-y-10 pb-12 pt-6">
      <header className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <div className="relative mx-auto aspect-[2/3] w-48 shrink-0 overflow-hidden rounded-md border border-border bg-card sm:mx-0 sm:w-40 md:w-44">
          {person.profileUrl ? (
            <Image src={person.profileUrl} alt={person.name} fill className="object-cover" sizes="176px" priority />
          ) : (
            <div className="grid size-full place-items-center text-muted-foreground">
              <Clapperboard className="size-10" aria-hidden />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-3 text-center sm:text-left">
          {person.knownForDepartment ? (
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{person.knownForDepartment}</p>
          ) : null}
          <h1 className="font-editorial text-3xl font-medium tracking-tight text-foreground md:text-4xl">{person.name}</h1>
          {lifeSpan ? (
            <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground sm:justify-start">
              <Calendar className="size-4 shrink-0" aria-hidden />
              {lifeSpan}
            </p>
          ) : null}
          {person.biography?.trim() ? (
            <p className="max-w-3xl text-pretty text-sm leading-relaxed text-foreground/85 line-clamp-6 sm:line-clamp-none">
              {person.biography.trim()}
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Credits from{" "}
            <a
              href={`https://www.themoviedb.org/person/${person.id}`}
              className="underline underline-offset-2 hover:text-foreground"
              target="_blank"
              rel="noreferrer"
            >
              TMDb
            </a>
            .
          </p>
        </div>
      </header>

      <Section
        title="Filmography"
        subtitle={`${data.filmography.length} title${data.filmography.length === 1 ? "" : "s"} with this person in cast or crew.`}
      >
        {data.filmography.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center text-sm text-muted-foreground">
            No film credits loaded yet. Try again after the API syncs with TMDb.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
            {data.filmography.map((m) => {
              const yearLabel = filmographyReleaseYear(m.releaseDate);
              return (
                <div key={m.tmdbId} className="min-w-0">
                  <MoviePoster movieId={m.tmdbId} title={m.title} posterUrl={m.posterUrl} showTitle />
                  <p className="mt-1 line-clamp-3 text-[10px] leading-snug text-muted-foreground">{m.roles.join(" · ")}</p>
                  {yearLabel ? (
                    <p className="mt-0.5 text-[10px] tabular-nums text-muted-foreground/80">{yearLabel}</p>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </Section>

      <p className="text-center text-xs text-muted-foreground">
        <Link href="/search" className="underline underline-offset-2 hover:text-foreground">
          Search films
        </Link>
      </p>
      </article>
    </div>
  );
}
