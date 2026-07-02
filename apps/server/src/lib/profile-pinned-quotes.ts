import { db, listingQuoteSave } from "@still/db";
import { and, eq, inArray } from "drizzle-orm";

/** Patron-chosen quote saves on profile hero (pinned from `/quotes`). */
export const MAX_PINNED_QUOTES = 3;

/** Normalize + dedupe incoming pin ids while preserving order. */
export function normalizePinnedQuoteSaveIds(raw: unknown): string[] {
	if (!Array.isArray(raw)) return [];
	const seen = new Set<string>();
	const ids: string[] = [];
	for (const entry of raw) {
		if (typeof entry !== "string") continue;
		const id = entry.trim();
		if (!id || seen.has(id)) continue;
		seen.add(id);
		ids.push(id);
		if (ids.length >= MAX_PINNED_QUOTES) break;
	}
	return ids;
}

/**
 * Validate pins belong to the patron's saved-quote collection.
 * Private saves may be pinned — visitors only see public pins when hydrated.
 */
export async function validatePinnedQuoteSaveIdsForUser(
	userId: string,
	rawIds: unknown,
): Promise<
	| { ok: true; quoteSaveIds: string[] }
	| { ok: false; status: 400; error: string }
> {
	const quoteSaveIds = normalizePinnedQuoteSaveIds(rawIds);
	if (quoteSaveIds.length === 0) return { ok: true, quoteSaveIds: [] };

	const rows = await db
		.select({ id: listingQuoteSave.id })
		.from(listingQuoteSave)
		.where(
			and(
				eq(listingQuoteSave.userId, userId),
				inArray(listingQuoteSave.id, quoteSaveIds),
			),
		);

	if (rows.length !== quoteSaveIds.length) {
		return {
			ok: false,
			status: 400,
			error: "Pins must be your own saved quotes",
		};
	}

	return { ok: true, quoteSaveIds };
}

/** Drop a deleted save id from the patron's pinned list. */
export function removePinnedQuoteSaveId(
	rawIds: unknown,
	saveId: string,
): string[] {
	return normalizePinnedQuoteSaveIds(rawIds).filter((id) => id !== saveId);
}
