import {
	db,
	personFavorite,
	personFavoriteCreditSeen,
	profile,
} from "@still/db";
import { and, eq } from "drizzle-orm";

import {
	deliverNotification,
	isNotificationEnabled,
	type NotificationPrefs,
	readNotificationPrefs,
} from "./notification-delivery";
import {
	formatPersonFavoriteReleaseNotification,
	personFavoriteListingHref,
} from "./person-favorite-notification-copy";
import { isPersonFavoriteReleaseInNotifyWindow } from "./person-favorite-release-window";
import {
	type PersonCreditRoleInput,
	personFavoriteRoleKey,
	personFavoriteRoleLabel,
} from "./person-favorite-role";
import { recordProductEvent } from "./record-product-event";
import { type TmdbPersonDetail, tmdbApi } from "./tmdb";

/** Credit row with title + date for the release scan (richer than baseline fingerprints). */
export type PersonFavoriteCreditScanRow = {
	mediaKind: "movie" | "tv";
	tmdbId: number;
	role: PersonCreditRoleInput;
	title: string;
	/** TMDb `YYYY-MM-DD` theatrical / first-air date; null when unknown. */
	releaseDate: string | null;
};

export type PersonFavoriteReleasePlanItem = {
	mediaKind: "movie" | "tv";
	tmdbId: number;
	roleKey: string;
	roleLabel: string;
	title: string;
	releaseDate: string | null;
};

export type PersonFavoriteReleasePlan = {
	notify: PersonFavoriteReleasePlanItem[];
	markSeenSilent: PersonFavoriteReleasePlanItem[];
};

/** Stable seen-store key: `mediaKind:tmdbId:roleKey`. */
export function personFavoriteReleaseSeenKey(item: {
	mediaKind: "movie" | "tv";
	tmdbId: number;
	roleKey: string;
}): string {
	return `${item.mediaKind}:${item.tmdbId}:${item.roleKey}`;
}

/**
 * Pure release diff — unseen credits in the ±30/7 window become notify;
 * outside window or unknown date mark seen silently (never notify later).
 */
export function planPersonFavoriteReleaseDiff(args: {
	credits: readonly PersonFavoriteCreditScanRow[];
	seenKeys: ReadonlySet<string>;
	now?: Date;
}): PersonFavoriteReleasePlan {
	const now = args.now ?? new Date();
	const notify: PersonFavoriteReleasePlanItem[] = [];
	const markSeenSilent: PersonFavoriteReleasePlanItem[] = [];
	const planned = new Set<string>();

	for (const credit of args.credits) {
		if (!Number.isFinite(credit.tmdbId) || credit.tmdbId < 1) continue;
		const tmdbId = Math.floor(credit.tmdbId);
		const roleKey = personFavoriteRoleKey(credit.role);
		const dedupeKey = personFavoriteReleaseSeenKey({
			mediaKind: credit.mediaKind,
			tmdbId,
			roleKey,
		});
		if (args.seenKeys.has(dedupeKey) || planned.has(dedupeKey)) continue;
		planned.add(dedupeKey);

		const item: PersonFavoriteReleasePlanItem = {
			mediaKind: credit.mediaKind,
			tmdbId,
			roleKey,
			roleLabel: personFavoriteRoleLabel(credit.role),
			title: credit.title.trim() || "Untitled",
			releaseDate: credit.releaseDate,
		};

		if (isPersonFavoriteReleaseInNotifyWindow(credit.releaseDate, now)) {
			notify.push(item);
		} else {
			// Spec lock: far-future / past / unknown → mark seen without notify.
			markSeenSilent.push(item);
		}
	}

	return { notify, markSeenSilent };
}

/**
 * Pref gate for the job layer.
 * Pref-off in-window credits still mark seen (no inbox insert) so enabling the
 * toggle later does not storm the inbox with a backlog — matches watchlist caution.
 */
export function resolvePersonFavoriteReleaseActions(args: {
	plan: PersonFavoriteReleasePlan;
	prefsAllowNotify: boolean;
}): {
	notify: PersonFavoriteReleasePlanItem[];
	markSeen: PersonFavoriteReleasePlanItem[];
} {
	const allSeen = [...args.plan.notify, ...args.plan.markSeenSilent];
	if (!args.prefsAllowNotify) {
		return { notify: [], markSeen: allSeen };
	}
	return { notify: args.plan.notify, markSeen: allSeen };
}

/** Flatten TMDb combined credits with titles + release/air dates for the scan. */
export function collectPersonCreditsForReleaseScan(
	person: Pick<TmdbPersonDetail, "movie_credits" | "tv_credits">,
): PersonFavoriteCreditScanRow[] {
	const out: PersonFavoriteCreditScanRow[] = [];

	for (const c of person.movie_credits?.cast ?? []) {
		if (!c?.id) continue;
		out.push({
			mediaKind: "movie",
			tmdbId: c.id,
			role: { kind: "cast", character: c.character },
			title: c.title?.trim() || "Untitled",
			releaseDate: c.release_date?.trim() || null,
		});
	}
	for (const c of person.movie_credits?.crew ?? []) {
		if (!c?.id) continue;
		out.push({
			mediaKind: "movie",
			tmdbId: c.id,
			role: { kind: "crew", job: c.job },
			title: c.title?.trim() || "Untitled",
			releaseDate: c.release_date?.trim() || null,
		});
	}
	for (const c of person.tv_credits?.cast ?? []) {
		if (!c?.id) continue;
		out.push({
			mediaKind: "tv",
			tmdbId: c.id,
			role: { kind: "cast", character: c.character },
			title: c.name?.trim() || "Untitled",
			releaseDate: c.first_air_date?.trim() || null,
		});
	}
	for (const c of person.tv_credits?.crew ?? []) {
		if (!c?.id) continue;
		out.push({
			mediaKind: "tv",
			tmdbId: c.id,
			role: { kind: "crew", job: c.job },
			title: c.name?.trim() || "Untitled",
			releaseDate: c.first_air_date?.trim() || null,
		});
	}

	return out;
}

export function isPersonFavoriteReleaseAlertsJobEnabled(): boolean {
	return process.env.PERSON_FAVORITE_RELEASE_ALERTS_ENABLED !== "false";
}

async function loadSeenKeys(
	userId: string,
	tmdbPersonId: number,
): Promise<Set<string>> {
	const rows = await db
		.select({
			mediaKind: personFavoriteCreditSeen.mediaKind,
			tmdbId: personFavoriteCreditSeen.tmdbId,
			roleKey: personFavoriteCreditSeen.roleKey,
		})
		.from(personFavoriteCreditSeen)
		.where(
			and(
				eq(personFavoriteCreditSeen.userId, userId),
				eq(personFavoriteCreditSeen.tmdbPersonId, tmdbPersonId),
			),
		);

	const keys = new Set<string>();
	for (const row of rows) {
		if (row.mediaKind !== "movie" && row.mediaKind !== "tv") continue;
		keys.add(
			personFavoriteReleaseSeenKey({
				mediaKind: row.mediaKind,
				tmdbId: row.tmdbId,
				roleKey: row.roleKey,
			}),
		);
	}
	return keys;
}

async function markCreditsSeen(args: {
	userId: string;
	tmdbPersonId: number;
	items: readonly PersonFavoriteReleasePlanItem[];
}): Promise<void> {
	if (args.items.length === 0) return;
	await db
		.insert(personFavoriteCreditSeen)
		.values(
			args.items.map((item) => ({
				userId: args.userId,
				tmdbPersonId: args.tmdbPersonId,
				mediaKind: item.mediaKind,
				tmdbId: item.tmdbId,
				roleKey: item.roleKey,
			})),
		)
		.onConflictDoNothing();
}

/** Process one favorited person for one patron — exported for tests/dry-run. */
export async function processPersonFavoriteReleaseRow(args: {
	userId: string;
	tmdbPersonId: number;
	personName: string;
	credits: readonly PersonFavoriteCreditScanRow[];
	prefs: NotificationPrefs;
	now?: Date;
}): Promise<{ notified: number; markedSeen: number }> {
	const seenKeys = await loadSeenKeys(args.userId, args.tmdbPersonId);
	const plan = planPersonFavoriteReleaseDiff({
		credits: args.credits,
		seenKeys,
		now: args.now,
	});
	const prefsAllowNotify = isNotificationEnabled(
		args.prefs,
		"person_favorite_release",
		args.userId,
	);
	const actions = resolvePersonFavoriteReleaseActions({
		plan,
		prefsAllowNotify,
	});

	let notified = 0;
	for (const item of actions.notify) {
		const copy = formatPersonFavoriteReleaseNotification({
			personName: args.personName,
			roleLabel: item.roleLabel,
			title: item.title,
			releaseDate: item.releaseDate,
		});
		const href = personFavoriteListingHref({
			mediaKind: item.mediaKind,
			tmdbId: item.tmdbId,
		});
		await deliverNotification({
			userId: args.userId,
			kind: "person_favorite_release",
			title: copy.title,
			body: copy.body,
			prefs: args.prefs,
			payload: {
				mediaKind: item.mediaKind,
				tmdbId: item.tmdbId,
				tmdbPersonId: args.tmdbPersonId,
				personName: args.personName,
				roleKey: item.roleKey,
				roleLabel: item.roleLabel,
				title: item.title,
				releaseDate: item.releaseDate,
				href,
			},
		});
		void recordProductEvent(args.userId, "person_favorite_alert.sent", {
			kind: "person_favorite_release",
			mediaKind: item.mediaKind,
			tmdbId: item.tmdbId,
			tmdbPersonId: args.tmdbPersonId,
			roleKey: item.roleKey,
		});
		notified += 1;
	}

	await markCreditsSeen({
		userId: args.userId,
		tmdbPersonId: args.tmdbPersonId,
		items: actions.markSeen,
	});

	return { notified, markedSeen: actions.markSeen.length };
}

/**
 * Daily job — scan TMDb credits for favorited people with Notify on and insert
 * `person_favorite_release` inbox rows for new credits inside the release window.
 */
export async function syncPersonFavoriteReleaseAlerts(): Promise<void> {
	if (!isPersonFavoriteReleaseAlertsJobEnabled()) return;

	const favorites = await db
		.select({
			userId: personFavorite.userId,
			tmdbPersonId: personFavorite.tmdbPersonId,
			name: personFavorite.name,
			preferences: profile.preferences,
		})
		.from(personFavorite)
		.innerJoin(profile, eq(personFavorite.userId, profile.userId))
		.where(eq(personFavorite.alertsEnabled, true));

	// One TMDb person fetch per distinct id for this run (rate-limit).
	const creditsByPerson = new Map<number, PersonFavoriteCreditScanRow[]>();
	const prefsByUser = new Map<string, NotificationPrefs>();

	for (const row of favorites) {
		try {
			let credits = creditsByPerson.get(row.tmdbPersonId);
			if (!credits) {
				const person = await tmdbApi.person(row.tmdbPersonId);
				credits = person ? collectPersonCreditsForReleaseScan(person) : [];
				creditsByPerson.set(row.tmdbPersonId, credits);
			}

			let prefs = prefsByUser.get(row.userId);
			if (!prefs) {
				prefs = readNotificationPrefs(
					(row.preferences as Record<string, unknown> | null | undefined) ??
						null,
				);
				prefsByUser.set(row.userId, prefs);
			}

			await processPersonFavoriteReleaseRow({
				userId: row.userId,
				tmdbPersonId: row.tmdbPersonId,
				personName: row.name.trim() || "Someone",
				credits,
				prefs,
			});
		} catch (err) {
			console.error(
				`[person-favorite-release] user=${row.userId} person=${row.tmdbPersonId}`,
				err,
			);
		}
	}
}
