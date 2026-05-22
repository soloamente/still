import { block, db, log, movie, profile, tv, user } from "@still/db";
import {
	and,
	asc,
	desc,
	eq,
	gt,
	gte,
	isNotNull,
	lt,
	notInArray,
	or,
	sql,
} from "drizzle-orm";

import type { LeaderboardPeriod } from "./leaderboard-period";
import { resolveLeaderboardWindow } from "./leaderboard-period";

export type LeaderboardKind = "films" | "tv";

export type LeaderboardEntry = {
	rank: number;
	userId: string;
	handle: string;
	displayName: string;
	/** Auth `user.image` — UI routes through `/api/profiles/avatar/:handle`. */
	image: string | null;
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
};

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
}): Promise<LeaderboardResult> {
	const { start, end } = resolveLeaderboardWindow(
		opts.period,
		opts.tz,
		opts.now,
	);
	const blockedIds = opts.viewerId
		? await blockedUserIdsForViewer(opts.viewerId)
		: [];

	const rows = await db
		.select({
			userId: log.userId,
			handle: profile.handle,
			displayName: profile.displayName,
			image: sql<string | null>`max(${user.image})`.as("image"),
			count: sql<number>`count(*)::int`.as("count"),
			lastWatch: sql<Date>`max(${log.watchedAt})`.as("last_watch"),
		})
		.from(log)
		.innerJoin(profile, eq(log.userId, profile.userId))
		.innerJoin(user, eq(log.userId, user.id))
		.where(baseLogConditions(opts.kind, start, end, blockedIds))
		.groupBy(log.userId, profile.handle, profile.displayName)
		.orderBy(
			desc(sql`count(*)`),
			asc(sql`max(${log.watchedAt})`),
			asc(profile.handle),
		)
		.limit(50);

	const entries: LeaderboardEntry[] = rows.map((row, index) => ({
		rank: index + 1,
		userId: row.userId,
		handle: row.handle,
		displayName: row.displayName,
		image: row.image ?? null,
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
}): Promise<{
	user: { handle: string; displayName: string; image: string | null };
	period: LeaderboardPeriod;
	window: { start: string; end: string };
	items: LeaderboardLogItem[];
} | null> {
	const [row] = await db
		.select({
			handle: profile.handle,
			displayName: profile.displayName,
			isPrivate: profile.isPrivate,
			image: user.image,
		})
		.from(profile)
		.innerJoin(user, eq(profile.userId, user.id))
		.where(eq(profile.userId, opts.userId))
		.limit(1);

	if (!row || row.isPrivate) return null;

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
				title: movie.title,
				posterPath: movie.posterPath,
			})
			.from(log)
			.innerJoin(movie, eq(log.movieId, movie.tmdbId))
			.where(
				and(
					eq(log.userId, opts.userId),
					isNotNull(log.movieId),
					gte(log.watchedAt, start),
					lt(log.watchedAt, end),
				),
			)
			.orderBy(desc(log.watchedAt));

		return {
			user: {
				handle: row.handle,
				displayName: row.displayName,
				image: row.image ?? null,
			},
			period: opts.period,
			window: { start: start.toISOString(), end: end.toISOString() },
			items: logs.map((l) => ({
				logId: l.logId,
				watchedAt: l.watchedAt.toISOString(),
				movieId: l.movieId,
				tvId: null,
				title: l.title,
				posterPath: l.posterPath,
				rating: l.rating,
			})),
		};
	}

	const logs = await db
		.select({
			logId: log.id,
			watchedAt: log.watchedAt,
			tvId: log.tvId,
			rating: log.rating,
			title: tv.title,
			posterPath: tv.posterPath,
		})
		.from(log)
		.innerJoin(tv, eq(log.tvId, tv.tmdbId))
		.where(
			and(
				eq(log.userId, opts.userId),
				isNotNull(log.tvId),
				gte(log.watchedAt, start),
				lt(log.watchedAt, end),
			),
		)
		.orderBy(desc(log.watchedAt));

	return {
		user: {
			handle: row.handle,
			displayName: row.displayName,
			image: row.image ?? null,
		},
		period: opts.period,
		window: { start: start.toISOString(), end: end.toISOString() },
		items: logs.map((l) => ({
			logId: l.logId,
			watchedAt: l.watchedAt.toISOString(),
			movieId: null,
			tvId: l.tvId,
			title: l.title,
			posterPath: l.posterPath,
			rating: l.rating,
		})),
	};
}
