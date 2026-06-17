import { beforeEach, describe, expect, mock, test } from "bun:test";
import { Elysia } from "elysia";

const commentTable = { __table: "comment" };
const reviewTable = { __table: "review" };
const eventLogTable = { __table: "eventLog" };

const publishRealtimeEventMock = mock(async () => {});

mock.module("../lib/realtime-publish", () => ({
	publishRealtimeEvent: publishRealtimeEventMock,
}));

mock.module("../lib/notification-delivery", () => ({
	notifyOnReviewComment: mock(async () => {}),
}));

mock.module("../lib/cuid", () => ({
	makeId: (prefix: string) => `${prefix}_test`,
}));

mock.module("../lib/rate-limit", () => ({
	hit: () => ({ ok: true }),
}));

mock.module("../lib/diary-metal-tier", () => ({
	fetchDiaryLogCountsForUserIds: async () => new Map(),
}));

mock.module("../lib/profile-media", () => ({
	serializePatronProfileForClient: (profile: unknown) => profile,
}));

mock.module("../lib/comment-reactions", () => ({
	readCommentReactionSnapshot: async () => ({
		liked: false,
		disliked: false,
		likesCount: 0,
		dislikesCount: 0,
	}),
	removeViewerCommentReaction: async () => false,
}));

function createDbMock() {
	return {
		insert(table: { __table?: string }) {
			return {
				values(values: Record<string, unknown>) {
					return {
						returning() {
							if (table === commentTable) {
								return Promise.resolve([
									{
										id: values.id,
										parentType: values.parentType,
										parentId: values.parentId,
										userId: values.userId,
										body: values.body,
									},
								]);
							}
							return Promise.resolve([]);
						},
					};
				},
			};
		},
		update() {
			return {
				set() {
					return {
						where() {
							return Promise.resolve();
						},
					};
				},
			};
		},
		select() {
			return {
				from() {
					return this;
				},
				where() {
					return this;
				},
				limit() {
					return Promise.resolve([]);
				},
			};
		},
	};
}

mock.module("@still/db", () => ({
	db: createDbMock(),
	comment: commentTable,
	review: reviewTable,
	eventLog: eventLogTable,
	profile: {},
	user: {},
	reaction: {},
}));

mock.module("@still/auth", () => ({
	auth: {
		api: {
			getSession: async ({ headers }: { headers: Headers }) => {
				const id = headers.get("x-user-id");
				if (!id) return null;
				return {
					session: { id: `session-${id}` },
					user: { id, name: "Patron" },
				};
			},
		},
		handler: () => new Response("ok"),
	},
}));

const { commentsRoute } = await import("./comments");

function postComment(body: Record<string, unknown>, userId?: string) {
	const headers: Record<string, string> = {
		"content-type": "application/json",
	};
	if (userId) headers["x-user-id"] = userId;
	return new Elysia().use(commentsRoute).handle(
		new Request("http://localhost/api/comments/", {
			method: "POST",
			headers,
			body: JSON.stringify(body),
		}),
	);
}

describe("POST /api/comments", () => {
	beforeEach(() => {
		publishRealtimeEventMock.mockClear();
	});

	test("broadcasts comment.created to the review room after insert", async () => {
		const response = await postComment(
			{
				parentType: "review",
				parentId: "rev_abc",
				body: "This take aged well.",
			},
			"usr_commenter",
		);

		expect(response.status).toBe(200);
		expect(publishRealtimeEventMock).toHaveBeenCalledTimes(1);
		expect(publishRealtimeEventMock).toHaveBeenCalledWith("review:rev_abc", {
			type: "comment.created",
			commentId: "cmt_test",
			preview: "This take aged well.",
		});
	});

	test("does not broadcast for non-review parent types", async () => {
		const response = await postComment(
			{
				parentType: "list",
				parentId: "lst_abc",
				body: "Nice list.",
			},
			"usr_commenter",
		);

		expect(response.status).toBe(200);
		expect(publishRealtimeEventMock).not.toHaveBeenCalled();
	});
});

function patchComment(
	id: string,
	body: Record<string, unknown>,
	userId?: string,
) {
	const headers: Record<string, string> = {
		"content-type": "application/json",
	};
	if (userId) headers["x-user-id"] = userId;
	return new Elysia().use(commentsRoute).handle(
		new Request(`http://localhost/api/comments/${id}`, {
			method: "PATCH",
			headers,
			body: JSON.stringify(body),
		}),
	);
}

describe("PATCH /api/comments/:id", () => {
	test("requires sign-in", async () => {
		const response = await patchComment("cmt_abc", { body: "Updated take." });
		expect(response.status).toBe(401);
	});
});
