import type { ContentVisibility } from "@still/db";
import {
	comment,
	db,
	eventLog,
	log,
	movie,
	profile,
	reaction,
	review,
	user,
} from "@still/db";
import { and, count, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { context } from "../context";
import {
	communityOffset,
	parseCommunityPage,
} from "../lib/community-page-args";
import {
	resolveCommunityPeriodQuery,
	withinCommunityPeriod,
} from "../lib/community-period";
import {
	canViewContent,
	contentVisibilityWhere,
	resolveViewerFollow,
	visibilitySchema,
} from "../lib/content-visibility";
import { reviewEngagementOrderSql } from "../lib/creator-recognition";
import { makeId } from "../lib/cuid";
import { resolveDiaryMetalTier } from "../lib/diary-metal-tier";
import {
	areUsersMutualFollows,
	deliverNotification,
} from "../lib/notification-delivery";
import { readAvatarIsAnimatedPref } from "../lib/profile-media";
import { removePinnedReviewId } from "../lib/profile-pinned-reviews";
import { hit } from "../lib/rate-limit";
import {
	assertEmailVerified,
	EmailVerificationRequiredError,
	emailVerificationRequiredBody,
	isPublicContentVisibility,
} from "../lib/require-verified-email";
import {
	assertReviewAudioUpload,
	buildReviewAudioBlobKey,
} from "../lib/review-audio";
import {
	assertValidReviewStillSlideKey,
	fetchReviewMovieScreenshots,
	resolveReviewStillSlide,
} from "../lib/review-movie-screenshots";
import { movieReviewNotificationHref } from "../lib/review-notification-href";
import { isValidReviewRatingStored } from "../lib/review-rating";
import {
	readReviewReactionSnapshot,
	removeViewerReviewReaction,
} from "../lib/review-reactions";
import { routeBody } from "../lib/route-body";
import { vercelBlobAudioPut } from "../lib/vercel-blob-audio-put";
import {
	parseViralReviewsLimit,
	viralReviewCandidateSql,
} from "../lib/viral-reviews-query";

const reviewRatingSchema = t.Optional(
	t.Union([t.Integer({ minimum: 0, maximum: 100 }), t.Null()]),
);

type CreateReviewBody = {
	movieId: number;
	logId?: string;
	title?: string;
	body: string;
	/** When true, empty body is allowed — client uploads voice in a follow-up POST. */
	hasVoiceAttachment?: boolean;
	rating?: number;
	containsSpoilers?: boolean;
	visibility?: ContentVisibility;
	stillSlideKey?: string | null;
};

type PatchReviewBody = {
	title?: string;
	body?: string;
	rating?: number;
	containsSpoilers?: boolean;
	visibility?: ContentVisibility;
	stillSlideKey?: string | null;
};

export const reviewsRoute = new Elysia({
	prefix: "/api/reviews",
	tags: ["reviews"],
})
	.use(context)
	.post(
		"/",
		async ({ body: rawBody, user, status }) => {
			if (!user) return status(401, "Sign in");
			if (!hit(`reviews:create:${user.id}`, { limit: 12, windowMs: 60_000 }).ok)
				return status(429, "Slow down");
			const body = routeBody<CreateReviewBody>(rawBody);
			let logId = body.logId ?? null;
			let rating = body.rating ?? null;

			if (rating == null) {
				if (logId) {
					const [linkedLog] = await db
						.select({ rating: log.rating })
						.from(log)
						.where(and(eq(log.id, logId), eq(log.userId, user.id)))
						.limit(1);
					rating = linkedLog?.rating ?? null;
				} else {
					const [latestLog] = await db
						.select({ id: log.id, rating: log.rating })
						.from(log)
						.where(
							and(
								eq(log.userId, user.id),
								eq(log.movieId, body.movieId),
								isNotNull(log.rating),
							),
						)
						.orderBy(desc(log.watchedAt))
						.limit(1);
					if (latestLog) {
						logId = latestLog.id;
						rating = latestLog.rating;
					}
				}
			}

			if (rating != null && !isValidReviewRatingStored(rating)) {
				return status(400, "Invalid rating");
			}

			const bodyText = body.body.trim();
			const hasVoiceAttachment = body.hasVoiceAttachment === true;
			if (!hasVoiceAttachment && bodyText.length === 0) {
				return status(400, "Review body required");
			}
			if (bodyText.length > 20_000) {
				return status(400, "Review body too long");
			}

			const stillSlideKey = body.stillSlideKey ?? null;
			if (stillSlideKey) {
				const valid = await assertValidReviewStillSlideKey(
					body.movieId,
					stillSlideKey,
				);
				if (!valid) return status(400, "Invalid still");
			}

			let visibility = body.visibility ?? null;
			if (!visibility) {
				const [own] = await db
					.select({ d: profile.defaultVisibility })
					.from(profile)
					.where(eq(profile.userId, user.id))
					.limit(1);
				visibility = own?.d ?? "public";
			}

			if (isPublicContentVisibility(visibility)) {
				try {
					assertEmailVerified(user);
				} catch (e) {
					if (e instanceof EmailVerificationRequiredError) {
						return status(403, emailVerificationRequiredBody());
					}
					throw e;
				}
			}

			const id = makeId("rev");
			const [row] = await db
				.insert(review)
				.values({
					id,
					userId: user.id,
					movieId: body.movieId,
					logId,
					title: body.title ?? null,
					body: bodyText,
					containsSpoilers: body.containsSpoilers ?? false,
					visibility,
					rating,
					stillSlideKey,
				})
				.returning();
			await db.insert(eventLog).values({
				id: makeId("evt"),
				userId: user.id,
				kind: "review.created",
				payload: { reviewId: id, movieId: body.movieId },
			});
			return row;
		},
		{
			body: t.Object({
				movieId: t.Number(),
				logId: t.Optional(t.String()),
				title: t.Optional(t.String({ maxLength: 200 })),
				body: t.String({ maxLength: 20_000 }),
				hasVoiceAttachment: t.Optional(t.Boolean()),
				rating: reviewRatingSchema,
				containsSpoilers: t.Optional(t.Boolean()),
				visibility: t.Optional(visibilitySchema),
				stillSlideKey: t.Optional(t.Union([t.String(), t.Null()])),
			}),
		},
	)
	.post(
		"/:id/audio",
		async ({ params, request, user, status }) => {
			if (!user) return status(401, "Sign in");
			if (
				!hit(`reviews:audio:${user.id}`, {
					limit: 10,
					windowMs: 3_600_000,
				}).ok
			) {
				return status(429, "Slow down");
			}

			const [existing] = await db
				.select()
				.from(review)
				.where(and(eq(review.id, params.id), isNull(review.removedAt)))
				.limit(1);
			if (!existing || existing.userId !== user.id) {
				return status(404, "Not found");
			}

			if (isPublicContentVisibility(existing.visibility)) {
				try {
					assertEmailVerified(user);
				} catch (e) {
					if (e instanceof EmailVerificationRequiredError) {
						return status(403, emailVerificationRequiredBody());
					}
					throw e;
				}
			}

			const formData = await request.formData();
			const file = formData.get("file");
			if (!(file instanceof File)) return status(400, "Missing file");

			const durationRaw = formData.get("durationMs");
			const durationMs =
				typeof durationRaw === "string"
					? Number.parseInt(durationRaw, 10)
					: Number.NaN;
			if (!Number.isFinite(durationMs)) {
				return status(400, "Invalid durationMs");
			}

			const uploadCheck = assertReviewAudioUpload({
				size: file.size,
				type: file.type,
				durationMs,
			});
			if (!uploadCheck.ok) {
				return status(400, {
					error: uploadCheck.message,
					code: uploadCheck.code,
				});
			}

			const key = buildReviewAudioBlobKey(
				user.id,
				existing.id,
				uploadCheck.mimeType,
			);
			const uploaded = await vercelBlobAudioPut(key, file, durationMs);
			if ("error" in uploaded) {
				const code = uploaded.code;
				if (code === "BLOB_UNCONFIGURED" || code === "BLOB_ACCESS_MISMATCH") {
					return status(code === "BLOB_UNCONFIGURED" ? 503 : 502, {
						error: uploaded.error,
						code,
						hint: uploaded.hint,
					});
				}
				return status(502, { error: uploaded.error, code });
			}

			const [updated] = await db
				.update(review)
				.set({
					audioUrl: uploaded.url,
					audioDurationMs: durationMs,
					audioMimeType: uploaded.mimeType,
				})
				.where(eq(review.id, params.id))
				.returning({
					audioUrl: review.audioUrl,
					audioDurationMs: review.audioDurationMs,
					audioMimeType: review.audioMimeType,
				});

			return (
				updated ?? {
					audioUrl: uploaded.url,
					audioDurationMs: durationMs,
					audioMimeType: uploaded.mimeType,
				}
			);
		},
		{ params: t.Object({ id: t.String() }) },
	)
	.patch(
		"/:id",
		async ({ params, body: rawBody, user, status }) => {
			if (!user) return status(401, "Sign in");
			const body = routeBody<PatchReviewBody>(rawBody);
			const [existing] = await db
				.select()
				.from(review)
				.where(eq(review.id, params.id))
				.limit(1);
			if (!existing || existing.userId !== user.id)
				return status(404, "Not found");
			const effectiveVisibility = body.visibility ?? existing.visibility;
			if (isPublicContentVisibility(effectiveVisibility)) {
				try {
					assertEmailVerified(user);
				} catch (e) {
					if (e instanceof EmailVerificationRequiredError) {
						return status(403, emailVerificationRequiredBody());
					}
					throw e;
				}
			}
			const nextRating =
				existing.logId != null
					? existing.rating
					: body.rating !== undefined
						? body.rating
						: existing.rating;
			if (nextRating != null && !isValidReviewRatingStored(nextRating)) {
				return status(400, "Invalid rating");
			}
			if (body.body !== undefined) {
				const nextBody = body.body.trim();
				if (nextBody.length === 0 && !existing.audioUrl) {
					return status(400, "Review body required without voice attachment");
				}
				if (nextBody.length > 20_000) {
					return status(400, "Review body too long");
				}
			}
			if (body.stillSlideKey !== undefined && body.stillSlideKey !== null) {
				const valid = await assertValidReviewStillSlideKey(
					existing.movieId,
					body.stillSlideKey,
				);
				if (!valid) return status(400, "Invalid still");
			}
			const [updated] = await db
				.update(review)
				.set({
					title: body.title ?? existing.title,
					body: body.body !== undefined ? body.body.trim() : existing.body,
					containsSpoilers: body.containsSpoilers ?? existing.containsSpoilers,
					visibility: body.visibility ?? existing.visibility,
					rating: nextRating,
					stillSlideKey:
						body.stillSlideKey !== undefined
							? body.stillSlideKey
							: existing.stillSlideKey,
				})
				.where(eq(review.id, params.id))
				.returning();
			return updated;
		},
		{
			params: t.Object({ id: t.String() }),
			body: t.Object({
				title: t.Optional(t.String({ maxLength: 200 })),
				body: t.Optional(t.String({ maxLength: 20_000 })),
				rating: reviewRatingSchema,
				containsSpoilers: t.Optional(t.Boolean()),
				visibility: t.Optional(visibilitySchema),
				stillSlideKey: t.Optional(t.Union([t.String(), t.Null()])),
			}),
		},
	)
	.delete(
		"/:id",
		async ({ params, user, status }) => {
			if (!user) return status(401, "Sign in");
			const [existing] = await db
				.select()
				.from(review)
				.where(eq(review.id, params.id))
				.limit(1);
			if (!existing || existing.userId !== user.id)
				return status(404, "Not found");

			const [prof] = await db
				.select({ pinnedReviewIds: profile.pinnedReviewIds })
				.from(profile)
				.where(eq(profile.userId, user.id))
				.limit(1);
			if (prof) {
				const next = removePinnedReviewId(prof.pinnedReviewIds, params.id);
				await db
					.update(profile)
					.set({ pinnedReviewIds: next })
					.where(eq(profile.userId, user.id));
			}

			await db
				.delete(reaction)
				.where(
					and(
						eq(reaction.parentType, "review"),
						eq(reaction.parentId, params.id),
					),
				);
			await db
				.delete(comment)
				.where(
					and(
						eq(comment.parentType, "review"),
						eq(comment.parentId, params.id),
					),
				);

			await db.delete(review).where(eq(review.id, params.id));
			return { ok: true };
		},
		{ params: t.Object({ id: t.String() }) },
	)
	// Engagement-ranked wit-sized reviews for the Community viral rail.
	.get(
		"/viral",
		async ({ query, user: currentUser }) => {
			const limit = parseViralReviewsLimit(query.limit);
			const { start, end } = resolveCommunityPeriodQuery(query);
			const rows = await db
				.select({ review, movie, user, profile })
				.from(review)
				.leftJoin(movie, eq(review.movieId, movie.tmdbId))
				.leftJoin(user, eq(review.userId, user.id))
				.leftJoin(profile, eq(review.userId, profile.userId))
				.where(
					and(
						contentVisibilityWhere(
							currentUser?.id ?? null,
							review.userId,
							review.visibility,
						),
						isNull(review.removedAt),
						withinCommunityPeriod(review.publishedAt, start, end),
						viralReviewCandidateSql(),
					),
				)
				.orderBy(
					desc(reviewEngagementOrderSql()),
					desc(review.publishedAt),
					desc(review.id),
				)
				.limit(limit);
			return rows;
		},
		{
			query: t.Object({
				limit: t.Optional(t.String()),
				period: t.Optional(
					t.Union([
						t.Literal("week"),
						t.Literal("month"),
						t.Literal("year"),
						t.Literal("all"),
					]),
				),
				tz: t.Optional(t.String()),
			}),
		},
	)
	.get(
		"/:id",
		async ({ params, status, user: currentUser }) => {
			// Auth `currentUser` must not shadow the Drizzle `user` table used in joins below.
			const [row] = await db
				.select({
					review,
					movie,
					log,
					authorProfile: profile,
					authorUser: user,
				})
				.from(review)
				.leftJoin(movie, eq(review.movieId, movie.tmdbId))
				.leftJoin(log, eq(review.logId, log.id))
				.leftJoin(profile, eq(review.userId, profile.userId))
				.leftJoin(user, eq(review.userId, user.id))
				.where(and(eq(review.id, params.id), isNull(review.removedAt)))
				.limit(1);
			if (!row) return status(404, "Not found");
			const author = row.review.userId;
			const follows = await resolveViewerFollow(
				currentUser?.id ?? null,
				author,
			);
			if (
				!canViewContent({
					viewerId: currentUser?.id ?? null,
					authorId: author,
					visibility: row.review.visibility,
					...follows,
				})
			) {
				return status(404, "Not found");
			}
			// Viewer like/dislike + public counters.
			const reactionSnapshot = await readReviewReactionSnapshot(
				params.id,
				currentUser?.id ?? null,
			);
			const likedByProfiles = await db
				.select({
					displayName: profile.displayName,
					handle: profile.handle,
				})
				.from(reaction)
				.innerJoin(profile, eq(reaction.userId, profile.userId))
				.where(
					and(
						eq(reaction.parentType, "review"),
						eq(reaction.parentId, params.id),
						eq(reaction.kind, "like"),
					),
				)
				.orderBy(desc(reaction.createdAt))
				.limit(40);
			const handle = row.authorProfile?.handle?.trim();
			const displayName = row.authorProfile?.displayName?.trim();
			const screenshots = await fetchReviewMovieScreenshots(row.review.movieId);
			const selectedStill = resolveReviewStillSlide(
				screenshots,
				row.review.stillSlideKey,
			);
			const [logCountRow] = await db
				.select({ c: count(log.id) })
				.from(log)
				.where(and(eq(log.userId, author), isNull(log.removedAt)));
			return {
				...row,
				author:
					handle && displayName
						? {
								handle,
								displayName,
								image: row.authorUser?.image ?? null,
								avatarIsAnimated: readAvatarIsAnimatedPref(
									row.authorProfile?.preferences as
										| Record<string, unknown>
										| null
										| undefined,
								),
								diaryMetalTier: resolveDiaryMetalTier(
									Number(logCountRow?.c ?? 0),
								),
							}
						: null,
				screenshots,
				selectedStill,
				liked: reactionSnapshot.liked,
				disliked: reactionSnapshot.disliked,
				likesCount: reactionSnapshot.likesCount,
				dislikesCount: reactionSnapshot.dislikesCount,
				likedByProfiles,
			};
		},
		{ params: t.Object({ id: t.String() }) },
	)
	.get(
		"/recent",
		async ({ query, user: currentUser }) => {
			const limit = Math.min(Number(query.limit ?? 20), 50);
			const page = parseCommunityPage(query.page);
			const { start, end } = resolveCommunityPeriodQuery(query);
			const rows = await db
				.select({ review, movie, user, profile })
				.from(review)
				.leftJoin(movie, eq(review.movieId, movie.tmdbId))
				.leftJoin(user, eq(review.userId, user.id))
				.leftJoin(profile, eq(review.userId, profile.userId))
				.where(
					and(
						contentVisibilityWhere(
							currentUser?.id ?? null,
							review.userId,
							review.visibility,
						),
						isNull(review.removedAt),
						withinCommunityPeriod(review.publishedAt, start, end),
					),
				)
				.orderBy(
					desc(reviewEngagementOrderSql()),
					desc(review.publishedAt),
					desc(review.id),
				)
				.limit(limit)
				.offset(communityOffset(page, limit));
			return rows;
		},
		{
			query: t.Object({
				limit: t.Optional(t.String()),
				page: t.Optional(t.String()),
				period: t.Optional(
					t.Union([
						t.Literal("week"),
						t.Literal("month"),
						t.Literal("year"),
						t.Literal("all"),
					]),
				),
				tz: t.Optional(t.String()),
			}),
		},
	)
	.get(
		"/popular",
		async ({ query, user: currentUser }) => {
			const limit = Math.min(Number(query.limit ?? 20), 50);
			const rows = await db
				.select({ review, movie })
				.from(review)
				.leftJoin(movie, eq(review.movieId, movie.tmdbId))
				.where(
					and(
						contentVisibilityWhere(
							currentUser?.id ?? null,
							review.userId,
							review.visibility,
						),
						isNull(review.removedAt),
					),
				)
				.orderBy(desc(review.likesCount), desc(review.publishedAt))
				.limit(limit);
			return rows;
		},
		{ query: t.Object({ limit: t.Optional(t.String()) }) },
	)
	// Toggle a like reaction. Uses the generic `reaction` table; updates
	// the denormalized counter on the review row.
	.post(
		"/:id/like",
		async ({ params, user, status }) => {
			if (!user) return status(401, "Sign in");
			const [existing] = await db
				.select()
				.from(reaction)
				.where(
					and(
						eq(reaction.userId, user.id),
						eq(reaction.parentType, "review"),
						eq(reaction.parentId, params.id),
						eq(reaction.kind, "like"),
					),
				)
				.limit(1);
			if (existing) {
				await removeViewerReviewReaction(user.id, params.id, "like");
				return readReviewReactionSnapshot(params.id, user.id);
			}

			// Like and dislike are mutually exclusive on reviews.
			await removeViewerReviewReaction(user.id, params.id, "dislike");

			await db.insert(reaction).values({
				userId: user.id,
				parentType: "review",
				parentId: params.id,
				kind: "like",
			});
			await db
				.update(review)
				.set({ likesCount: sql`${review.likesCount} + 1` })
				.where(eq(review.id, params.id));
			await db.insert(eventLog).values({
				id: makeId("evt"),
				userId: user.id,
				kind: "review.liked",
				payload: { reviewId: params.id },
			});

			const [reviewRow] = await db
				.select({
					userId: review.userId,
					movieId: review.movieId,
					title: review.title,
				})
				.from(review)
				.where(eq(review.id, params.id))
				.limit(1);
			if (
				reviewRow &&
				reviewRow.userId !== user.id &&
				reviewRow.movieId != null
			) {
				const isMutual = await areUsersMutualFollows(user.id, reviewRow.userId);
				const [likerProfile] = await db
					.select({ displayName: profile.displayName })
					.from(profile)
					.where(eq(profile.userId, user.id))
					.limit(1);
				const from =
					likerProfile?.displayName?.trim() || user.name?.trim() || "Someone";
				await deliverNotification({
					userId: reviewRow.userId,
					kind: "review.liked",
					title: `${from} liked your review`,
					payload: {
						fromUserId: user.id,
						reviewId: params.id,
						movieId: reviewRow.movieId,
						href: movieReviewNotificationHref(reviewRow.movieId, params.id),
					},
					context: { actorUserId: user.id, isMutual },
				});
			}

			return readReviewReactionSnapshot(params.id, user.id);
		},
		{ params: t.Object({ id: t.String() }) },
	)
	.post(
		"/:id/dislike",
		async ({ params, user, status }) => {
			if (!user) return status(401, "Sign in");
			if (
				!hit(`review-dislike:${user.id}`, { limit: 120, windowMs: 60_000 }).ok
			)
				return status(429, "Slow down");

			const [existing] = await db
				.select()
				.from(reaction)
				.where(
					and(
						eq(reaction.userId, user.id),
						eq(reaction.parentType, "review"),
						eq(reaction.parentId, params.id),
						eq(reaction.kind, "dislike"),
					),
				)
				.limit(1);
			if (existing) {
				await removeViewerReviewReaction(user.id, params.id, "dislike");
				return readReviewReactionSnapshot(params.id, user.id);
			}

			await removeViewerReviewReaction(user.id, params.id, "like");

			await db.insert(reaction).values({
				userId: user.id,
				parentType: "review",
				parentId: params.id,
				kind: "dislike",
			});
			await db
				.update(review)
				.set({ dislikesCount: sql`${review.dislikesCount} + 1` })
				.where(eq(review.id, params.id));

			return readReviewReactionSnapshot(params.id, user.id);
		},
		{ params: t.Object({ id: t.String() }) },
	);
