import type { PatronFeedbackCategory, PatronFeedbackStatus } from "@still/db";
import { Elysia, t } from "elysia";

import { context, requirePermission } from "../context";
import {
	addStaffFeedbackNote,
	addStaffFeedbackReply,
	getStaffFeedbackDetail,
	listStaffFeedback,
	updatePatronFeedbackStatus,
} from "../lib/patron-feedback";

function forbidden(status: (c: number, m: string) => unknown, e: unknown) {
	const msg = e instanceof Error ? e.message : String(e);
	if (msg === "UNAUTHORIZED") return status(401, "Sign in");
	if (msg === "FORBIDDEN") return status(403, "Not allowed");
	return status(500, msg);
}

const feedbackStatusFilter = t.Optional(
	t.Union([
		t.Literal("open"),
		t.Literal("resolved"),
		t.Literal("dismissed"),
		t.Literal("all"),
	]),
);

const feedbackCategoryFilter = t.Optional(
	t.Union([
		t.Literal("bug"),
		t.Literal("idea"),
		t.Literal("other"),
		t.Literal("all"),
	]),
);

const feedbackMessageBody = t.Object({
	body: t.String({ minLength: 1, maxLength: 2000 }),
});

const feedbackStatusBody = t.Object({
	status: t.Union([
		t.Literal("open"),
		t.Literal("resolved"),
		t.Literal("dismissed"),
	]),
});

export const staffFeedbackRoute = new Elysia({
	prefix: "/api/staff/feedback",
	tags: ["staff"],
})
	.use(context)
	.get(
		"/",
		async ({ user: viewer, query, status }) => {
			try {
				await requirePermission({ user: viewer }, { feedback: ["read"] });
			} catch (e) {
				return forbidden(status, e);
			}
			const items = await listStaffFeedback({
				status: (query.status ?? "all") as PatronFeedbackStatus | "all",
				category: (query.category ?? "all") as PatronFeedbackCategory | "all",
				limit: query.limit,
			});
			return { items };
		},
		{
			query: t.Object({
				status: feedbackStatusFilter,
				category: feedbackCategoryFilter,
				limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
			}),
		},
	)
	.get("/:id", async ({ user: viewer, params, status }) => {
		try {
			await requirePermission({ user: viewer }, { feedback: ["read"] });
		} catch (e) {
			return forbidden(status, e);
		}
		const detail = await getStaffFeedbackDetail(params.id);
		if (!detail) return status(404, "Not found");
		return detail;
	})
	.post(
		"/:id/reply",
		async ({ user: viewer, params, body, status }) => {
			if (!viewer) return status(401, "Sign in");
			try {
				await requirePermission({ user: viewer }, { feedback: ["reply"] });
			} catch (e) {
				return forbidden(status, e);
			}
			const result = await addStaffFeedbackReply({
				feedbackId: params.id,
				authorId: viewer.id,
				body: body.body,
			});
			if ("error" in result) return status(404, "Not found");
			return { replyId: result.replyId };
		},
		{ body: feedbackMessageBody },
	)
	.post(
		"/:id/notes",
		async ({ user: viewer, params, body, status }) => {
			if (!viewer) return status(401, "Sign in");
			try {
				await requirePermission({ user: viewer }, { feedback: ["reply"] });
			} catch (e) {
				return forbidden(status, e);
			}
			const result = await addStaffFeedbackNote({
				feedbackId: params.id,
				authorId: viewer.id,
				body: body.body,
			});
			if ("error" in result) return status(404, "Not found");
			return { noteId: result.noteId };
		},
		{ body: feedbackMessageBody },
	)
	.patch(
		"/:id/status",
		async ({ user: viewer, params, body, status }) => {
			if (!viewer) return status(401, "Sign in");
			try {
				await requirePermission({ user: viewer }, { feedback: ["reply"] });
			} catch (e) {
				return forbidden(status, e);
			}
			const result = await updatePatronFeedbackStatus({
				feedbackId: params.id,
				status: body.status,
				actorId: viewer.id,
			});
			if ("error" in result) {
				if (result.error === "invalid_status")
					return status(400, "Invalid status");
				return status(404, "Not found");
			}
			return { ok: true };
		},
		{ body: feedbackStatusBody },
	);
