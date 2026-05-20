import { normalizeDiscoverMonetization } from "@/lib/discover-catalog-url";

/**
 * Canonical query builder for `/tv/discover` — keeps home “Filters” links and any
 * future TV discover UI aligned with `GET /api/tv/discover`.
 */
export function tvDiscoverCatalogUrl(parts: {
	genreId?: number | null;
	sort?: string | null;
	/** TMDb `first_air_date.gte` (YYYY-MM-DD). */
	airDateGte?: string | null;
	monetization?: string | null;
	watchRegion?: string | null;
}) {
	const params = new URLSearchParams();
	if (parts.genreId != null && parts.genreId > 0) {
		params.set("genre", String(parts.genreId));
	}
	const s = parts.sort?.trim();
	if (s && s !== "popularity.desc") {
		params.set("sort", s);
	}
	const ag = parts.airDateGte?.trim();
	if (ag && /^\d{4}-\d{2}-\d{2}$/.test(ag)) {
		params.set("air_date_gte", ag);
	}
	const m = normalizeDiscoverMonetization(parts.monetization);
	if (m) {
		params.set("monetization", m);
	}
	const wr = parts.watchRegion?.trim().toUpperCase();
	if (wr === "ALL" || wr === "ANY" || wr === "WORLD") {
		params.set("watch_region", "ALL");
	} else if (wr && /^[A-Z]{2}$/.test(wr)) {
		params.set("watch_region", wr);
	}
	const q = params.toString();
	return q ? `/tv/discover?${q}` : "/tv/discover";
}
