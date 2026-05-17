import type { Metadata } from "next";
import { Suspense } from "react";

import { SearchClient } from "@/components/search/search-client";

export const metadata: Metadata = { title: "Search" };

/** Stable keys for static skeleton cells (Biome forbids array index as `key`). */
const SEARCH_FALLBACK_PLACEHOLDER_KEYS = [
	"search-fallback-skel-a",
	"search-fallback-skel-b",
	"search-fallback-skel-c",
	"search-fallback-skel-d",
	"search-fallback-skel-e",
	"search-fallback-skel-f",
] as const;

/** Shown briefly while client `useSearchParams` binds (same static-render contract as `/sign-in`). */
function SearchClientFallback() {
	return (
		<section className="space-y-4" aria-busy="true" aria-label="Loading search">
			<div className="space-y-1">
				<div className="h-9 w-32 rounded-md bg-muted/60" />
				<div className="h-4 max-w-md rounded-md bg-muted/40" />
			</div>
			<div className="h-12 max-w-2xl rounded-full border border-border bg-surface-raised/50" />
			<div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6">
				{SEARCH_FALLBACK_PLACEHOLDER_KEYS.map((placeholderKey) => (
					<div
						key={placeholderKey}
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
