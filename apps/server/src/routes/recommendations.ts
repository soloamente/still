import { db, profile, titleRecommendation, watchlistItem } from "@still/db";
import { and, eq, isNull } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { context } from "../context";
import { makeId } from "../lib/cuid";
import { deliverNotification } from "../lib/notification-delivery";
import { hit } from "../lib/rate-limit";
import { recordProductEvent } from "../lib/record-product-event";
import {
	buildRecommendationNotification,
	normalizeRecommendationNote,
	parseRecommendationReasonCode,
	type RecommendationMediaKind,
} from "../lib/title-recommendation";
import {
	fetchRecommendationSuggestions,
	hasRecommendedTitle,
	loadRecommendableTitle,
	loadRecommendationGate,
} from "../lib/title-recommendation-query";
import {
	upsertMovieWatchlistItem,
	upsertTvWatchlistItem,
} from "../lib/watchlist-upsert";

/** Default priority for titles added from an accepted recommendation (matches watchlist POST). */
const ACCEPT_WATCHLIST_PRIORITY = 50;

/** Recipient-owned row or null — open/accept are recipient-only actions. */
async function loadOwnRecommendation(id: string, recipientId: string) {
	const [row] = await db
		.select({
			id: titleRecommendation.id,
			movieId: titleRecommendation.movieId,
			tvId: titleRecommendation.tvId,
			openedAt: titleRecommendation.openedAt,
			acceptedAt: titleRecommendation.acceptedAt,
		})
		.from(titleRecommendation)
		.where(
			and(
				eq(titleRecommendation.id, id),
				eq(titleRecommendation.recipientUserId, recipientId),
			),
		)
		.limit(1);
	return row ?? null;
}

/**
 * Patron-to-patron film/TV recommendations (Today **Recommend back**).
 * Suggest → send (+ inbox `recommendation.received`) → open → accept (watchlist).
 */
export const recommendationsRoute = new Elysia({
	prefix: "/api/recommendations",
	tags: ["recommendations"],
})
	.use(context)
	.get(
		"/suggest",
		async ({ query, user, status }) => {
			if (!user) return status(401, "Unauthorized");
			const gate = await loadRecommendationGate(user.id, query.recipientUserId);
			if (!gate.ok) return status(403, { code: gate.reason });
			const suggestions = await fetchRecommendationSuggestions(
				user.id,
				query.recipientUserId,
			);
			return {
				suggestions: suggestions.map((s) => ({
					mediaKind: s.mediaKind,
					tmdbId: s.tmdbId,
					title: s.title,
					posterPath: s.posterPath,
					ratingTenths: s.ratingTenths,
					liked: s.liked,
					sensitive: s.sensitive,
					alreadyWatchedVisible: s.alreadyWatchedVisible,
				})),
			};
		},
		{
			query: t.Object({ recipientUserId: t.String({ minLength: 1 }) }),
		},
	)
	.post(
		"/",
		async ({ body, user, status }) => {
			if (!user) return status(401, "Unauthorized");
			if (!hit(`rec:send:${user.id}`, { limit: 30, windowMs: 3_600_000 }).ok) {
				return status(429, "Slow down");
			}

			const hasMovie = body.movieId != null;
			const hasTv = body.tvId != null;
			if (hasMovie === hasTv) {
				return status(400, { code: "one_title_required" });
			}
			const mediaKind: RecommendationMediaKind = hasMovie ? "movie" : "tv";
			const tmdbId = (hasMovie ? body.movieId : body.tvId) as number;

			const note = normalizeRecommendationNote(body.note);
			if (!note.ok) return status(400, { code: "note_too_long" });
			const reasonCode = parseRecommendationReasonCode(body.reasonCode);

			const gate = await loadRecommendationGate(user.id, body.recipientUserId);
			if (!gate.ok) {
				switch (gate.reason) {
					case "self":
						return status(400, { code: "self" });
					case "not_connected":
						return status(403, { code: "not_connected" });
					case "unavailable":
						return status(404, { code: "unavailable" });
					default: {
						const unhandled: never = gate.reason;
						throw new Error(`Unhandled recommendation gate: ${unhandled}`);
					}
				}
			}

			// A reply must answer a recommendation this recipient sent to the sender.
			let answerToId: string | null = null;
			if (body.answerToRecommendationId) {
				const [original] = await db
					.select({ id: titleRecommendation.id })
					.from(titleRecommendation)
					.where(
						and(
							eq(titleRecommendation.id, body.answerToRecommendationId),
							eq(titleRecommendation.recipientUserId, user.id),
							eq(titleRecommendation.senderUserId, body.recipientUserId),
						),
					)
					.limit(1);
				if (!original) return status(400, { code: "invalid_answer" });
				answerToId = original.id;
			}

			if (
				await hasRecommendedTitle({
					senderId: user.id,
					recipientId: body.recipientUserId,
					mediaKind,
					tmdbId,
				})
			) {
				return status(409, { code: "already_recommended" });
			}

			const title = await loadRecommendableTitle(mediaKind, tmdbId);
			if (!title) return status(404, { code: "title_not_found" });
			if (title.sensitive && body.confirmSensitive !== true) {
				return status(409, { code: "confirm_sensitive" });
			}

			const id = makeId("rec");
			await db.insert(titleRecommendation).values({
				id,
				senderUserId: user.id,
				recipientUserId: body.recipientUserId,
				movieId: mediaKind === "movie" ? tmdbId : null,
				tvId: mediaKind === "tv" ? tmdbId : null,
				reasonCode,
				note: note.note,
				sensitiveScrub: title.sensitive,
				answerRecommendationId: answerToId,
			});
			void recordProductEvent(user.id, "recommendation.sent", {
				recommendationId: id,
				mediaKind,
				tmdbId,
				hasReason: reasonCode != null,
				hasNote: note.note != null,
				sensitive: title.sensitive,
				isAnswer: answerToId != null,
			});
			if (answerToId) {
				const answered = await db
					.update(titleRecommendation)
					.set({ answeredAt: new Date() })
					.where(
						and(
							eq(titleRecommendation.id, answerToId),
							isNull(titleRecommendation.answeredAt),
						),
					)
					.returning({ id: titleRecommendation.id });
				// Funnel counts the first answer only — later replies are plain sends.
				if (answered.length > 0) {
					void recordProductEvent(user.id, "recommendation.answered", {
						recommendationId: answerToId,
						answerRecommendationId: id,
					});
				}
			}

			const [senderProfile] = await db
				.select({ displayName: profile.displayName, handle: profile.handle })
				.from(profile)
				.where(eq(profile.userId, user.id))
				.limit(1);
			const notification = buildRecommendationNotification({
				recommendationId: id,
				senderUserId: user.id,
				senderName: senderProfile?.displayName ?? user.name ?? "Someone",
				mediaKind,
				tmdbId,
				title: title.title,
				posterPath: title.posterPath,
				reasonCode,
				note: note.note,
				sensitive: title.sensitive,
			});
			await deliverNotification({
				userId: body.recipientUserId,
				kind: "recommendation.received",
				title: notification.title,
				body: notification.body,
				payload: {
					...notification.payload,
					...(senderProfile?.handle
						? { fromHandle: senderProfile.handle }
						: {}),
				},
				context: { actorUserId: user.id },
			});

			return { id };
		},
		{
			body: t.Object({
				recipientUserId: t.String({ minLength: 1 }),
				movieId: t.Optional(t.Integer({ minimum: 1 })),
				tvId: t.Optional(t.Integer({ minimum: 1 })),
				reasonCode: t.Optional(t.String()),
				note: t.Optional(t.String()),
				confirmSensitive: t.Optional(t.Boolean()),
				answerToRecommendationId: t.Optional(t.String()),
			}),
		},
	)
	.post("/:id/open", async ({ params, user, status }) => {
		if (!user) return status(401, "Unauthorized");
		const row = await loadOwnRecommendation(params.id, user.id);
		if (!row) return status(404, "Not found");
		if (!row.openedAt) {
			const opened = await db
				.update(titleRecommendation)
				.set({ openedAt: new Date() })
				.where(
					and(
						eq(titleRecommendation.id, row.id),
						isNull(titleRecommendation.openedAt),
					),
				)
				.returning({ id: titleRecommendation.id });
			if (opened.length > 0) {
				void recordProductEvent(user.id, "recommendation.opened", {
					recommendationId: row.id,
				});
			}
		}
		return { ok: true };
	})
	.post("/:id/accept", async ({ params, user, status }) => {
		if (!user) return status(401, "Unauthorized");
		const row = await loadOwnRecommendation(params.id, user.id);
		if (!row) return status(404, "Not found");

		// Keep an existing watchlist note/priority — only add when missing.
		const [existing] = await db
			.select({ userId: watchlistItem.userId })
			.from(watchlistItem)
			.where(
				and(
					eq(watchlistItem.userId, user.id),
					row.movieId != null
						? eq(watchlistItem.movieId, row.movieId)
						: eq(watchlistItem.tvId, row.tvId as number),
				),
			)
			.limit(1);
		if (!existing) {
			const fields = { note: null, priority: ACCEPT_WATCHLIST_PRIORITY };
			if (row.movieId != null) {
				await upsertMovieWatchlistItem(user.id, row.movieId, fields);
			} else if (row.tvId != null) {
				await upsertTvWatchlistItem(user.id, row.tvId, fields);
			}
		}

		const now = new Date();
		await db
			.update(titleRecommendation)
			.set({
				acceptedAt: row.acceptedAt ?? now,
				openedAt: row.openedAt ?? now,
			})
			.where(eq(titleRecommendation.id, row.id));
		if (!row.acceptedAt) {
			void recordProductEvent(user.id, "recommendation.accepted", {
				recommendationId: row.id,
				alreadyOnWatchlist: existing != null,
			});
		}
		return { ok: true, watchlisted: true };
	});
