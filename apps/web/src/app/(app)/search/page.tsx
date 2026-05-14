import type { Metadata } from "next";
import { Suspense } from "react";

import { SearchClient } from "@/components/search/search-client";

export const metadata: Metadata = { title: "Search" };

/** Shown briefly while client `useSearchParams` binds (same static-render contract as `/sign-in`). */
function SearchClientFallback() {
  return (
    <section className="space-y-4" aria-busy="true" aria-label="Loading search">
      <div className="space-y-1">
        <div className="h-9 w-32 rounded-md bg-muted/60" />
        <div className="h-4 max-w-md rounded-md bg-muted/40" />
      </div>
      <div className="h-10 max-w-xl rounded-[var(--radius)] border border-border bg-card/50" />
      <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <div
            key={`search-skel-${i}`}
            className="aspect-[2/3] rounded-xl border border-border bg-muted/40"
          />
        ))}
      </div>
    </section>
  );
}

export default function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  return (
    <Suspense fallback={<SearchClientFallback />}>
      <SearchClient searchParamsPromise={searchParams} />
    </Suspense>
  );
}
