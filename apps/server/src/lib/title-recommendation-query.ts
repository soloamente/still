import {
	block,
	db,
	follow,
	log,
	movie,
	titleRecommendation,
	tv,
	user,
} from "@still/db";
import {
	and,
	desc,
	eq,
	gte,
	inArray,
	isNull,
	or,
	type SQL,
	sql,
} from "drizzle-orm";

import { joinedTitleItemNotAdultSql } from "./adult-content-sql";
import { getShowAdultContentForUser } from "./adult-content-user-pref";
import { contentVisibilityWhere } from "./content-visibility";
import { ensureMovieCached } from "./ensure-movie-cached";
import {
	canRecommendBetween,
	type RecommendationGate,
	type RecommendationMediaKind,
	type RecommendationSuggestion,
	type RecommendationSuggestionCandidate,
	rankRecommendationSuggestions,
	titleKey,
} from "./title-recommendation";
import { ensureTvCached } from "./tv-cache";

/** Sender logs at or above this score (tenths) are worth recommending. */
const SUGGESTION_MIN_RATING_TENTHS = 70;
/** Recent loved logs scanned for suggestions — enough to survive dedupe. */
const SUGGESTION_CANDIDATE_SCAN = 60;

/**
 * Adult flag for a log/recommendation row joined to `movie` + `tv` — TMDb flag
 * plus cached MAL `_stillAdult` for shows (same rule as `tvNotAdultSql`).
 * Projects only the JSON path, never the whole `tmdb_json` payload.
 */
const joinedTitleIsAdultSql = sql<boolean>`(
	coalesce(${movie.adult}, false)
	OR coalesce(${tv.adult}, false)
	OR coalesce((${tv.tmdbJson}->'_stillAdult'->>'isAdult')::boolean, false)
)`;

/** Follow graph + block + ban check between sender and recipient. */
export async function loadRecommendationGate(
	senderId: string,
	recipientId: string,
): Promise<RecommendationGate> {
	if (senderId === recipientId) return { ok: false, reason: "self" };
	const [recipientRows, followRows, blockRows] = await Promise.all([
		db
			.select({ banned: user.banned })
			.from(user)
			.where(eq(user.id, recipientId))
			.limit(1),
		db
			.select({ followerId: follow.followerId })
			.from(follow)
			.where(
				or(
					and(
						eq(follow.followerId, senderId),
						eq(follow.followingId, recipientId),
					),
					and(
						eq(follow.followerId, recipientId),
						eq(follow.followingId, senderId),
					),
				),
			),
		db
			.select({ blockerId: block.blockerId })
			.from(block)
			.where(
				or(
					and(eq(block.blockerId, senderId), eq(block.blockedId, recipientId)),
					and(eq(block.blockerId, recipientId), eq(block.blockedId, senderId)),
				),
			)
			.limit(1),
	]);
	const recipient = recipientRows[0];
	if (!recipient) return { ok: false, reason: "unavailable" };
	return canRecommendBetween({
		senderId,
		recipientId,
		senderFollowsRecipient: followRows.some((r) => r.followerId === senderId),
		recipientFollowsSender: followRows.some(
			(r) => r.followerId === recipientId,
		),
		blocked: blockRows.length > 0,
		recipientBanned: recipient.banned === true,
	});
}

function titleIdWhere(
	cols: { movieId: typeof log.movieId; tvId: typeof log.tvId },
	keys: readonly { mediaKind: RecommendationMediaKind; tmdbId: number }[],
): SQL | undefined {
	const movieIds = keys
		.filter((k) => k.mediaKind === "movie")
		.map((k) => k.tmdbId);
	const tvIds = keys.filter((k) => k.mediaKind === "tv").map((k) => k.tmdbId);
	const parts = [
		movieIds.length > 0 ? inArray(cols.movieId, movieIds) : undefined,
		tvIds.length > 0 ? inArray(cols.tvId, tvIds) : undefined,
	].filter((p): p is SQL => p !== undefined);
	if (parts.length === 0) return undefined;
	return parts.length === 1 ? parts[0] : or(...parts);
}

function keyFromRow(row: {
	movieId: number | null;
	tvId: number | null;
}): string | null {
	if (row.movieId != null) return titleKey("movie", row.movieId);
	if (row.tvId != null) return titleKey("tv", row.tvId);
	return null;
}

/**
 * Three picks from the sender's own loved logs for this recipient. Never reads
 * the recipient's lists or watchlist; the recipient's diary is consulted only
 * through the sender's visibility (so "already watched" can't leak a private log).
 */
export async function fetchRecommendationSuggestions(
	senderId: string,
	recipientId: string,
): Promise<RecommendationSuggestion[]> {
	const showAdultContent = await getShowAdultContentForUser(senderId);

	const rows = await db
		.select({
			movieId: log.movieId,
			tvId: log.tvId,
			movieTitle: movie.title,
			moviePosterPath: movie.posterPath,
			tvTitle: tv.title,
			tvPosterPath: tv.posterPath,
			rating: log.rating,
			liked: log.liked,
			createdAt: log.createdAt,
			isAdult: joinedTitleIsAdultSql,
		})
		.from(log)
		.leftJoin(movie, eq(movie.tmdbId, log.movieId))
		.leftJoin(tv, eq(tv.tmdbId, log.tvId))
		.where(
			and(
				eq(log.userId, senderId),
				isNull(log.removedAt),
				or(gte(log.rating, SUGGESTION_MIN_RATING_TENTHS), eq(log.liked, true)),
				joinedTitleItemNotAdultSql(showAdultContent, {
					movieId: log.movieId,
					tvId: log.tvId,
				}),
			),
		)
		.orderBy(desc(log.createdAt), desc(log.id))
		.limit(SUGGESTION_CANDIDATE_SCAN);

	const candidates: RecommendationSuggestionCandidate[] = [];
	for (const row of rows) {
		if (row.movieId != null && row.movieTitle) {
			candidates.push({
				mediaKind: "movie",
				tmdbId: row.movieId,
				title: row.movieTitle,
				posterPath: row.moviePosterPath,
				ratingTenths: row.rating,
				liked: row.liked,
				loggedAt: row.createdAt,
				sensitive: row.isAdult === true,
			});
		} else if (row.tvId != null && row.tvTitle) {
			candidates.push({
				mediaKind: "tv",
				tmdbId: row.tvId,
				title: row.tvTitle,
				posterPath: row.tvPosterPath,
				ratingTenths: row.rating,
				liked: row.liked,
				loggedAt: row.createdAt,
				sensitive: row.isAdult === true,
			});
		}
	}
	if (candidates.length === 0) return [];

	const candidateIdsWhere = titleIdWhere(
		{ movieId: log.movieId, tvId: log.tvId },
		candidates,
	);
	const [recipientLogs, priorSends] = await Promise.all([
		db
			.select({ movieId: log.movieId, tvId: log.tvId })
			.from(log)
			.where(
				and(
					eq(log.userId, recipientId),
					isNull(log.removedAt),
					contentVisibilityWhere(senderId, log.userId, log.visibility),
					candidateIdsWhere,
				),
			),
		db
			.select({
				movieId: titleRecommendation.movieId,
				tvId: titleRecommendation.tvId,
			})
			.from(titleRecommendation)
			.where(
				and(
					eq(titleRecommendation.senderUserId, senderId),
					eq(titleRecommendation.recipientUserId, recipientId),
				),
			),
	]);

	const toKeySet = (list: { movieId: number | null; tvId: number | null }[]) =>
		new Set(list.map(keyFromRow).filter((k): k is string => k !== null));

	return rankRecommendationSuggestions({
		candidates,
		recipientVisibleWatchedKeys: toKeySet(recipientLogs),
		alreadyRecommendedKeys: toKeySet(priorSends),
	});
}

export type RecommendableTitle = {
	title: string;
	posterPath: string | null;
	sensitive: boolean;
};

/** Cache the TMDb title locally (FK target) and read what the notification needs. */
export async function loadRecommendableTitle(
	mediaKind: RecommendationMediaKind,
	tmdbId: number,
): Promise<RecommendableTitle | null> {
	if (mediaKind === "movie") {
		await ensureMovieCached(tmdbId);
		const [row] = await db
			.select({
				title: movie.title,
				posterPath: movie.posterPath,
				adult: movie.adult,
			})
			.from(movie)
			.where(eq(movie.tmdbId, tmdbId))
			.limit(1);
		return row
			? { title: row.title, posterPath: row.posterPath, sensitive: row.adult }
			: null;
	}

	if (!(await ensureTvCached(tmdbId))) return null;
	const [row] = await db
		.select({
			title: tv.title,
			posterPath: tv.posterPath,
			sensitive: sql<boolean>`(
				${tv.adult}
				OR coalesce((${tv.tmdbJson}->'_stillAdult'->>'isAdult')::boolean, false)
			)`,
		})
		.from(tv)
		.where(eq(tv.tmdbId, tmdbId))
		.limit(1);
	return row
		? {
				title: row.title,
				posterPath: row.posterPath,
				sensitive: row.sensitive === true,
			}
		: null;
}

/** True when this sender already sent this exact title to this recipient. */
export async function hasRecommendedTitle(args: {
	senderId: string;
	recipientId: string;
	mediaKind: RecommendationMediaKind;
	tmdbId: number;
}): Promise<boolean> {
	const [row] = await db
		.select({ id: titleRecommendation.id })
		.from(titleRecommendation)
		.where(
			and(
				eq(titleRecommendation.senderUserId, args.senderId),
				eq(titleRecommendation.recipientUserId, args.recipientId),
				args.mediaKind === "movie"
					? eq(titleRecommendation.movieId, args.tmdbId)
					: eq(titleRecommendation.tvId, args.tmdbId),
			),
		)
		.limit(1);
	return row != null;
}
