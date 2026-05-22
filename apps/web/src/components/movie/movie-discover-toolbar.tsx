import { FilterChipLink, FilterChipRow } from "@/components/ui/filter-chip-row";
import {
	DISCOVER_SORT_DEFAULT,
	DISCOVER_SORT_OPTIONS,
	discoverCatalogUrl,
} from "@/lib/discover-catalog-url";
import type { HomeVenue } from "@/lib/home-venue";

type Genre = { id: number; name: string };

/**
 * Track B.5.2 — TMDb discover filters as Mobbin-style chip rows (server-rendered
 * links so filters work without JS and stay shareable).
 */
export function MovieDiscoverToolbar({
	genres,
	appliedGenre,
	appliedCompany,
	appliedSort,
	appliedVenue,
	appliedMonetization,
	appliedWatchRegion,
	appliedReleaseRegion,
	appliedReleaseGte,
}: {
	genres: Genre[];
	appliedGenre: number | null;
	/** TMDb production company — preserved when changing genre or sort. */
	appliedCompany?: number | null;
	appliedSort: string;
	/** When set, genre + sort chip hrefs preserve the theatrical vs digital-at-home slice. */
	appliedVenue?: HomeVenue | null;
	/** Preserve subscription/rent filters when pivoting genre or sort (home “Streaming + Popular” deep-link). */
	appliedMonetization?: string | null;
	/** Optional region lock for monetization filters — rare in URLs; server defaults otherwise. */
	appliedWatchRegion?: string | null;
	/** TMDb theatrical `region` when using in-cinemas discover (optional override). */
	appliedReleaseRegion?: string | null;
	/** `release_gte` (YYYY-MM-DD) when using future-window discover (optional). */
	appliedReleaseGte?: string | null;
}) {
	const sort = appliedSort.trim() || DISCOVER_SORT_DEFAULT;
	const venueParam =
		appliedVenue === "theaters" || appliedVenue === "streaming"
			? appliedVenue
			: undefined;
	const mon = appliedMonetization?.trim() || null;
	const wr = appliedWatchRegion?.trim().toUpperCase() || null;
	const relReg = appliedReleaseRegion?.trim().toUpperCase() || null;
	const relGte = appliedReleaseGte?.trim() || null;
	const companyId =
		appliedCompany != null && appliedCompany > 0 ? appliedCompany : null;

	return (
		<div className="space-y-3">
			<div className="-mx-1 overflow-x-auto pb-1 [scrollbar-width:thin]">
				<FilterChipRow
					aria-label="Filter by genre"
					className="min-w-min flex-nowrap gap-2 px-1"
				>
					<FilterChipLink
						href={discoverCatalogUrl({
							companyId,
							sort,
							venue: venueParam,
							monetization: mon,
							watchRegion: wr && /^[A-Z]{2}$/.test(wr) ? wr : null,
							region: relReg && /^[A-Z]{2}$/.test(relReg) ? relReg : null,
							releaseGte:
								relGte && /^\d{4}-\d{2}-\d{2}$/.test(relGte) ? relGte : null,
						})}
						selected={appliedGenre == null}
					>
						All genres
					</FilterChipLink>
					{genres.map((g) => (
						<FilterChipLink
							key={g.id}
							href={discoverCatalogUrl({
								companyId,
								genreId: g.id,
								sort: sort !== DISCOVER_SORT_DEFAULT ? sort : null,
								venue: venueParam,
								monetization: mon,
								watchRegion: wr && /^[A-Z]{2}$/.test(wr) ? wr : null,
								region: relReg && /^[A-Z]{2}$/.test(relReg) ? relReg : null,
								releaseGte:
									relGte && /^\d{4}-\d{2}-\d{2}$/.test(relGte) ? relGte : null,
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
							companyId,
							genreId: appliedGenre ?? undefined,
							sort: opt.value,
							venue: venueParam,
							monetization: mon,
							watchRegion: wr && /^[A-Z]{2}$/.test(wr) ? wr : null,
							region: relReg && /^[A-Z]{2}$/.test(relReg) ? relReg : null,
							releaseGte:
								relGte && /^\d{4}-\d{2}-\d{2}$/.test(relGte) ? relGte : null,
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
