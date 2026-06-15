import { beforeEach, describe, expect, mock, test } from "bun:test";
import { Elysia } from "elysia";

const toggleListingQuoteUpvote = mock(async () => ({
	upvoted: true,
	upvoteCount: 4,
}));
const saveListingQuote = mock(async () => ({
	saveId: "qsave_1",
	visibility: "private" as const,
	created: true,
}));
const patchListingQuoteSaveVisibility = mock(async () => ({
	saveId: "qsave_1",
	visibility: "public" as const,
}));
const deleteListingQuoteSave = mock(async () => ({ quoteId: "quote_1" }));
const fetchListingQuoteById = mock(async () => ({
	id: "quote_1",
	body: "Hello",
	speaker: null,
	timestampMs: null,
	timestampLabel: null,
	upvoteCount: 4,
	seasonNumber: null,
	episodeNumber: null,
}));
const createQuoteSubmission = mock(async () => ({
	submissionId: "qsub_1",
}));
const listQuoteSubmissions = mock(async () => [
	{
		id: "qsub_1",
		status: "pending" as const,
		body: "Hello",
		speaker: null,
		timestampMs: null,
		timestampLabel: null,
		movieId: 550,
		tvId: null,
		seasonNumber: null,
		episodeNumber: null,
		listingTitle: "Fight Club",
		submitter: {
			userId: "user_1",
			handle: "patron",
			displayName: "Patron",
		},
		createdAt: new Date(),
		staffNote: null,
		resolvedQuoteId: null,
	},
]);
const approveQuoteSubmission = mock(async () => ({
	quoteId: "lquote_1",
	submission: {
		id: "qsub_1",
		status: "approved" as const,
		resolvedQuoteId: "lquote_1",
	},
}));
const rejectQuoteSubmission = mock(async () => ({
	submission: {
		id: "qsub_2",
		status: "rejected" as const,
		staffNote: "Already in catalog",
	},
}));
const createStaffListingQuote = mock(async () => ({
	quoteId: "lquote_staff_1",
}));

mock.module("../lib/listing-quotes-query", () => ({
	toggleListingQuoteUpvote,
	saveListingQuote,
	patchListingQuoteSaveVisibility,
	deleteListingQuoteSave,
	fetchListingQuoteById,
	parseTvQuoteEpisodeParams: () => null,
	fetchListingQuotesForMovie: async () => ({
		items: [],
		page: 1,
		limit: 20,
		hasMore: false,
	}),
	fetchListingQuotesForTv: async () => ({
		items: [],
		page: 1,
		limit: 20,
		hasMore: false,
	}),
}));

mock.module("../lib/quote-submission", () => ({
	createQuoteSubmission,
	listQuoteSubmissions,
	approveQuoteSubmission,
	rejectQuoteSubmission,
	parseQuoteSubmissionInput: (body: { body: string; movieId?: number }) => ({
		body: body.body.trim(),
		speaker: null,
		timestampMs: null,
		scope: {
			movieId: body.movieId ?? 550,
			tvId: null,
			seasonNumber: null,
			episodeNumber: null,
		},
	}),
	QUOTE_SUBMISSION_RATE_LIMIT: 5,
	QUOTE_SUBMISSION_RATE_WINDOW_MS: 86_400_000,
}));

mock.module("../lib/staff-listing-quote", () => ({
	createStaffListingQuote,
}));

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

const { quotesRoute } = await import("./quotes");

function call(
	path: string,
	init?: {
		method?: string;
		userId?: string;
		userRole?: string;
		body?: unknown;
	},
) {
	const headers: Record<string, string> = {};
	if (init?.userId) headers["x-user-id"] = init.userId;
	if (init?.userRole) headers["x-user-role"] = init.userRole;
	if (init?.body != null) headers["Content-Type"] = "application/json";
	return new Elysia().use(quotesRoute).handle(
		new Request(`http://localhost${path}`, {
			method: init?.method ?? "GET",
			headers,
			body: init?.body != null ? JSON.stringify(init.body) : undefined,
		}),
	);
}

describe("quotesRoute auth", () => {
	beforeEach(() => {
		toggleListingQuoteUpvote.mockClear();
		saveListingQuote.mockClear();
		patchListingQuoteSaveVisibility.mockClear();
		deleteListingQuoteSave.mockClear();
		fetchListingQuoteById.mockClear();
	});

	test("POST /api/quotes/:id/upvote returns 401 when signed out", async () => {
		const res = await call("/api/quotes/quote_1/upvote", { method: "POST" });
		expect(res.status).toBe(401);
	});

	test("POST /api/quotes/:id/save returns 401 when signed out", async () => {
		const res = await call("/api/quotes/quote_1/save", {
			method: "POST",
			body: {},
		});
		expect(res.status).toBe(401);
	});
});

describe("quotesRoute engagement", () => {
	beforeEach(() => {
		toggleListingQuoteUpvote.mockClear();
		saveListingQuote.mockClear();
		patchListingQuoteSaveVisibility.mockClear();
		deleteListingQuoteSave.mockClear();
		fetchListingQuoteById.mockClear();
	});

	test("POST /api/quotes/:id/upvote toggles for signed-in patron", async () => {
		const res = await call("/api/quotes/quote_1/upvote", {
			method: "POST",
			userId: "user_1",
		});
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ upvoted: true, upvoteCount: 4 });
		expect(toggleListingQuoteUpvote).toHaveBeenCalledWith("user_1", "quote_1");
	});

	test("POST /api/quotes/:id/save creates bookmark", async () => {
		const res = await call("/api/quotes/quote_1/save", {
			method: "POST",
			userId: "user_1",
			body: { visibility: "private" },
		});
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({
			saveId: "qsave_1",
			visibility: "private",
			saved: true,
			created: true,
		});
	});

	test("PATCH /api/quotes/saves/:id updates visibility", async () => {
		const res = await call("/api/quotes/saves/qsave_1", {
			method: "PATCH",
			userId: "user_1",
			body: { visibility: "public" },
		});
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({
			saveId: "qsave_1",
			visibility: "public",
		});
	});

	test("DELETE /api/quotes/saves/:id removes bookmark", async () => {
		const res = await call("/api/quotes/saves/qsave_1", {
			method: "DELETE",
			userId: "user_1",
		});
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ ok: true });
	});

	test("GET /api/quotes/:id returns quote detail", async () => {
		const res = await call("/api/quotes/quote_1", { userId: "user_1" });
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.id).toBe("quote_1");
		expect(body.body).toBe("Hello");
	});
});

describe("quotesRoute submit + staff", () => {
	beforeEach(() => {
		createQuoteSubmission.mockClear();
		listQuoteSubmissions.mockClear();
		approveQuoteSubmission.mockClear();
		rejectQuoteSubmission.mockClear();
		createStaffListingQuote.mockClear();
	});

	test("POST /api/quotes/submit creates pending submission", async () => {
		const res = await call("/api/quotes/submit", {
			method: "POST",
			userId: "user_1",
			body: { body: "Hello", movieId: 550 },
		});
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({
			submissionId: "qsub_1",
			status: "pending",
		});
	});

	test("GET /api/quotes/submissions requires staff", async () => {
		const res = await call("/api/quotes/submissions", { userId: "user_1" });
		expect(res.status).toBe(403);
	});

	test("GET /api/quotes/submissions lists queue for staff", async () => {
		const res = await call("/api/quotes/submissions", {
			userId: "staff_1",
			userRole: "admin",
		});
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.items).toHaveLength(1);
	});

	test("POST approve returns quote id", async () => {
		const res = await call("/api/quotes/submissions/qsub_1/approve", {
			method: "POST",
			userId: "staff_1",
			userRole: "admin",
		});
		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({ quoteId: "lquote_1" });
	});

	test("POST reject returns submission with staff note", async () => {
		const res = await call("/api/quotes/submissions/qsub_2/reject", {
			method: "POST",
			userId: "staff_1",
			userRole: "admin",
			body: { staffNote: "Already in catalog" },
		});
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.submission.staffNote).toBe("Already in catalog");
	});

	test("POST /api/quotes/staff requires staff", async () => {
		const res = await call("/api/quotes/staff", {
			method: "POST",
			userId: "user_1",
			body: { body: "Staff line", movieId: 550 },
		});
		expect(res.status).toBe(403);
	});

	test("POST /api/quotes/staff publishes catalog row", async () => {
		const res = await call("/api/quotes/staff", {
			method: "POST",
			userId: "staff_1",
			userRole: "admin",
			body: { body: "Staff line", movieId: 550 },
		});
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({
			quoteId: "lquote_staff_1",
			source: "staff",
		});
		expect(createStaffListingQuote).toHaveBeenCalled();
	});
});
