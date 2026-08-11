import type { StaffRole } from "@still/auth/permissions";
import { block, db, log, movie, profile, tv, user } from "@still/db";
import type { PlanTierId } from "@still/plans";
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
	or,
	sql,
} from "drizzle-orm";
import { communityOffset } from "./community-page-args";
import { contentVisibilityWhere } from "./content-visibility";
import type { DiaryMetalTier } from "./diary-metal-tier";
import {
	sqlEpisodeRankWeight,
	sqlEpisodesRankScopePredicate,
	weightForEpisodeRankLog,
} from "./leaderboard-episode-weight";
import { clampHiddenCount } from "./leaderboard-hidden-count";
import type { LeaderboardPeriod } from "./leaderboard-period";
import { resolveLeaderboardWindow } from "./leaderboard-period";
import { leaderboardPublicProfileConditions } from "./leaderboard-profile-eligibility";
import {
	fetchPatronAvatarBadgeMaps,
	patronAvatarBadgeFields,
} from "./patron-avatar-badge";
import { readAvatarIsAnimatedPref } from "./profile-media";
import { ledgerDisplayRatingForTvLog } from "./tv-title-score";

export type LeaderboardKind = "films" | "tv" | "episodes";

export const LEADERBOARD_DEFAULT_LIMIT = 50;
export const LEADERBOARD_MAX_LIMIT = 50;

export function parseLeaderboardLimit(raw: string | undefined): number {
	const n = Number(raw);
	if (!Number.isFinite(n) || n < 1) return LEADERBOARD_DEFAULT_LIMIT;
	return Math.min(Math.floor(n), LEADERBOARD_MAX_LIMIT);
}

export type LeaderboardEntry = {
	rank: number;
	userId: string;
	handle: string;
	displayName: string;
	/** Auth `user.image` — UI routes through `/api/profiles/avatar/:handle`. */
	image: string | null;
	avatarIsAnimated: boolean;
	diaryMetalTier: DiaryMetalTier | null;
	planTier: PlanTierId;
	staffRole: StaffRole | null;
	count: number;
};

export type LeaderboardResult = {
	kind: LeaderboardKind;
	period: LeaderboardPeriod;
	window: { start: string; end: string };
	page: number;
	limit: number;
	nextPage: number | null;
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
	/** TV diary scope — present on Episodes (and TV) ledger rows. */
	logScope?: "show" | "season" | "episode" | null;
	seasonNumber?: number | null;
	episodeNumber?: number | null;
	/**
	 * Episode-equivalent weight for Episodes ranks (season/show expand to N).
	 * Omitted on Films / Shows boards where each row counts as 1.
	 */
	episodeWeight?: number;
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
	logScope?: "show" | "season" | "episode" | null;
	seasonNumber?: number | null;
	episodeNumber?: number | null;
	episodeWeight?: number;
};

/**
 * Group key for rewatch / period ordinals — TV seasons and episodes of the same
 * series must not share a bucket (Squid Game S1 + S2 ≠ "2nd this month").
 */
export function leaderboardLogGroupKey(item: {
	logId: string;
	movieId: number | null;
	tvId: number | null;
	logScope?: "show" | "season" | "episode" | null;
	seasonNumber?: number | null;
	episodeNumber?: number | null;
}): string {
	if (item.movieId != null) return `movie:${item.movieId}`;
	if (item.tvId == null) return item.logId;

	const scope = item.logScope ?? "show";
	if (scope === "episode") {
		return `tv:${item.tvId}:episode:${item.seasonNumber ?? "x"}:${item.episodeNumber ?? "x"}`;
	}
	if (scope === "season") {
		return `tv:${item.tvId}:season:${item.seasonNumber ?? "x"}`;
	}
	return `tv:${item.tvId}:show`;
}

/** Groups period logs by title (or TV scope unit) for rewatch ordinals. */
export function annotateLeaderboardLogItems(
	raw: LeaderboardLogItemRow[],
): LeaderboardLogItem[] {
	const groups = new Map<string, LeaderboardLogItemRow[]>();

	for (const item of raw) {
		const key = leaderboardLogGroupKey(item);
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
	logScope?: "show" | "season" | "episode" | null;
	seasonNumber?: number | null;
	episodeNumber?: number | null;
};

/** All-time watch ordinals per title / TV scope unit — ledger poster labels. */
export function buildLifetimeWatchIndexMap(
	rows: LifetimeWatchRow[],
): Map<string, { watchIndexLifetime: number; watchCountLifetime: number }> {
	const groups = new Map<string, LifetimeWatchRow[]>();

	for (const item of rows) {
		const key = leaderboardLogGroupKey(item);
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
			logScope: log.logScope,
			seasonNumber: log.seasonNumber,
			episodeNumber: log.episodeNumber,
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
	if (kind === "films") return isNotNull(log.movieId);
	return isNotNull(log.tvId);
}

/**
 * Episodes ranks: weighted episode + season + show diary scopes (with dedupe).
 * Shows ranks stay unfiltered by scope (every TV diary row counts as 1).
 */
function logScopeFilter(kind: LeaderboardKind, start: Date, end: Date) {
	if (kind === "episodes") return sqlEpisodesRankScopePredicate(start, end);
	return undefined;
}

/** Log rows in the window that count toward public Community ranks. */
function publicLogWindowConditions(
	kind: LeaderboardKind,
	start: Date,
	end: Date,
) {
	const scopeFilter = logScopeFilter(kind, start, end);
	return and(
		isNull(log.removedAt),
		mediaFilter(kind),
		gte(log.watchedAt, start),
		lt(log.watchedAt, end),
		eq(log.visibility, "public"),
		...(scopeFilter ? [scopeFilter] : []),
	);
}

/** Per-patron activity for ranks — Episodes uses weighted sum + tv join. */
function leaderboardActivitySubquery(
	kind: LeaderboardKind,
	start: Date,
	end: Date,
) {
	if (kind === "episodes") {
		return db
			.select({
				userId: log.userId,
				count: sql<number>`coalesce(sum(${sqlEpisodeRankWeight()}), 0)::int`.as(
					"count",
				),
				lastWatch: sql<Date>`max(${log.watchedAt})`.as("last_watch"),
			})
			.from(log)
			.leftJoin(tv, eq(log.tvId, tv.tmdbId))
			.where(publicLogWindowConditions(kind, start, end))
			.groupBy(log.userId)
			.as("activity");
	}

	return db
		.select({
			userId: log.userId,
			count: sql<number>`count(*)::int`.as("count"),
			lastWatch: sql<Date>`max(${log.watchedAt})`.as("last_watch"),
		})
		.from(log)
		.where(publicLogWindowConditions(kind, start, end))
		.groupBy(log.userId)
		.as("activity");
}

function publicLeaderboardProfileConditions(blockedIds: string[]) {
	return leaderboardPublicProfileConditions(blockedIds);
}

/**
 * Global leaderboard — top patrons by public log count in the half-open window.
 */
export async function fetchLeaderboard(opts: {
	kind: LeaderboardKind;
	period: LeaderboardPeriod;
	tz: string | undefined;
	viewerId: string | null;
	now?: Date;
	/** When set, skips `resolveLeaderboardWindow` (month-recap, backfills). */
	window?: { start: Date; end: Date };
	page?: number;
	limit?: number;
}): Promise<LeaderboardResult> {
	const page = opts.page ?? 1;
	const limit = opts.limit ?? LEADERBOARD_DEFAULT_LIMIT;
	const offset = communityOffset(page, limit);
	const { start, end } =
		opts.window ?? resolveLeaderboardWindow(opts.period, opts.tz, opts.now);
	const blockedIds = opts.viewerId
		? await blockedUserIdsForViewer(opts.viewerId)
		: [];

	// Per-patron public log counts — left-joined so eligible zero-log patrons appear.
	// Episodes board sums episode-equivalent weights (season/show expand via TMDb).
	const activity = leaderboardActivitySubquery(opts.kind, start, end);

	const rows = await db
		.select({
			userId: profile.userId,
			handle: profile.handle,
			displayName: profile.displayName,
			image: user.image,
			preferences: profile.preferences,
			count: sql<number>`coalesce(${activity.count}, 0)::int`.as("count"),
			lastWatch: activity.lastWatch,
		})
		.from(profile)
		.innerJoin(user, eq(profile.userId, user.id))
		.leftJoin(activity, eq(profile.userId, activity.userId))
		.where(and(...publicLeaderboardProfileConditions(blockedIds)))
		.orderBy(
			desc(sql`coalesce(${activity.count}, 0)`),
			asc(sql`coalesce(${activity.lastWatch}, to_timestamp(0))`),
			asc(profile.handle),
		)
		.limit(limit + 1)
		.offset(offset);

	const hasMore = rows.length > limit;
	const pageRows = hasMore ? rows.slice(0, limit) : rows;

	// Community Film/TV ranks — public profiles only; counts use public diary logs.
	const userIds = pageRows.map((row) => row.userId);
	const badgeMaps = await fetchPatronAvatarBadgeMaps(userIds);

	const entries: LeaderboardEntry[] = pageRows.map((row, index) => ({
		rank: offset + index + 1,
		userId: row.userId,
		handle: row.handle,
		displayName: row.displayName,
		image: row.image ?? null,
		avatarIsAnimated: readAvatarIsAnimatedPref(
			row.preferences as Record<string, unknown> | null,
		),
		...patronAvatarBadgeFields(row.userId, badgeMaps),
		count: Number(row.count),
	}));

	let viewer: { rank: number; count: number } | null = null;
	if (opts.viewerId) {
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

	return {
		kind: opts.kind,
		period: opts.period,
		window: { start: start.toISOString(), end: end.toISOString() },
		page,
		limit,
		nextPage: hasMore ? page + 1 : null,
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
	const [viewerProfile] = await db
		.select({ handle: profile.handle, isPrivate: profile.isPrivate })
		.from(profile)
		.where(eq(profile.userId, opts.viewerId))
		.limit(1);
	if (!viewerProfile?.handle || viewerProfile.isPrivate) return null;

	const activity = leaderboardActivitySubquery(opts.kind, opts.start, opts.end);

	const [selfRow] = await db
		.select({
			count: sql<number>`coalesce(${activity.count}, 0)::int`.as("count"),
			lastWatch: activity.lastWatch,
		})
		.from(profile)
		.leftJoin(activity, eq(profile.userId, activity.userId))
		.where(
			and(
				eq(profile.userId, opts.viewerId),
				eq(profile.isPrivate, false),
				isNotNull(profile.handle),
			),
		);

	const count = Number(selfRow?.count ?? 0);
	const lastWatch = selfRow?.lastWatch ?? null;

	const aheadWhenHigherCount = gt(sql`coalesce(${activity.count}, 0)`, count);
	const aheadConditions = [aheadWhenHigherCount];

	if (count > 0 && lastWatch) {
		const tiedEarlier = and(
			eq(sql`coalesce(${activity.count}, 0)`, count),
			lt(activity.lastWatch, lastWatch),
		);
		if (tiedEarlier) aheadConditions.push(tiedEarlier);
	}

	const tiedHandle = and(
		eq(sql`coalesce(${activity.count}, 0)`, count),
		lastWatch
			? eq(activity.lastWatch, lastWatch)
			: sql`${activity.lastWatch} is null`,
		lt(profile.handle, viewerProfile.handle),
	);
	if (tiedHandle) aheadConditions.push(tiedHandle);

	const [aheadRow] = await db
		.select({ ahead: sql<number>`count(*)::int`.as("ahead") })
		.from(profile)
		.leftJoin(activity, eq(profile.userId, activity.userId))
		.where(
			and(
				...publicLeaderboardProfileConditions(opts.blockedIds),
				or(...aheadConditions),
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
		planTier: PlanTierId;
		staffRole: StaffRole | null;
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
			role: user.role,
			preferences: profile.preferences,
		})
		.from(profile)
		.innerJoin(user, eq(profile.userId, user.id))
		.where(eq(profile.userId, opts.userId))
		.limit(1);

	if (!row || row.isPrivate) return null;

	const badgeMaps = await fetchPatronAvatarBadgeMaps([opts.userId]);
	const { diaryMetalTier, planTier, staffRole } = patronAvatarBadgeFields(
		opts.userId,
		badgeMaps,
	);

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
					publicLogWindowConditions("films", start, end),
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
				planTier,
				staffRole,
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

	const tvKind = opts.kind;
	const scopeFilter = logScopeFilter(tvKind, start, end);
	const isEpisodesBoard = tvKind === "episodes";

	const logs = await db
		.select({
			logId: log.id,
			watchedAt: log.watchedAt,
			tvId: log.tvId,
			rating: log.rating,
			rewatch: log.rewatch,
			logScope: log.logScope,
			seasonNumber: log.seasonNumber,
			episodeNumber: log.episodeNumber,
			title: tv.title,
			posterPath: tv.posterPath,
			tmdbJson: tv.tmdbJson,
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
				...(scopeFilter ? [scopeFilter] : []),
				contentVisibilityWhere(
					opts.viewerId ?? null,
					log.userId,
					log.visibility,
				),
			),
		)
		.orderBy(desc(log.watchedAt));

	const [tvTotalRow] = await db
		.select({
			total: isEpisodesBoard
				? sql<number>`coalesce(sum(${sqlEpisodeRankWeight()}), 0)::int`
				: count(),
		})
		.from(log)
		.leftJoin(tv, eq(log.tvId, tv.tmdbId))
		.where(
			and(
				eq(log.userId, opts.userId),
				publicLogWindowConditions(tvKind, start, end),
			),
		);

	// Hidden gap: public weighted (or row) total minus rows visible to this viewer.
	const visibleWeight = isEpisodesBoard
		? logs.reduce(
				(sum, l) =>
					sum +
					weightForEpisodeRankLog(
						l.logScope,
						l.seasonNumber,
						(l.tmdbJson as Record<string, unknown> | null) ?? null,
					),
				0,
			)
		: logs.length;
	const tvHiddenCount = clampHiddenCount(
		Number(tvTotalRow?.total ?? 0),
		visibleWeight,
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
			planTier,
			staffRole,
		},
		period: opts.period,
		window: { start: start.toISOString(), end: end.toISOString() },
		hiddenCount: tvHiddenCount,
		items: await annotateLeaderboardLogsWithLifetimeCounts(
			opts.userId,
			annotateLeaderboardLogItems(
				(() => {
					const scoreInputs = logs.map((l) => ({
						tvId: l.tvId,
						logScope: l.logScope,
						seasonNumber: l.seasonNumber,
						rating: l.rating,
					}));
					return logs.map((l) => {
						const tmdbJson =
							(l.tmdbJson as Record<string, unknown> | null) ?? null;
						return {
							logId: l.logId,
							watchedAt: l.watchedAt.toISOString(),
							movieId: null,
							tvId: l.tvId,
							title: l.title,
							posterPath: l.posterPath,
							rating: ledgerDisplayRatingForTvLog(
								{
									tvId: l.tvId,
									logScope: l.logScope,
									seasonNumber: l.seasonNumber,
									rating: l.rating,
								},
								scoreInputs,
							),
							rewatch: l.rewatch,
							logScope: l.logScope,
							seasonNumber: l.seasonNumber,
							episodeNumber: l.episodeNumber,
							...(isEpisodesBoard
								? {
										episodeWeight: weightForEpisodeRankLog(
											l.logScope,
											l.seasonNumber,
											tmdbJson,
										),
									}
								: {}),
						};
					});
				})(),
			),
		),
	};
}
