import { Elysia, t } from "elysia";

import { context, requireStaff } from "../context";
import { visibilitySchema } from "../lib/content-visibility";
import {
	deleteListingQuoteSave,
	fetchListingQuoteById,
	patchListingQuoteSaveVisibility,
	saveListingQuote,
	toggleListingQuoteUpvote,
} from "../lib/listing-quotes-query";
import { importMovieQuotesNow } from "../lib/quote-import";
import {
	isQuoteImportEnabled,
	resolveQuoteProvider,
} from "../lib/quote-provider";
import {
	approveQuoteSubmission,
	createQuoteSubmission,
	listQuoteSubmissions,
	parseQuoteSubmissionInput,
	QUOTE_SUBMISSION_RATE_LIMIT,
	QUOTE_SUBMISSION_RATE_WINDOW_MS,
	rejectQuoteSubmission,
} from "../lib/quote-submission";
import { hit } from "../lib/rate-limit";
import { recordProductEvent } from "../lib/record-product-event";
import { createStaffListingQuote } from "../lib/staff-listing-quote";

const quoteSubmitBody = t.Object({
	body: t.String({ minLength: 1, maxLength: 500 }),
	speaker: t.Optional(t.Union([t.String({ maxLength: 120 }), t.Null()])),
	timestamp: t.Optional(t.Union([t.String({ maxLength: 32 }), t.Null()])),
	movieId: t.Optional(t.Union([t.Number(), t.Null()])),
	tvId: t.Optional(t.Union([t.Number(), t.Null()])),
	seasonNumber: t.Optional(t.Union([t.Number(), t.Null()])),
	episodeNumber: t.Optional(t.Union([t.Number(), t.Null()])),
});

export const quotesRoute = new Elysia({
	prefix: "/api/quotes",
	tags: ["quotes"],
})
	.use(context)
	.post(
		"/submit",
		async ({ user, body, status }) => {
			if (!user) return status(401, "Sign in");
			if (
				!hit(`quote-submit:${user.id}`, {
					limit: QUOTE_SUBMISSION_RATE_LIMIT,
					windowMs: QUOTE_SUBMISSION_RATE_WINDOW_MS,
				}).ok
			) {
				return status(
					429,
					"Quote submission limit reached — try again tomorrow",
				);
			}
			try {
				parseQuoteSubmissionInput(body);
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				return status(400, message);
			}
			const result = await createQuoteSubmission({
				userId: user.id,
				input: body,
			});
			void recordProductEvent(user.id, "quote.submit", {
				submissionId: result.submissionId,
				movieId: body.movieId ?? null,
				tvId: body.tvId ?? null,
			});
			return { submissionId: result.submissionId, status: "pending" as const };
		},
		{ body: quoteSubmitBody },
	)
	.post(
		"/staff",
		async (ctx) => {
			try {
				requireStaff(ctx);
			} catch {
				return ctx.status(403, "Not allowed");
			}
			try {
				parseQuoteSubmissionInput(ctx.body);
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				return ctx.status(400, message);
			}
			const result = await createStaffListingQuote({ input: ctx.body });
			if ("error" in result) {
				return ctx.status(
					400,
					"Title is not cached — open the film or show detail once, then retry",
				);
			}
			return { quoteId: result.quoteId, source: "staff" as const };
		},
		{ body: quoteSubmitBody },
	)
	.post(
		"/import",
		async (ctx) => {
			try {
				requireStaff(ctx);
			} catch {
				return ctx.status(403, "Not allowed");
			}
			if (!isQuoteImportEnabled() || !resolveQuoteProvider()) {
				return ctx.status(
					503,
					"Quote import is not configured — set QUOTE_API_PROVIDER=moviefamous (free) or moviequotes + MOVIQUOTES_API_KEY, and QUOTE_IMPORT_ENABLED=true",
				);
			}
			const movieId = ctx.body.movieId;
			if (!Number.isFinite(movieId) || movieId < 1) {
				return ctx.status(400, "Invalid movie id");
			}
			try {
				const result = await importMovieQuotesNow(movieId);
				return result;
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				return ctx.status(502, message);
			}
		},
		{
			body: t.Object({
				movieId: t.Number(),
			}),
		},
	)
	.get(
		"/submissions",
		async (ctx) => {
			try {
				requireStaff(ctx);
			} catch {
				return ctx.status(403, "Not allowed");
			}
			const statusFilter =
				ctx.query.status === "approved" ||
				ctx.query.status === "rejected" ||
				ctx.query.status === "pending"
					? ctx.query.status
					: "pending";
			const items = await listQuoteSubmissions({ status: statusFilter });
			return { items };
		},
		{
			query: t.Object({
				status: t.Optional(t.String()),
			}),
		},
	)
	.post(
		"/submissions/:id/approve",
		async (ctx) => {
			try {
				requireStaff(ctx);
			} catch {
				return ctx.status(403, "Not allowed");
			}
			const result = await approveQuoteSubmission({
				submissionId: ctx.params.id,
				reviewerUserId: ctx.user.id,
			});
			if ("error" in result) {
				if (result.error === "not_found") {
					return ctx.status(404, "Submission not found");
				}
				if (result.error === "not_pending") {
					return ctx.status(409, "Submission is no longer pending");
				}
				return ctx.status(
					400,
					"Title is not cached — open the film or show detail once, then retry",
				);
			}
			return {
				quoteId: result.quoteId,
				submission: result.submission,
			};
		},
		{ params: t.Object({ id: t.String() }) },
	)
	.post(
		"/submissions/:id/reject",
		async (ctx) => {
			try {
				requireStaff(ctx);
			} catch {
				return ctx.status(403, "Not allowed");
			}
			const result = await rejectQuoteSubmission({
				submissionId: ctx.params.id,
				reviewerUserId: ctx.user.id,
				staffNote: ctx.body.staffNote,
			});
			if ("error" in result) {
				if (result.error === "not_found") {
					return ctx.status(404, "Submission not found");
				}
				return ctx.status(409, "Submission is no longer pending");
			}
			return { submission: result.submission };
		},
		{
			params: t.Object({ id: t.String() }),
			body: t.Object({
				staffNote: t.Optional(
					t.Union([t.String({ maxLength: 400 }), t.Null()]),
				),
			}),
		},
	)
	.patch(
		"/saves/:id",
		async ({ params, user, body, status }) => {
			if (!user) return status(401, "Sign in");
			const result = await patchListingQuoteSaveVisibility({
				userId: user.id,
				saveId: params.id,
				visibility: body.visibility,
			});
			if (!result) return status(404, "Save not found");
			return result;
		},
		{
			params: t.Object({ id: t.String() }),
			body: t.Object({ visibility: visibilitySchema }),
		},
	)
	.delete(
		"/saves/:id",
		async ({ params, user, status }) => {
			if (!user) return status(401, "Sign in");
			const removed = await deleteListingQuoteSave({
				userId: user.id,
				saveId: params.id,
			});
			if (!removed) return status(404, "Save not found");
			void recordProductEvent(user.id, "quote.unsave", {
				saveId: params.id,
				quoteId: removed.quoteId,
			});
			return { ok: true };
		},
		{ params: t.Object({ id: t.String() }) },
	)
	.get(
		"/:id",
		async ({ params, user, status }) => {
			const item = await fetchListingQuoteById(params.id, user?.id ?? null);
			if (!item) return status(404, "Quote not found");
			return item;
		},
		{ params: t.Object({ id: t.String() }) },
	)
	.post(
		"/:id/upvote",
		async ({ params, user, status }) => {
			if (!user) return status(401, "Sign in");
			const result = await toggleListingQuoteUpvote(user.id, params.id);
			if (!result) return status(404, "Quote not found");
			void recordProductEvent(user.id, "quote.upvote", {
				quoteId: params.id,
				upvoted: result.upvoted,
			});
			return result;
		},
		{ params: t.Object({ id: t.String() }) },
	)
	.post(
		"/:id/save",
		async ({ params, user, body, status }) => {
			if (!user) return status(401, "Sign in");
			const result = await saveListingQuote({
				userId: user.id,
				quoteId: params.id,
				visibility: body.visibility,
			});
			if (!result) return status(404, "Quote not found");
			if (result.created) {
				void recordProductEvent(user.id, "quote.save", {
					quoteId: params.id,
					saveId: result.saveId,
					visibility: result.visibility,
				});
			}
			return {
				saveId: result.saveId,
				visibility: result.visibility,
				saved: true,
				created: result.created,
			};
		},
		{
			params: t.Object({ id: t.String() }),
			body: t.Object({
				visibility: t.Optional(visibilitySchema),
			}),
		},
	);
