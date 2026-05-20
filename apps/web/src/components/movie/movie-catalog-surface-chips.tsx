"use client";

import { usePathname } from "next/navigation";

import { FilterChipLink, FilterChipRow } from "@/components/ui/filter-chip-row";

/**
 * Track B — shared browse chips for TMDB-backed catalogues (`/movies/popular`,
 * `/movies/now-playing`, `/movies/upcoming`). Keeps surface switching one tap away from the grid.
 */
export function MovieCatalogSurfaceChips() {
	const pathname = usePathname();
	const onPopular = pathname.startsWith("/movies/popular");
	const onNowPlaying = pathname.startsWith("/movies/now-playing");
	const onUpcoming = pathname.startsWith("/movies/upcoming");
	const onDiscover = pathname.startsWith("/movies/discover");

	return (
		<FilterChipRow className="mb-4" aria-label="Browse TMDb catalogues">
			<FilterChipLink href="/movies/popular" selected={onPopular}>
				Popular
			</FilterChipLink>
			<FilterChipLink href="/movies/now-playing" selected={onNowPlaying}>
				In theatres
			</FilterChipLink>
			<FilterChipLink href="/movies/upcoming" selected={onUpcoming}>
				Opening soon
			</FilterChipLink>
			<FilterChipLink href="/movies/discover" selected={onDiscover}>
				Discover
			</FilterChipLink>
		</FilterChipRow>
	);
}
