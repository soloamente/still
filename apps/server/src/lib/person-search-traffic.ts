import { db, personSearchTraffic } from "@still/db";
import { desc, inArray, sql } from "drizzle-orm";

import type { PeopleSearchRow } from "./people-search-row";

export type PersonSearchTrafficSnapshot = {
	tmdbId: number;
	name: string;
	profileUrl: string | null;
};

/** Bump Sense search hits for a TMDb person. Failures must not block navigation. */
export async function incrementPersonSearchTraffic(
	snapshot: PersonSearchTrafficSnapshot,
): Promise<void> {
	if (!Number.isFinite(snapshot.tmdbId) || snapshot.tmdbId < 1) return;
	const tmdbId = Math.floor(snapshot.tmdbId);
	const name = snapshot.name.trim();
	try {
		await db
			.insert(personSearchTraffic)
			.values({
				tmdbId,
				hitCount: 1,
				name,
				profileUrl: snapshot.profileUrl,
				updatedAt: new Date(),
			})
			.onConflictDoUpdate({
				target: personSearchTraffic.tmdbId,
				set: {
					hitCount: sql`${personSearchTraffic.hitCount} + 1`,
					name: sql`CASE WHEN excluded.name <> '' THEN excluded.name ELSE ${personSearchTraffic.name} END`,
					profileUrl: sql`COALESCE(excluded.profile_url, ${personSearchTraffic.profileUrl})`,
					updatedAt: new Date(),
				},
			});
	} catch (err) {
		console.error("[person-search-traffic] increment failed", {
			tmdbId,
			err,
		});
	}
}

/** Hit counts for the given TMDb ids — empty map when none have been searched. */
export async function getPersonSearchTrafficCounts(
	ids: readonly number[],
): Promise<Map<number, number>> {
	const unique = [
		...new Set(ids.filter((id) => Number.isFinite(id) && id > 0)),
	];
	if (unique.length === 0) return new Map();
	try {
		const rows = await db
			.select({
				tmdbId: personSearchTraffic.tmdbId,
				hitCount: personSearchTraffic.hitCount,
			})
			.from(personSearchTraffic)
			.where(inArray(personSearchTraffic.tmdbId, unique));
		return new Map(rows.map((row) => [row.tmdbId, row.hitCount]));
	} catch (err) {
		console.error("[person-search-traffic] counts failed", err);
		return new Map();
	}
}

function trafficRowToSearchRow(row: {
	tmdbId: number;
	name: string;
	profileUrl: string | null;
}): PeopleSearchRow {
	return {
		id: row.tmdbId,
		name: row.name,
		profileUrl: row.profileUrl,
		knownForDepartment: null,
		knownForTitles: [],
	};
}

/** Highest-traffic people on Sense, already mapped to search rows. */
export async function listTopPersonSearchTraffic(
	limit: number,
): Promise<PeopleSearchRow[]> {
	if (limit < 1) return [];
	try {
		const rows = await db
			.select({
				tmdbId: personSearchTraffic.tmdbId,
				name: personSearchTraffic.name,
				profileUrl: personSearchTraffic.profileUrl,
			})
			.from(personSearchTraffic)
			.orderBy(
				desc(personSearchTraffic.hitCount),
				desc(personSearchTraffic.updatedAt),
			)
			.limit(limit);
		return rows
			.filter((row) => row.name.trim().length > 0)
			.map(trafficRowToSearchRow);
	} catch (err) {
		console.error("[person-search-traffic] list top failed", err);
		return [];
	}
}
