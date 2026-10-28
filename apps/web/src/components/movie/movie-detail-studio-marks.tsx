"use client";

import Image from "next/image";

import { useCatalogSearchDialog } from "@/lib/catalog-search-dialog-store";
import type { MovieStudioMark } from "@/lib/movie-studio-credit";
import { studioSearchButtonLabel } from "@/lib/movie-studio-credit";
import type { SearchTag } from "@/lib/search-query-tags";

/** Studio credit under the title. A click searches that studio's films or shows. */
export function MovieDetailStudioMarks({
	marks,
	nameFallback,
	listingKind,
}: {
	marks: readonly MovieStudioMark[];
	nameFallback: { id: number; name: string } | null;
	listingKind: "movie" | "tv";
}) {
	const requestOpenWithSeed = useCatalogSearchDialog(
		(s) => s.requestOpenWithSeed,
	);

	function openStudioSearch(company: {
		id: number;
		name: string;
		logoUrl: string | null;
	}) {
		const tags: SearchTag[] = [
			{ kind: "media", listingKind },
			{
				kind: "studio",
				id: company.id,
				name: company.name,
				logoUrl: company.logoUrl,
			},
		];
		requestOpenWithSeed({ listingKind, tags });
	}

	if (marks.length > 0) {
		return (
			<div className="mt-4 flex max-w-full flex-wrap items-center justify-center gap-x-2 gap-y-1">
				{marks.map((mark) => (
					<button
						key={mark.id}
						type="button"
						className="inline-flex min-h-11 select-none items-center justify-center rounded-lg px-2 focus-visible:shadow-[0_0_0_2px_var(--foreground)] focus-visible:outline-none [@media(hover:hover)]:hover:opacity-80"
						aria-label={studioSearchButtonLabel(mark.name, listingKind)}
						onClick={() =>
							openStudioSearch({
								id: mark.id,
								name: mark.name,
								logoUrl: mark.logoUrl,
							})
						}
					>
						{/* The button name is the studio. The image is the same words as a mark. */}
						<Image
							src={mark.logoUrl}
							alt=""
							width={180}
							height={36}
							unoptimized
							className="movie-studio-mark"
						/>
					</button>
				))}
			</div>
		);
	}

	if (!nameFallback) return null;

	return (
		<button
			type="button"
			className="mt-4 min-h-11 select-none rounded-lg px-2 text-muted-foreground text-sm focus-visible:shadow-[0_0_0_2px_var(--foreground)] focus-visible:outline-none [@media(hover:hover)]:hover:text-foreground"
			onClick={() =>
				openStudioSearch({
					id: nameFallback.id,
					name: nameFallback.name,
					logoUrl: null,
				})
			}
			aria-label={studioSearchButtonLabel(nameFallback.name, listingKind)}
		>
			{nameFallback.name}
		</button>
	);
}
