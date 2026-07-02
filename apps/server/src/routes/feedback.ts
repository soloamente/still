import { Elysia, t } from "elysia";

import { context } from "../context";
import {
	createPatronFeedback,
	getPatronFeedbackForUser,
	listPatronFeedbackForUser,
	markPatronFeedbackRead,
	PATRON_FEEDBACK_RATE_LIMIT,
	PATRON_FEEDBACK_RATE_WINDOW_MS,
	parsePatronFeedbackInput,
} from "../lib/patron-feedback";
import { hit } from "../lib/rate-limit";

const feedbackSubmitBody = t.Object({
	category: t.Union([t.Literal("bug"), t.Literal("idea"), t.Literal("other")]),
	body: t.String({ minLength: 1, maxLength: 2000 }),
	pageUrl: t.Optional(t.Union([t.String({ maxLength: 500 }), t.Null()])),
});

export const feedbackRoute = new Elysia({
	prefix: "/api/feedback",
	tags: ["feedback"],
})
	.use(context)
	.post(
		"/",
		async ({ user, body, status }) => {
			if (!user) return status(401, "Sign in");
			if (
				!hit(`feedback:${user.id}`, {
					limit: PATRON_FEEDBACK_RATE_LIMIT,
					windowMs: PATRON_FEEDBACK_RATE_WINDOW_MS,
				}).ok
			) {
				return status(429, "Feedback limit reached — try again tomorrow");
			}
			try {
				parsePatronFeedbackInput(body);
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				return status(400, message);
			}
			const result = await createPatronFeedback({
				userId: user.id,
				input: body,
			});
			return { feedbackId: result.feedbackId, status: "open" as const };
		},
		{ body: feedbackSubmitBody },
	)
	.get("/", async ({ user, status }) => {
		if (!user) return status(401, "Sign in");
		const items = await listPatronFeedbackForUser(user.id);
		return { items };
	})
	.patch("/:id/read", async ({ user, params, status }) => {
		if (!user) return status(401, "Sign in");
		const ok = await markPatronFeedbackRead({
			userId: user.id,
			feedbackId: params.id,
		});
		if (!ok) return status(404, "Not found");
		return { ok: true };
	})
	.get("/:id", async ({ user, params, status }) => {
		if (!user) return status(401, "Sign in");
		const row = await getPatronFeedbackForUser({
			userId: user.id,
			feedbackId: params.id,
		});
		if (!row) return status(404, "Not found");
		return row;
	});
