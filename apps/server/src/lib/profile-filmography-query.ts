/**
 * Pure query-arg helpers for `GET /api/profiles/:handle/filmography`. Kept separate
 * from the route so parsing/clamp/offset math is unit-testable without a DB.
 */
export type FilmographyMedia = "movie" | "tv";
export type FilmographyOrder = "latest" | "earliest" | "title";
export type FilmographyVenue = "theaters" | "streaming";

export const FILMOGRAPHY_DEFAULT_LIMIT = 48;
export const FILMOGRAPHY_MAX_LIMIT = 96;

export function parseFilmographyMedia(
	raw: string | undefined,
): FilmographyMedia {
	return raw === "tv" ? "tv" : "movie";
}

export function parseFilmographyOrder(
	raw: string | undefined,
): FilmographyOrder {
	if (raw === "earliest" || raw === "title" || raw === "latest") return raw;
	return "latest";
}

/** `null` means "all venues" (no filter). */
export function parseFilmographyVenue(
	raw: string | undefined,
): FilmographyVenue | null {
	if (raw === "theaters" || raw === "streaming") return raw;
	return null;
}

export function parseFilmographyFavorites(raw: string | undefined): boolean {
	if (!raw) return false;
	const v = raw.trim().toLowerCase();
	return v === "1" || v === "true" || v === "yes";
}

export function parseFilmographyPage(raw: string | undefined): number {
	const n = Number(raw);
	if (!Number.isFinite(n) || n < 1) return 1;
	return Math.floor(n);
}

export function parseFilmographyLimit(raw: string | undefined): number {
	const n = Number(raw);
	if (!Number.isFinite(n) || n < 1) return FILMOGRAPHY_DEFAULT_LIMIT;
	return Math.min(Math.floor(n), FILMOGRAPHY_MAX_LIMIT);
}

export function filmographyOffset(page: number, limit: number): number {
	return Math.max(0, (page - 1) * limit);
}

export function filmographyTotalPages(total: number, limit: number): number {
	if (total <= 0 || limit <= 0) return 0;
	return Math.ceil(total / limit);
}
