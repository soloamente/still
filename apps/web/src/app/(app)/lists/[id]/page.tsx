import { Button } from "@still/ui/components/button";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { MoviePoster } from "@/components/movie/movie-poster";
import { Section } from "@/components/ui/section";
import { authServer } from "@/lib/auth-server";
import { formatDistanceToNowStrict } from "@/lib/format";
import { serverApi } from "@/lib/server-api";

export const dynamic = "force-dynamic";

type ListDetail = {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  itemsCount: number;
  coverMovieIds: number[];
  isPublic: boolean;
  isRanked: boolean;
  updatedAt: string;
  items: {
    item: { id: string; position: number; note: string | null; movieId: number };
    movie: { tmdbId: number; title: string; posterPath: string | null } | null;
  }[];
};

export default async function ListDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const api = await serverApi();
  const res = await api.api.lists({ id }).get();
  const data = res.data as ListDetail | null;
  if (!data) notFound();
  const session = await authServer();
  const isOwner = session?.user.id === data.userId;

  return (
    <div className="space-y-10">
      <header className="space-y-4">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">List</p>
        <h1 className="font-display text-4xl font-medium tracking-[-0.02em] md:text-5xl">
          {data.title}
        </h1>
        {data.description ? (
          <p className="font-editorial max-w-3xl text-base text-foreground/85">
            {data.description}
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          {data.itemsCount} films · updated{" "}
          {formatDistanceToNowStrict(new Date(data.updatedAt))} ago
          {data.isPublic ? "" : " · private"}
        </p>
        {isOwner ? (
          <div className="flex gap-2">
            <Link href={`/lists/${data.id}/edit`}>
              <Button variant="ghost-light" size="pill">
                Edit
              </Button>
            </Link>
          </div>
        ) : null}
      </header>
      <Section title="Films">
        <ol className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6">
          {data.items.map((row, idx) =>
            row.movie ? (
              <li key={row.item.id} className="space-y-1.5">
                <MoviePoster
                  movieId={row.movie.tmdbId}
                  title={row.movie.title}
                  posterUrl={
                    row.movie.posterPath
                      ? `https://image.tmdb.org/t/p/w342${row.movie.posterPath}`
                      : null
                  }
                />
                <p className="line-clamp-2 text-xs text-muted-foreground">
                  {data.isRanked ? <span className="text-foreground">{idx + 1}. </span> : null}
                  {row.movie.title}
                </p>
              </li>
            ) : null,
          )}
        </ol>
      </Section>
    </div>
  );
}
