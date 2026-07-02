import { beforeEach, describe, expect, mock, test } from "bun:test";
import { Elysia } from "elysia";

const createPatronFeedback = mock(async () => ({ feedbackId: "fb_1" }));
const listPatronFeedbackForUser = mock(async () => [
	{
		id: "fb_1",
		category: "bug" as const,
		body: "The slider is broken on mobile",
		pageUrl: "/movies/550",
		status: "open" as const,
		lastStaffReplyAt: null,
		patronLastReadAt: null,
		createdAt: new Date("2026-07-01T12:00:00Z"),
		updatedAt: new Date("2026-07-01T12:00:00Z"),
	},
]);
const getPatronFeedbackForUser = mock(async () => ({
	id: "fb_1",
	category: "bug" as const,
	body: "The slider is broken on mobile",
	pageUrl: "/movies/550",
	status: "open" as const,
	lastStaffReplyAt: null,
	patronLastReadAt: null,
	createdAt: new Date("2026-07-01T12:00:00Z"),
	updatedAt: new Date("2026-07-01T12:00:00Z"),
	replies: [],
}));
const markPatronFeedbackRead = mock(async () => true);
const hit = mock(() => ({
	ok: true,
	remaining: 9,
	resetAt: Date.now() + 86_400_000,
}));

mock.module("../lib/patron-feedback", () => ({
	createPatronFeedback,
	listPatronFeedbackForUser,
	getPatronFeedbackForUser,
	markPatronFeedbackRead,
	parsePatronFeedbackInput: (body: {
		category: "bug";
		body: string;
		pageUrl?: string | null;
	}) => ({
		category: body.category,
		body: body.body.trim(),
		pageUrl: body.pageUrl ?? null,
	}),
	PATRON_FEEDBACK_RATE_LIMIT: 10,
	PATRON_FEEDBACK_RATE_WINDOW_MS: 86_400_000,
}));

mock.module("../lib/rate-limit", () => ({ hit }));

mock.module("@still/auth", () => ({
	auth: {
		api: {
			getSession: async ({ headers }: { headers: Headers }) => {
				const id = headers.get("x-user-id");
				const role = headers.get("x-user-role") ?? "user";
				return id ? { session: { id: `s-${id}` }, user: { id, role } } : null;
			},
		},
		handler: () => new Response("ok"),
	},
}));

const { feedbackRoute } = await import("./feedback");

function call(
	path: string,
	init?: {
		method?: string;
		userId?: string;
		body?: unknown;
	},
) {
	const headers: Record<string, string> = {};
	if (init?.userId) headers["x-user-id"] = init.userId;
	if (init?.body != null) headers["Content-Type"] = "application/json";
	return new Elysia().use(feedbackRoute).handle(
		new Request(`http://localhost${path}`, {
			method: init?.method ?? "GET",
			headers,
			body: init?.body != null ? JSON.stringify(init.body) : undefined,
		}),
	);
}

describe("feedbackRoute", () => {
	beforeEach(() => {
		createPatronFeedback.mockClear();
		listPatronFeedbackForUser.mockClear();
		getPatronFeedbackForUser.mockClear();
		markPatronFeedbackRead.mockClear();
		hit.mockClear();
		hit.mockImplementation(() => ({
			ok: true,
			remaining: 9,
			resetAt: Date.now() + 86_400_000,
		}));
	});

	test("POST /api/feedback requires sign-in", async () => {
		const res = await call("/api/feedback", {
			method: "POST",
			body: {
				category: "bug",
				body: "Ten chars!!",
			},
		});
		expect(res.status).toBe(401);
	});

	test("POST /api/feedback returns 429 when rate limited", async () => {
		hit.mockImplementation(() => ({
			ok: false,
			remaining: 0,
			resetAt: Date.now() + 86_400_000,
		}));
		const res = await call("/api/feedback", {
			method: "POST",
			userId: "user_1",
			body: {
				category: "bug",
				body: "Ten chars!!",
			},
		});
		expect(res.status).toBe(429);
		expect(createPatronFeedback).not.toHaveBeenCalled();
	});

	test("POST /api/feedback creates ticket", async () => {
		const res = await call("/api/feedback", {
			method: "POST",
			userId: "user_1",
			body: {
				category: "idea",
				body: "Please add dark mode scheduling",
				pageUrl: "/home",
			},
		});
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({
			feedbackId: "fb_1",
			status: "open",
		});
		expect(createPatronFeedback).toHaveBeenCalledWith({
			userId: "user_1",
			input: {
				category: "idea",
				body: "Please add dark mode scheduling",
				pageUrl: "/home",
			},
		});
	});

	test("GET /api/feedback lists caller tickets", async () => {
		const res = await call("/api/feedback", { userId: "user_1" });
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.items).toHaveLength(1);
		expect(listPatronFeedbackForUser).toHaveBeenCalledWith("user_1");
	});

	test("GET /api/feedback/:id returns detail for owner", async () => {
		const res = await call("/api/feedback/fb_1", { userId: "user_1" });
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.id).toBe("fb_1");
		expect(getPatronFeedbackForUser).toHaveBeenCalledWith({
			userId: "user_1",
			feedbackId: "fb_1",
		});
	});

	test("GET /api/feedback/:id returns 404 when not owner", async () => {
		getPatronFeedbackForUser.mockResolvedValueOnce(null);
		const res = await call("/api/feedback/fb_2", { userId: "user_1" });
		expect(res.status).toBe(404);
	});

	test("PATCH /api/feedback/:id/read marks thread read", async () => {
		const res = await call("/api/feedback/fb_1/read", {
			method: "PATCH",
			userId: "user_1",
		});
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ ok: true });
		expect(markPatronFeedbackRead).toHaveBeenCalledWith({
			userId: "user_1",
			feedbackId: "fb_1",
		});
	});
});
