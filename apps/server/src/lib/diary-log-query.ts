/**
 * Pure query-arg helpers for `GET /api/logs/me/diary`. Kept separate from the
 * route so parsing/clamp/offset math is unit-testable without a DB. Mirrors
 * `profile-filmography-query.ts`.
 */
export type DiaryMedia = "movie" | "tv";
export type DiaryOrder = "latest" | "earliest" | "title";
export type DiaryVenue = "theaters" | "streaming";

/** Matches the dense lobby grid — fast first paint, more scroll fetches. */
export const DIARY_DEFAULT_LIMIT = 36;
export const DIARY_MAX_LIMIT = 72;

export function parseDiaryMedia(raw: string | undefined): DiaryMedia {
	return raw === "tv" ? "tv" : "movie";
}

export function parseDiaryOrder(raw: string | undefined): DiaryOrder {
	if (raw === "earliest" || raw === "title" || raw === "latest") return raw;
	return "latest";
}

/** `null` means "all venues" (no filter). */
export function parseDiaryVenue(raw: string | undefined): DiaryVenue | null {
	if (raw === "theaters" || raw === "streaming") return raw;
	return null;
}

export function parseDiaryPage(raw: string | undefined): number {
	const n = Number(raw);
	if (!Number.isFinite(n) || n < 1) return 1;
	return Math.floor(n);
}

export function parseDiaryLimit(raw: string | undefined): number {
	const n = Number(raw);
	if (!Number.isFinite(n) || n < 1) return DIARY_DEFAULT_LIMIT;
	return Math.min(Math.floor(n), DIARY_MAX_LIMIT);
}

export function diaryOffset(page: number, limit: number): number {
	return Math.max(0, (page - 1) * limit);
}

export function diaryTotalPages(total: number, limit: number): number {
	if (total <= 0 || limit <= 0) return 0;
	return Math.ceil(total / limit);
}
