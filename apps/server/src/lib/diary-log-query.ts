/**
 * Pure query-arg helpers for `GET /api/logs/me/diary`. Kept separate from the
 * route so parsing/clamp/offset math is unit-testable without a DB. Mirrors
 * `profile-filmography-query.ts`.
 */

import type { log } from "@still/db";
import { and, gte, lt, type SQL } from "drizzle-orm";

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

/** Calendar year from `?year=` — filters `watchedAt`. */
export function parseDiaryWatchYear(raw: string | undefined): number | null {
	if (!raw?.trim()) return null;
	const n = Number(raw);
	if (!Number.isInteger(n) || n < 1900 || n > 2100) return null;
	return n;
}

/** Decade start from `?decade=` (e.g. `2010` → 2010s). Mutually exclusive with `year`. */
export function parseDiaryWatchDecade(raw: string | undefined): number | null {
	if (!raw?.trim()) return null;
	const n = Number(raw);
	if (!Number.isInteger(n) || n % 10 !== 0 || n < 1900 || n > 2100) return null;
	return n;
}

/** UTC half-open interval `[start, end)` for a watch-year or watch-decade filter. */
export function resolveDiaryWatchPeriodBounds(
	year: number | null,
	decade: number | null,
): { start: Date; end: Date } | null {
	if (year != null) {
		return {
			start: new Date(Date.UTC(year, 0, 1)),
			end: new Date(Date.UTC(year + 1, 0, 1)),
		};
	}
	if (decade != null) {
		return {
			start: new Date(Date.UTC(decade, 0, 1)),
			end: new Date(Date.UTC(decade + 10, 0, 1)),
		};
	}
	return null;
}

/** Drizzle predicate on `log.watchedAt` for diary period chips. */
export function diaryWatchedAtInPeriodCondition(
	watchedAtColumn: typeof log.watchedAt,
	year: number | null,
	decade: number | null,
): SQL | undefined {
	const bounds = resolveDiaryWatchPeriodBounds(year, decade);
	if (!bounds) return undefined;
	return and(
		gte(watchedAtColumn, bounds.start),
		lt(watchedAtColumn, bounds.end),
	);
}

export type DiaryWatchPeriods = {
	years: number[];
	decades: number[];
};

/** Unique decade starts (2020, 2010, …) from distinct watch years, newest first. */
export function diaryDecadesFromYears(years: readonly number[]): number[] {
	const decades = new Set<number>();
	for (const year of years) {
		if (!Number.isInteger(year)) continue;
		decades.add(Math.floor(year / 10) * 10);
	}
	return [...decades].sort((a, b) => b - a);
}
