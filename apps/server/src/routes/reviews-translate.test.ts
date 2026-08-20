import { beforeEach, describe, expect, mock, test } from "bun:test";
import { Elysia } from "elysia";

/**
 * Guard-rail coverage for `POST /api/reviews/:id/translate`. The lookup chain
 * itself (same-language, stored row, provider, persist) is unit tested in
 * `review-translation-service.test.ts` — these tests only prove the route
 * refuses work it should never start, before any database or model call.
 */

let configured = true;

mock.module("../lib/review-translation-provider", () => ({
	isReviewTranslationConfigured: () => configured,
	createReviewTranslationProvider: () => ({
		translate: async () => {
			throw new Error("provider must not be reached in these tests");
		},
	}),
}));

mock.module("../lib/rate-limit", () => ({
	hit: () => ({ ok: true }),
}));

mock.module("@still/auth", () => ({
	auth: {
		api: {
			getSession: async ({ headers }: { headers: Headers }) => {
				const id = headers.get("x-user-id");
				if (!id) return null;
				return {
					session: { id: `session-${id}` },
					user: { id, name: "Patron", emailVerified: true },
				};
			},
		},
		handler: () => new Response("ok"),
	},
}));

const { reviewsRoute } = await import("./reviews");

function translate(language: unknown, userId?: string) {
	const headers: Record<string, string> = {
		"content-type": "application/json",
	};
	if (userId) headers["x-user-id"] = userId;
	return new Elysia().use(reviewsRoute).handle(
		new Request("http://localhost/api/reviews/rev_abc/translate", {
			method: "POST",
			headers,
			body: JSON.stringify({ language }),
		}),
	);
}

describe("POST /api/reviews/:id/translate", () => {
	beforeEach(() => {
		configured = true;
	});

	test("requires a session — translation is metered, not anonymous", async () => {
		const response = await translate("en");
		expect(response.status).toBe(401);
	});

	test("reports 503 when no translation engine is configured", async () => {
		configured = false;
		const response = await translate("en", "usr_reader");
		expect(response.status).toBe(503);
	});

	test("rejects a junk language before spending anything", async () => {
		const response = await translate("english", "usr_reader");
		expect(response.status).toBe(400);
	});

	test("rejects a path-traversal-shaped language", async () => {
		const response = await translate("../../etc", "usr_reader");
		expect(response.status).toBe(400);
	});

	test("rejects a missing language via the route schema", async () => {
		const response = await new Elysia().use(reviewsRoute).handle(
			new Request("http://localhost/api/reviews/rev_abc/translate", {
				method: "POST",
				headers: {
					"content-type": "application/json",
					"x-user-id": "usr_reader",
				},
				body: JSON.stringify({}),
			}),
		);
		expect(response.status).toBeGreaterThanOrEqual(400);
	});
});
