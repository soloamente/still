import { block, db, log, movie, profile, tv, user } from "@still/db";
import {
	and,
	asc,
	count,
	desc,
	eq,
	gt,
	gte,
	inArray,
	isNotNull,
	isNull,
	lt,
	notInArray,
	or,
	sql,
} from "drizzle-orm";

import { contentVisibilityWhere } from "./content-visibility";
import {
	type DiaryMetalTier,
	fetchDiaryLogCountsForUserIds,
	resolveDiaryMetalTier,
} from "./diary-metal-tier";
import { clampHiddenCount } from "./leaderboard-hidden-count";
import type { LeaderboardPeriod } from "./leaderboard-period";
import { resolveLeaderboardWindow } from "./leaderboard-period";
import {
	loadPatronEntitlements,
	loadPatronEntitlementsForUserIds,
} from "./patron-entitlements";
import { patronHasPlanFeature } from "./plan-feature-access";
import { readAvatarIsAnimatedPref } from "./profile-media";

export type LeaderboardKind = "films" | "tv";

export type LeaderboardEntry = {
	rank: number;
	userId: string;
	handle: string;
	displayName: string;
	/** Auth `user.image` — UI routes through `/api/profiles/avatar/:handle`. */
	image: string | null;
	avatarIsAnimated: boolean;
	diaryMetalTier: DiaryMetalTier | null;
	count: number;
};

export type LeaderboardResult = {
	kind: LeaderboardKind;
	period: LeaderboardPeriod;
	window: { start: string; end: string };
	entries: LeaderboardEntry[];
	viewer: { rank: number; count: number } | null;
};

export type LeaderboardLogItem = {
	logId: string;
	watchedAt: string;
	movieId: number | null;
	tvId: number | null;
	title: string;
	posterPath: string | null;
	rating: number | null;
	rewatch: boolean;
	/** 1-based index for this title within the period (chronological by `watchedAt`). */
	watchIndexInPeriod: number;
	/** How many logs this patron filed for the same title in the period. */
	watchCountInPeriod: number;
	/** 1-based lifetime watch index for this title (all diary logs, chronological). */
	watchIndexLifetime: number;
	/** Total diary logs this patron has for this title (all time). */
	watchCountLifetime: number;
};

type LeaderboardLogItemRow = {
	logId: string;
	watchedAt: string;
	movieId: number | null;
	tvId: number | null;
	title: string;
	posterPath: string | null;
	rating: number | null;
	rewatch: boolean;
};

/** Groups period logs by title so the drawer can show rewatch ordinals and repeat counts. */
export function annotateLeaderboardLogItems(
	raw: LeaderboardLogItemRow[],
): LeaderboardLogItem[] {
	const groups = new Map<string, LeaderboardLogItemRow[]>();

	for (const item of raw) {
		const key =
			item.movieId != null
				? `movie:${item.movieId}`
				: item.tvId != null
					? `tv:${item.tvId}`
					: item.logId;
		const bucket = groups.get(key);
		if (bucket) bucket.push(item);
		else groups.set(key, [item]);
	}

	const annotated: LeaderboardLogItem[] = [];

	for (const bucket of groups.values()) {
		const sorted = bucket.slice().sort((a, b) => {
			const at = new Date(a.watchedAt).getTime();
			const bt = new Date(b.watchedAt).getTime();
			if (at !== bt) return at - bt;
			return a.logId.localeCompare(b.logId);
		});
		const count = sorted.length;
		sorted.forEach((item, index) => {
			annotated.push({
				...item,
				rewatch: item.rewatch,
				watchIndexInPeriod: index + 1,
				watchCountInPeriod: count,
				watchIndexLifetime: 1,
				watchCountLifetime: 1,
			});
		});
	}

	return annotated;
}

type LifetimeWatchRow = {
	logId: string;
	watchedAt: string | Date;
	movieId: number | null;
	tvId: number | null;
};

/** All-time watch ordinals per title — used for ledger poster labels (not period-only). */
export function buildLifetimeWatchIndexMap(
	rows: LifetimeWatchRow[],
): Map<string, { watchIndexLifetime: number; watchCountLifetime: number }> {
	const groups = new Map<string, LifetimeWatchRow[]>();

	for (const item of rows) {
		const key =
			item.movieId != null
				? `movie:${item.movieId}`
				: item.tvId != null
					? `tv:${item.tvId}`
					: item.logId;
		const bucket = groups.get(key);
		if (bucket) bucket.push(item);
		else groups.set(key, [item]);
	}

	const result = new Map<
		string,
		{ watchIndexLifetime: number; watchCountLifetime: number }
	>();

	for (const bucket of groups.values()) {
		const sorted = bucket.slice().sort((a, b) => {
			const at = new Date(a.watchedAt).getTime();
			const bt = new Date(b.watchedAt).getTime();
			if (at !== bt) return at - bt;
			return a.logId.localeCompare(b.logId);
		});
		const count = sorted.length;
		sorted.forEach((item, index) => {
			result.set(item.logId, {
				watchIndexLifetime: index + 1,
				watchCountLifetime: count,
			});
		});
	}

	return result;
}

export function mergeLifetimeWatchCounts(
	items: LeaderboardLogItem[],
	lifetimeByLogId: Map<
		string,
		{ watchIndexLifetime: number; watchCountLifetime: number }
	>,
): LeaderboardLogItem[] {
	return items.map((item) => {
		const lifetime = lifetimeByLogId.get(item.logId);
		return {
			...item,
			watchIndexLifetime: lifetime?.watchIndexLifetime ?? 1,
			watchCountLifetime: lifetime?.watchCountLifetime ?? 1,
		};
	});
}

async function fetchLifetimeWatchRowsForTitles(
	userId: string,
	movieIds: number[],
	tvIds: number[],
): Promise<LifetimeWatchRow[]> {
	if (movieIds.length === 0 && tvIds.length === 0) return [];

	const titleFilters = [];
	if (movieIds.length > 0) {
		titleFilters.push(
			and(inArray(log.movieId, movieIds), isNotNull(log.movieId)),
		);
	}
	if (tvIds.length > 0) {
		titleFilters.push(and(inArray(log.tvId, tvIds), isNotNull(log.tvId)));
	}

	const rows = await db
		.select({
			logId: log.id,
			watchedAt: log.watchedAt,
			movieId: log.movieId,
			tvId: log.tvId,
		})
		.from(log)
		.where(
			and(
				eq(log.userId, userId),
				isNull(log.removedAt),
				titleFilters.length === 1 ? titleFilters[0] : or(...titleFilters),
			),
		);

	return rows;
}

async function annotateLeaderboardLogsWithLifetimeCounts(
	userId: string,
	items: LeaderboardLogItem[],
): Promise<LeaderboardLogItem[]> {
	const movieIds = [
		...new Set(
			items
				.map((item) => item.movieId)
				.filter((id): id is number => id != null),
		),
	];
	const tvIds = [
		...new Set(
			items.map((item) => item.tvId).filter((id): id is number => id != null),
		),
	];

	const lifetimeRows = await fetchLifetimeWatchRowsForTitles(
		userId,
		movieIds,
		tvIds,
	);
	const lifetimeMap = buildLifetimeWatchIndexMap(lifetimeRows);
	return mergeLifetimeWatchCounts(items, lifetimeMap);
}

/** Patron ids the viewer must not see on the board. */
async function blockedUserIdsForViewer(viewerId: string): Promise<string[]> {
	const rows = await db
		.select({
			blockerId: block.blockerId,
			blockedId: block.blockedId,
		})
		.from(block)
		.where(or(eq(block.blockerId, viewerId), eq(block.blockedId, viewerId)));
	const ids = new Set<string>();
	for (const row of rows) {
		if (row.blockerId === viewerId) ids.add(row.blockedId);
		else ids.add(row.blockerId);
	}
	return [...ids];
}

function mediaFilter(kind: LeaderboardKind) {
	return kind === "films" ? isNotNull(log.movieId) : isNotNull(log.tvId);
}

function baseLogConditions(
	kind: LeaderboardKind,
	start: Date,
	end: Date,
	blockedIds: string[],
) {
	const conditions = [
		eq(profile.isPrivate, false),
		isNull(log.removedAt),
		mediaFilter(kind),
		gte(log.watchedAt, start),
		lt(log.watchedAt, end),
	];
	if (blockedIds.length > 0) {
		conditions.push(notInArray(log.userId, blockedIds));
	}
	return and(...conditions);
}

/**
 * Global leaderboard — top patrons by log count in the half-open window.
 */
export async function fetchLeaderboard(opts: {
	kind: LeaderboardKind;
	period: LeaderboardPeriod;
	tz: string | undefined;
	viewerId: string | null;
	now?: Date;
	/** When set, skips `resolveLeaderboardWindow` (month-recap, backfills). */
	window?: { start: Date; end: Date };
	/** Max rows returned — default 50 (Community ranks). */
	limit?: number;
}): Promise<LeaderboardResult> {
	const limit = opts.limit ?? 50;
	/** Over-fetch so Immersed-only filtering still fills the board. */
	const fetchLimit = Math.min(limit * 4, 200);
	const { start, end } =
		opts.window ?? resolveLeaderboardWindow(opts.period, opts.tz, opts.now);
	const blockedIds = opts.viewerId
		? await blockedUserIdsForViewer(opts.viewerId)
		: [];

	const rows = await db
		.select({
			userId: log.userId,
			handle: profile.handle,
			displayName: profile.displayName,
			image: sql<string | null>`max(${user.image})`.as("image"),
			preferences: profile.preferences,
			count: sql<number>`count(*)::int`.as("count"),
			lastWatch: sql<Date>`max(${log.watchedAt})`.as("last_watch"),
		})
		.from(log)
		.innerJoin(profile, eq(log.userId, profile.userId))
		.innerJoin(user, eq(log.userId, user.id))
		.where(baseLogConditions(opts.kind, start, end, blockedIds))
		.groupBy(
			log.userId,
			profile.handle,
			profile.displayName,
			profile.preferences,
		)
		.orderBy(
			desc(sql`count(*)`),
			asc(sql`max(${log.watchedAt})`),
			asc(profile.handle),
		)
		.limit(fetchLimit);

	const entitlementsByUser = await loadPatronEntitlementsForUserIds(
		rows.map((row) => row.userId),
	);
	const visibleRows = rows
		.filter((row) => {
			const entitlements = entitlementsByUser.get(row.userId);
			if (!entitlements) return false;
			return patronHasPlanFeature(entitlements, "leaderboard_visibility");
		})
		.slice(0, limit);

	const logCounts = await fetchDiaryLogCountsForUserIds(
		visibleRows.map((row) => row.userId),
	);

	const entries: LeaderboardEntry[] = visibleRows.map((row, index) => ({
		rank: index + 1,
		userId: row.userId,
		handle: row.handle,
		displayName: row.displayName,
		image: row.image ?? null,
		avatarIsAnimated: readAvatarIsAnimatedPref(
			row.preferences as Record<string, unknown> | null,
		),
		diaryMetalTier: resolveDiaryMetalTier(logCounts.get(row.userId) ?? 0),
		count: Number(row.count),
	}));

	let viewer: { rank: number; count: number } | null = null;
	if (opts.viewerId) {
		const viewerEntitlements = await loadPatronEntitlements(opts.viewerId);
		if (patronHasPlanFeature(viewerEntitlements, "leaderboard_visibility")) {
			const inList = entries.find((e) => e.userId === opts.viewerId);
			if (inList) {
				viewer = { rank: inList.rank, count: inList.count };
			} else {
				viewer = await fetchViewerRank({
					kind: opts.kind,
					viewerId: opts.viewerId,
					start,
					end,
					blockedIds,
				});
			}
		}
	}

	return {
		kind: opts.kind,
		period: opts.period,
		window: { start: start.toISOString(), end: end.toISOString() },
		entries,
		viewer,
	};
}

async function fetchViewerRank(opts: {
	kind: LeaderboardKind;
	viewerId: string;
	start: Date;
	end: Date;
	blockedIds: string[];
}): Promise<{ rank: number; count: number } | null> {
	const [selfRow] = await db
		.select({
			count: sql<number>`count(*)::int`.as("count"),
			lastWatch: sql<Date>`max(${log.watchedAt})`.as("last_watch"),
		})
		.from(log)
		.innerJoin(profile, eq(log.userId, profile.userId))
		.where(
			and(
				eq(log.userId, opts.viewerId),
				eq(profile.isPrivate, false),
				baseLogConditions(opts.kind, opts.start, opts.end, []),
			),
		);

	const count = Number(selfRow?.count ?? 0);
	if (count === 0) return null;

	const lastWatch = selfRow?.lastWatch ?? new Date(0);

	const ranked = db
		.select({
			userId: log.userId,
			cnt: sql<number>`count(*)::int`.as("cnt"),
			lastWatch: sql<Date>`max(${log.watchedAt})`.as("last_watch"),
		})
		.from(log)
		.innerJoin(profile, eq(log.userId, profile.userId))
		.where(baseLogConditions(opts.kind, opts.start, opts.end, opts.blockedIds))
		.groupBy(log.userId)
		.as("ranked");

	const [aheadRow] = await db
		.select({ ahead: sql<number>`count(*)::int`.as("ahead") })
		.from(ranked)
		.where(
			or(
				gt(ranked.cnt, count),
				and(eq(ranked.cnt, count), lt(ranked.lastWatch, lastWatch)),
			),
		);

	const aheadCount = Number(aheadRow?.ahead ?? 0);

	return { rank: aheadCount + 1, count };
}

/**
 * Drawer payload — all qualifying logs for one patron in the window.
 */
export async function fetchLeaderboardLogs(opts: {
	kind: LeaderboardKind;
	userId: string;
	period: LeaderboardPeriod;
	tz: string | undefined;
	now?: Date;
	viewerId?: string | null;
}): Promise<{
	user: {
		handle: string;
		displayName: string;
		image: string | null;
		avatarIsAnimated: boolean;
		diaryMetalTier: DiaryMetalTier | null;
	};
	period: LeaderboardPeriod;
	window: { start: string; end: string };
	items: LeaderboardLogItem[];
	hiddenCount: number;
} | null> {
	const [row] = await db
		.select({
			handle: profile.handle,
			displayName: profile.displayName,
			isPrivate: profile.isPrivate,
			image: user.image,
			preferences: profile.preferences,
		})
		.from(profile)
		.innerJoin(user, eq(profile.userId, user.id))
		.where(eq(profile.userId, opts.userId))
		.limit(1);

	if (!row || row.isPrivate) return null;

	const [logCountRow] = await db
		.select({ c: count(log.id) })
		.from(log)
		.where(and(eq(log.userId, opts.userId), isNull(log.removedAt)));
	const diaryMetalTier = resolveDiaryMetalTier(Number(logCountRow?.c ?? 0));

	const { start, end } = resolveLeaderboardWindow(
		opts.period,
		opts.tz,
		opts.now,
	);

	if (opts.kind === "films") {
		const logs = await db
			.select({
				logId: log.id,
				watchedAt: log.watchedAt,
				movieId: log.movieId,
				rating: log.rating,
				rewatch: log.rewatch,
				title: movie.title,
				posterPath: movie.posterPath,
			})
			.from(log)
			.innerJoin(movie, eq(log.movieId, movie.tmdbId))
			.where(
				and(
					eq(log.userId, opts.userId),
					isNull(log.removedAt),
					isNotNull(log.movieId),
					gte(log.watchedAt, start),
					lt(log.watchedAt, end),
					contentVisibilityWhere(
						opts.viewerId ?? null,
						log.userId,
						log.visibility,
					),
				),
			)
			.orderBy(desc(log.watchedAt));

		const [totalRow] = await db
			.select({ total: count() })
			.from(log)
			.where(
				and(
					eq(log.userId, opts.userId),
					isNull(log.removedAt),
					isNotNull(log.movieId),
					gte(log.watchedAt, start),
					lt(log.watchedAt, end),
				),
			);
		const hiddenCount = clampHiddenCount(
			Number(totalRow?.total ?? 0),
			logs.length,
		);

		return {
			user: {
				handle: row.handle,
				displayName: row.displayName,
				image: row.image ?? null,
				avatarIsAnimated: readAvatarIsAnimatedPref(
					row.preferences as Record<string, unknown> | null,
				),
				diaryMetalTier,
			},
			period: opts.period,
			window: { start: start.toISOString(), end: end.toISOString() },
			hiddenCount,
			items: await annotateLeaderboardLogsWithLifetimeCounts(
				opts.userId,
				annotateLeaderboardLogItems(
					logs.map((l) => ({
						logId: l.logId,
						watchedAt: l.watchedAt.toISOString(),
						movieId: l.movieId,
						tvId: null,
						title: l.title,
						posterPath: l.posterPath,
						rating: l.rating,
						rewatch: l.rewatch,
					})),
				),
			),
		};
	}

	const logs = await db
		.select({
			logId: log.id,
			watchedAt: log.watchedAt,
			tvId: log.tvId,
			rating: log.rating,
			rewatch: log.rewatch,
			title: tv.title,
			posterPath: tv.posterPath,
		})
		.from(log)
		.innerJoin(tv, eq(log.tvId, tv.tmdbId))
		.where(
			and(
				eq(log.userId, opts.userId),
				isNull(log.removedAt),
				isNotNull(log.tvId),
				gte(log.watchedAt, start),
				lt(log.watchedAt, end),
				contentVisibilityWhere(
					opts.viewerId ?? null,
					log.userId,
					log.visibility,
				),
			),
		)
		.orderBy(desc(log.watchedAt));

	const [tvTotalRow] = await db
		.select({ total: count() })
		.from(log)
		.where(
			and(
				eq(log.userId, opts.userId),
				isNull(log.removedAt),
				isNotNull(log.tvId),
				gte(log.watchedAt, start),
				lt(log.watchedAt, end),
			),
		);
	const tvHiddenCount = clampHiddenCount(
		Number(tvTotalRow?.total ?? 0),
		logs.length,
	);

	return {
		user: {
			handle: row.handle,
			displayName: row.displayName,
			image: row.image ?? null,
			avatarIsAnimated: readAvatarIsAnimatedPref(
				row.preferences as Record<string, unknown> | null,
			),
			diaryMetalTier,
		},
		period: opts.period,
		window: { start: start.toISOString(), end: end.toISOString() },
		hiddenCount: tvHiddenCount,
		items: await annotateLeaderboardLogsWithLifetimeCounts(
			opts.userId,
			annotateLeaderboardLogItems(
				logs.map((l) => ({
					logId: l.logId,
					watchedAt: l.watchedAt.toISOString(),
					movieId: null,
					tvId: l.tvId,
					title: l.title,
					posterPath: l.posterPath,
					rating: l.rating,
					rewatch: l.rewatch,
				})),
			),
		),
	};
}
