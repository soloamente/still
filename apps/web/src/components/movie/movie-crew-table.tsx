import Link from "next/link";
import { Fragment } from "react";

import type { CrewRow } from "@/lib/movie-detail-tmdb";

/**
 * Read-only crew grid — job column + linked names so visitors can open each
 * person’s filmography (TMDb-backed).
 */
export function MovieCrewTable({ rows }: { rows: CrewRow[] }) {
  if (!rows.length) return null;
  return (
    <div className="divide-y divide-border rounded-xl border border-border bg-card/40">
      {rows.map((row) => (
        <div
          key={row.job}
          className="grid gap-2 px-3 py-2.5 sm:grid-cols-[minmax(0,11rem)_1fr] sm:gap-6 sm:px-4"
        >
          <p className="text-xs font-medium text-muted-foreground sm:pt-0.5">{row.job}</p>
          <p className="text-sm text-foreground select-none [&_a]:select-text">
            {row.people.map((p, i) => (
              <Fragment key={p.id}>
                {i > 0 ? ", " : null}
                <Link
                  href={`/people/${p.id}`}
                  className="underline-offset-2 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  {p.name}
                </Link>
              </Fragment>
            ))}
          </p>
        </div>
      ))}
    </div>
  );
}
