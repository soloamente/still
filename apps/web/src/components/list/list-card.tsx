import Image from "next/image";
import Link from "next/link";

import { formatDistanceToNowStrict } from "@/lib/format";

type List = {
  id: string;
  title: string;
  description: string | null;
  itemsCount: number;
  coverMovieIds: number[];
  updatedAt: string;
  isPublic: boolean;
};

/**
 * Stacked-poster list preview. We don't have poster paths on the list
 * row itself — the cover ids resolve via /movies/[id] hover and the
 * detail page proper.
 */
export function ListCard({ list }: { list: List }) {
  return (
    <Link
      href={`/lists/${list.id}`}
      className="group flex gap-4 rounded-2xl border border-border bg-card/60 p-4 transition-colors hover:border-desert-orange/40"
    >
      <div className="relative h-20 w-32 shrink-0">
        {list.coverMovieIds.slice(0, 3).map((id, idx) => (
          <span
            key={id}
            className="absolute top-0 aspect-[2/3] h-20 overflow-hidden rounded-sm border border-border bg-card"
            style={{
              left: `${idx * 18}px`,
              zIndex: 3 - idx,
              transform: `rotate(${(idx - 1) * 4}deg)`,
            }}
          >
            {/* Cover thumbnails resolve via TMDb without our knowing the
                poster path here; fall back to a neutral block. */}
            <Image
              src={`https://image.tmdb.org/t/p/w185/${id}.jpg`}
              alt=""
              fill
              sizes="80px"
              className="object-cover opacity-90"
              unoptimized
            />
          </span>
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="font-serif text-xl">{list.title}</h3>
        <p className="text-xs text-muted-foreground">
          {list.itemsCount} films · updated {formatDistanceToNowStrict(new Date(list.updatedAt))}{" "}
          ago
          {list.isPublic ? "" : " · private"}
        </p>
        {list.description ? (
          <p className="font-editorial mt-2 line-clamp-2 text-sm text-foreground/80">
            {list.description}
          </p>
        ) : null}
      </div>
    </Link>
  );
}
