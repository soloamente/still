import { FilterChipLink, FilterChipRow } from "@/components/ui/filter-chip-row";
import {
	DISCOVER_SORT_DEFAULT,
	DISCOVER_SORT_OPTIONS,
	discoverCatalogUrl,
} from "@/lib/discover-catalog-url";

type Genre = { id: number; name: string };

/**
 * Track B.5.2 — TMDb discover filters as Mobbin-style chip rows (server-rendered
 * links so filters work without JS and stay shareable).
 */
export function MovieDiscoverToolbar({
	genres,
	appliedGenre,
	appliedSort,
}: {
	genres: Genre[];
	appliedGenre: number | null;
	appliedSort: string;
}) {
	const sort = appliedSort.trim() || DISCOVER_SORT_DEFAULT;

	return (
		<div className="space-y-3">
			<div className="-mx-1 overflow-x-auto pb-1 [scrollbar-width:thin]">
				<FilterChipRow
					aria-label="Filter by genre"
					className="min-w-min flex-nowrap gap-2 px-1"
				>
					<FilterChipLink
						href={discoverCatalogUrl({ sort })}
						selected={appliedGenre == null}
					>
						All genres
					</FilterChipLink>
					{genres.map((g) => (
						<FilterChipLink
							key={g.id}
							href={discoverCatalogUrl({
								genreId: g.id,
								sort: sort !== DISCOVER_SORT_DEFAULT ? sort : null,
							})}
							selected={appliedGenre === g.id}
						>
							{g.name}
						</FilterChipLink>
					))}
				</FilterChipRow>
			</div>

			<FilterChipRow
				aria-label="Sort catalogue"
				className="max-w-full flex-wrap gap-2"
			>
				{DISCOVER_SORT_OPTIONS.map((opt) => (
					<FilterChipLink
						key={opt.value}
						href={discoverCatalogUrl({
							genreId: appliedGenre ?? undefined,
							sort: opt.value,
						})}
						selected={sort === opt.value}
					>
						{opt.label}
					</FilterChipLink>
				))}
			</FilterChipRow>
		</div>
	);
}
