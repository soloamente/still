import {
	db,
	personFavorite,
	personFavoriteCreditSeen,
} from "@still/db";
import { and, eq, inArray } from "drizzle-orm";

import {
	personFavoriteRoleKey,
	type PersonCreditRoleInput,
} from "./person-favorite-role";
import type { TmdbPersonDetail } from "./tmdb";
import { tmdbApi, tmdbImg } from "./tmdb";

/** One credit to baseline into `person_favorite_credit_seen` (no notify). */
export type PersonFavoriteCreditInput = {
	mediaKind: "movie" | "tv";
	tmdbId: number;
	role: PersonCreditRoleInput;
};

/** Row shape ready for insert into the seen store. */
export type PersonFavoriteSeenRow = {
	mediaKind: "movie" | "tv";
	tmdbId: number;
	roleKey: string;
};

/**
 * Pure baseline mapper — fingerprints current credits so first Favorite
 * never fires release/streaming alerts for titles already on the filmography.
 */
export function buildPersonFavoriteCreditBaseline(
	credits: readonly PersonFavoriteCreditInput[],
): PersonFavoriteSeenRow[] {
	const seen = new Set<string>();
	const out: PersonFavoriteSeenRow[] = [];
	for (const credit of credits) {
		if (!Number.isFinite(credit.tmdbId) || credit.tmdbId < 1) continue;
		const tmdbId = Math.floor(credit.tmdbId);
		const roleKey = personFavoriteRoleKey(credit.role);
		const dedupeKey = `${credit.mediaKind}:${tmdbId}:${roleKey}`;
		if (seen.has(dedupeKey)) continue;
		seen.add(dedupeKey);
		out.push({ mediaKind: credit.mediaKind, tmdbId, roleKey });
	}
	return out;
}

/** Flatten TMDb person movie/tv cast+crew into baseline credit inputs. */
export function collectPersonCreditsFromTmdb(
	person: Pick<TmdbPersonDetail, "movie_credits" | "tv_credits">,
): PersonFavoriteCreditInput[] {
	const out: PersonFavoriteCreditInput[] = [];
	for (const c of person.movie_credits?.cast ?? []) {
		if (!c?.id) continue;
		out.push({
			mediaKind: "movie",
			tmdbId: c.id,
			role: { kind: "cast", character: c.character },
		});
	}
	for (const c of person.movie_credits?.crew ?? []) {
		if (!c?.id) continue;
		out.push({
			mediaKind: "movie",
			tmdbId: c.id,
			role: { kind: "crew", job: c.job },
		});
	}
	for (const c of person.tv_credits?.cast ?? []) {
		if (!c?.id) continue;
		out.push({
			mediaKind: "tv",
			tmdbId: c.id,
			role: { kind: "cast", character: c.character },
		});
	}
	for (const c of person.tv_credits?.crew ?? []) {
		if (!c?.id) continue;
		out.push({
			mediaKind: "tv",
			tmdbId: c.id,
			role: { kind: "crew", job: c.job },
		});
	}
	return out;
}

export async function isPersonFavorited(
	userId: string,
	tmdbPersonId: number,
): Promise<boolean> {
	const state = await getPersonFavoriteState(userId, tmdbPersonId);
	return state.favorited;
}

export type PersonFavoriteState = {
	favorited: boolean;
	alertsEnabled: boolean;
};

export async function getPersonFavoriteState(
	userId: string,
	tmdbPersonId: number,
): Promise<PersonFavoriteState> {
	const [row] = await db
		.select({
			tmdbPersonId: personFavorite.tmdbPersonId,
			alertsEnabled: personFavorite.alertsEnabled,
		})
		.from(personFavorite)
		.where(
			and(
				eq(personFavorite.userId, userId),
				eq(personFavorite.tmdbPersonId, tmdbPersonId),
			),
		)
		.limit(1);
	if (!row) return { favorited: false, alertsEnabled: false };
	return { favorited: true, alertsEnabled: row.alertsEnabled };
}

export type AddPersonFavoriteResult = {
	favorited: true;
	alertsEnabled: boolean;
	tmdbPersonId: number;
	name: string;
};

/**
 * Upsert favorite snapshot from TMDb and baseline current credits into seen
 * (onConflictDoNothing — never notifies).
 */
export async function addPersonFavorite(args: {
	userId: string;
	tmdbPersonId: number;
	/** When turning Notify on for a new favorite — defaults true. */
	alertsEnabled?: boolean;
}): Promise<AddPersonFavoriteResult | null> {
	const person = await tmdbApi.person(args.tmdbPersonId);
	if (!person?.id) return null;

	const name = person.name?.trim() || "Unknown";
	const profileUrl = tmdbImg.profile(person.profile_path, "h632");
	const knownForDepartment = person.known_for_department?.trim() || null;
	const alertsEnabled = args.alertsEnabled ?? true;
	const snapshot = {
		name,
		profileUrl,
		knownForDepartment,
		alertsEnabled,
	};

	// Composite unique — prefer select → update | insert over onConflictDoUpdate.
	const [existing] = await db
		.select({
			tmdbPersonId: personFavorite.tmdbPersonId,
			alertsEnabled: personFavorite.alertsEnabled,
		})
		.from(personFavorite)
		.where(
			and(
				eq(personFavorite.userId, args.userId),
				eq(personFavorite.tmdbPersonId, person.id),
			),
		)
		.limit(1);

	if (existing) {
		await db
			.update(personFavorite)
			.set({
				name: snapshot.name,
				profileUrl: snapshot.profileUrl,
				knownForDepartment: snapshot.knownForDepartment,
				// Only bump alerts when caller explicitly passed the flag.
				...(args.alertsEnabled !== undefined
					? { alertsEnabled: args.alertsEnabled }
					: {}),
			})
			.where(
				and(
					eq(personFavorite.userId, args.userId),
					eq(personFavorite.tmdbPersonId, person.id),
				),
			);
	} else {
		await db.insert(personFavorite).values({
			userId: args.userId,
			tmdbPersonId: person.id,
			...snapshot,
		});
	}

	const baseline = buildPersonFavoriteCreditBaseline(
		collectPersonCreditsFromTmdb(person),
	);
	if (baseline.length > 0) {
		await db
			.insert(personFavoriteCreditSeen)
			.values(
				baseline.map((row) => ({
					userId: args.userId,
					tmdbPersonId: person.id,
					mediaKind: row.mediaKind,
					tmdbId: row.tmdbId,
					roleKey: row.roleKey,
				})),
			)
			.onConflictDoNothing();
	}

	const state = await getPersonFavoriteState(args.userId, person.id);
	return {
		favorited: true,
		alertsEnabled: state.alertsEnabled,
		tmdbPersonId: person.id,
		name,
	};
}

/**
 * Toggle per-person Notify. Enabling favorites the person when needed;
 * disabling keeps the Favorite but turns alerts off.
 */
export async function setPersonFavoriteAlerts(args: {
	userId: string;
	tmdbPersonId: number;
	alertsEnabled: boolean;
}): Promise<PersonFavoriteState | null> {
	if (args.alertsEnabled) {
		const added = await addPersonFavorite({
			userId: args.userId,
			tmdbPersonId: args.tmdbPersonId,
			alertsEnabled: true,
		});
		if (!added) return null;
		return { favorited: true, alertsEnabled: true };
	}

	const [existing] = await db
		.select({ tmdbPersonId: personFavorite.tmdbPersonId })
		.from(personFavorite)
		.where(
			and(
				eq(personFavorite.userId, args.userId),
				eq(personFavorite.tmdbPersonId, args.tmdbPersonId),
			),
		)
		.limit(1);

	if (!existing) {
		return { favorited: false, alertsEnabled: false };
	}

	await db
		.update(personFavorite)
		.set({ alertsEnabled: false })
		.where(
			and(
				eq(personFavorite.userId, args.userId),
				eq(personFavorite.tmdbPersonId, args.tmdbPersonId),
			),
		);
	return { favorited: true, alertsEnabled: false };
}

/** Remove favorite and all credit-seen rows for that person. */
export async function removePersonFavorite(args: {
	userId: string;
	tmdbPersonId: number;
}): Promise<{ removed: boolean }> {
	await db
		.delete(personFavoriteCreditSeen)
		.where(
			and(
				eq(personFavoriteCreditSeen.userId, args.userId),
				eq(personFavoriteCreditSeen.tmdbPersonId, args.tmdbPersonId),
			),
		);
	const deleted = await db
		.delete(personFavorite)
		.where(
			and(
				eq(personFavorite.userId, args.userId),
				eq(personFavorite.tmdbPersonId, args.tmdbPersonId),
			),
		)
		.returning({ tmdbPersonId: personFavorite.tmdbPersonId });
	return { removed: deleted.length > 0 };
}

/** Viewer favorite ids among a candidate set (search / popular annotate). */
export async function listFavoritedPersonIdsAmong(
	userId: string,
	tmdbPersonIds: readonly number[],
): Promise<Set<number>> {
	const ids = [
		...new Set(
			tmdbPersonIds.filter((id) => Number.isFinite(id) && id >= 1).map(Math.floor),
		),
	];
	if (ids.length === 0) return new Set();
	const rows = await db
		.select({ tmdbPersonId: personFavorite.tmdbPersonId })
		.from(personFavorite)
		.where(
			and(
				eq(personFavorite.userId, userId),
				inArray(personFavorite.tmdbPersonId, ids),
			),
		);
	return new Set(rows.map((row) => row.tmdbPersonId));
}
