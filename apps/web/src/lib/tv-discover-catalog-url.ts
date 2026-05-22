import { normalizeDiscoverMonetization } from "@/lib/discover-catalog-url";
import {
	TV_COMPLETED_DISCOVER_STATUS,
	TV_ONGOING_DISCOVER_STATUS,
} from "@/lib/home-catalog-run";

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
	/** `ended` / `completed` for finished series. */
	status?: string | null;
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
	const st = parts.status?.trim().toLowerCase();
	if (st) {
		params.set("status", st);
	}
	const q = params.toString();
	return q ? `/tv/discover?${q}` : "/tv/discover";
}

/** Normalises `?status=` for `/tv/discover` — same whitelist as `GET /api/tv/discover`. */
export function parseTvDiscoverStatusParam(
	raw: string | undefined | null,
): string | null {
	const s = raw?.trim().toLowerCase() ?? "";
	if (
		s === TV_ONGOING_DISCOVER_STATUS ||
		s === "ongoing" ||
		s === "returning" ||
		s === "on-air" ||
		s === "on_the_air"
	) {
		return TV_ONGOING_DISCOVER_STATUS;
	}
	if (
		s === TV_COMPLETED_DISCOVER_STATUS ||
		s === "ended" ||
		s === "completed" ||
		s === "complete"
	) {
		return TV_COMPLETED_DISCOVER_STATUS;
	}
	return null;
}
