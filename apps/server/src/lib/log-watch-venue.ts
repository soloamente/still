/**
 * Watch venue rules for diary logs. `null` = unset (Today instant log, legacy rows);
 * unset rows surface in both `/diary` / profile venue slices.
 */

import type { LogWatchVenue } from "@still/db/schema/activity";
import { eq, or, type SQL, type SQLWrapper, sql } from "drizzle-orm";

/** `POST /api/logs`: omitted keeps the Quick Log default; explicit `null` stays unset. */
export function resolveCreateWatchVenue(
	bodyVenue: LogWatchVenue | null | undefined,
): LogWatchVenue | null {
	if (bodyVenue === undefined) return "streaming";
	return bodyVenue;
}

/** `PATCH /api/logs/:id`: omitted keeps the stored value; explicit `null` clears it. */
export function resolvePatchWatchVenue(
	bodyVenue: LogWatchVenue | null | undefined,
	existing: LogWatchVenue | null,
): LogWatchVenue | null {
	if (bodyVenue === undefined) return existing;
	return bodyVenue;
}

/**
 * Venue slice predicate: rows at `venue` plus unset/legacy rows. Coalesce first —
 * `NULL NOT IN (...)` is never true, so bare `not in` would drop unset rows.
 */
export function diaryVenueSliceWhere(
	column: SQLWrapper,
	venue: LogWatchVenue,
): SQL {
	return or(
		eq(column, venue),
		sql`coalesce(${column}, '') not in ('theaters','streaming')`,
	) as SQL;
}
