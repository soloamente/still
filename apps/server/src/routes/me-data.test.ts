import { beforeEach, describe, expect, mock, test } from "bun:test";
import { unzipSync } from "fflate";

const state = {
	clearCalls: [] as string[],
	exportCalls: [] as string[],
};

mock.module("../lib/me-export-data", () => ({
	fetchExportInput: async (userId: string) => {
		state.exportCalls.push(userId);
		return {
			profile: { handle: "adgv" },
			favoriteFilms: [],
			filmLogs: [],
			tvLogs: [],
			filmWatchlist: [],
			tvWatchlist: [],
			tvProgress: [],
			reviews: [],
			lists: [],
			comments: [],
			likedReviews: [],
			likedLists: [],
		};
	},
	assembleExportFiles: () => [
		{ path: "diary.csv", contents: "Date,Name\n" },
		{ path: "likes/films.csv", contents: "Date,Name\n" },
	],
}));

mock.module("../lib/clear-user-library", () => ({
	clearUserLibrary: async (userId: string) => {
		state.clearCalls.push(userId);
		return {
			logs: 3,
			watchlist: 2,
			tvProgress: 1,
			favorites: 1,
			badges: 4,
			achievements: 2,
			challenges: 1,
		};
	},
}));

import { buildMeDataRoute } from "./me-data";

/** Isolated limiter — lists/posts/staff tests mock the shared `rate-limit` module. */
function makeTestRateLimitHit() {
	const buckets = new Map<string, { count: number; resetAt: number }>();
	return (key: string, opts: { limit: number; windowMs: number }) => {
		const now = Date.now();
		const bucket = buckets.get(key);
		if (!bucket || bucket.resetAt <= now) {
			const fresh = { count: 1, resetAt: now + opts.windowMs };
			buckets.set(key, fresh);
			return {
				ok: true,
				remaining: opts.limit - 1,
				resetAt: fresh.resetAt,
			};
		}
		bucket.count += 1;
		const ok = bucket.count <= opts.limit;
		return {
			ok,
			remaining: Math.max(0, opts.limit - bucket.count),
			resetAt: bucket.resetAt,
		};
	};
}

function makeApp(user: { id: string } | null) {
	return buildMeDataRoute({
		deriveUser: () => user,
		exportRateLimit: { limit: 3, windowMs: 60 * 60_000 },
		rateLimitHit: makeTestRateLimitHit(),
	});
}

beforeEach(() => {
	state.clearCalls = [];
	state.exportCalls = [];
});

describe("GET /api/me/export", () => {
	test("401 when signed out", async () => {
		const res = await makeApp(null).handle(
			new Request("http://test/api/me/export"),
		);
		expect(res.status).toBe(401);
	});

	test("returns a zip with content-disposition and the assembled files", async () => {
		const res = await makeApp({ id: "user_1" }).handle(
			new Request("http://test/api/me/export"),
		);
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toBe("application/zip");
		expect(res.headers.get("content-disposition")).toContain(
			'filename="sense-export-adgv-',
		);
		const bytes = new Uint8Array(await res.arrayBuffer());
		const unzipped = unzipSync(bytes);
		expect(Object.keys(unzipped).sort()).toEqual([
			"diary.csv",
			"likes/films.csv",
		]);
		expect(state.exportCalls).toEqual(["user_1"]);
	});

	test("429 after the rate limit", async () => {
		const app = buildMeDataRoute({
			deriveUser: () => ({ id: "user_rate" }),
			exportRateLimit: { limit: 1, windowMs: 60 * 60_000 },
			rateLimitHit: makeTestRateLimitHit(),
		});
		const first = await app.handle(new Request("http://test/api/me/export"));
		expect(first.status).toBe(200);
		const second = await app.handle(new Request("http://test/api/me/export"));
		expect(second.status).toBe(429);
	});
});

describe("DELETE /api/me/library", () => {
	test("401 when signed out", async () => {
		const res = await makeApp(null).handle(
			new Request("http://test/api/me/library", { method: "DELETE" }),
		);
		expect(res.status).toBe(401);
	});

	test("clears and returns per-category counts", async () => {
		const res = await makeApp({ id: "user_2" }).handle(
			new Request("http://test/api/me/library", { method: "DELETE" }),
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			ok: boolean;
			counts: Record<string, number>;
		};
		expect(body.ok).toBe(true);
		expect(body.counts.logs).toBe(3);
		expect(state.clearCalls).toEqual(["user_2"]);
	});
});
