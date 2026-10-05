import { describe, expect, test } from "bun:test";
import { Elysia } from "elysia";
import {
	CompanionNowWatching,
	MemoryCompanionWatchingStore,
} from "../lib/companion-now-watching";
import { MemoryCompanionPairingStore } from "../lib/companion-pairing";
import { buildCompanionRoute } from "./companion";

const USER_ID = "usr_companion";

function makeApp(options?: { rateLimitOk?: boolean }) {
	const watching = new CompanionNowWatching(
		new MemoryCompanionWatchingStore(),
		async () => [{ id: 66732, title: "Stranger Things" }],
		{ now: () => Date.parse("2026-09-30T00:00:00.000Z") },
	);
	const app = buildCompanionRoute({
		deriveUser: () => ({ id: USER_ID }),
		store: new MemoryCompanionPairingStore(),
		watching,
		now: () => Date.parse("2026-09-30T00:00:00.000Z"),
		randomCode: () => "AB12CD34",
		randomToken: () => "device-token-plain",
		randomId: () => "dev_1",
		rateLimitHit: () => ({
			ok: options?.rateLimitOk !== false,
			remaining: 0,
			resetAt: 0,
		}),
	});
	return app;
}

async function pair(app: ReturnType<typeof makeApp>): Promise<string> {
	await app.handle(
		new Request("http://test/api/me/companion/pair", { method: "POST" }),
	);
	const exchanged = await app.handle(
		new Request("http://test/api/companion/token", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ code: "AB12-CD34" }),
		}),
	);
	const body = (await exchanged.json()) as { token: string };
	return body.token;
}

describe("POST /api/companion/now-watching", () => {
	test("401 without a device token", async () => {
		const app = makeApp();
		const res = await app.handle(
			new Request("http://test/api/companion/now-watching", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ media: null }),
			}),
		);
		expect(res.status).toBe(401);
	});

	test("stores a matched title the patron can read back", async () => {
		const app = makeApp();
		const token = await pair(app);
		const posted = await app.handle(
			new Request("http://test/api/companion/now-watching", {
				method: "POST",
				headers: {
					"content-type": "application/json",
					authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({
					paused: false,
					media: {
						provider: "netflix",
						kind: "episode",
						title: "Stranger Things",
						season: 4,
						episode: 1,
						positionSec: 12,
						durationSec: 3600,
					},
				}),
			}),
		);
		expect(posted.status).toBe(200);

		const read = await app.handle(
			new Request("http://test/api/me/companion/now-watching"),
		);
		expect(read.status).toBe(200);
		expect(await read.json()).toEqual({
			watching: {
				title: "Stranger Things",
				provider: "netflix",
				kind: "tv",
				tmdbId: 66732,
				href: "/tv/66732",
				season: 4,
				episode: 1,
				positionSec: 12,
				durationSec: 3600,
				paused: false,
				updatedAt: "2026-09-30T00:00:00.000Z",
			},
		});
	});

	test("reads the body Elysia already parsed", async () => {
		const route = makeApp();
		const token = await pair(route);
		const app = new Elysia({ aot: false }).use(route);
		const posted = await app.handle(
			new Request("http://test/api/companion/now-watching", {
				method: "POST",
				headers: {
					"content-type": "application/json",
					authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({
					paused: true,
					media: {
						provider: "max",
						kind: "movie",
						title: "Stranger Things",
						season: null,
						episode: null,
						positionSec: 151,
						durationSec: 5192,
					},
				}),
			}),
		);
		expect(posted.status).toBe(200);
		const payload = (await posted.json()) as {
			watching: { title: string; paused: boolean } | null;
		};
		expect(payload.watching?.title).toBe("Stranger Things");
		expect(payload.watching?.paused).toBe(true);
	});

	test("logs a title once the playhead is near the end", async () => {
		let calls = 0;
		const watching = new CompanionNowWatching(
			new MemoryCompanionWatchingStore(),
			async () => [{ id: 66732, title: "Stranger Things" }],
			{ now: () => Date.parse("2026-09-30T00:00:00.000Z") },
		);
		const app = buildCompanionRoute({
			deriveUser: () => ({ id: USER_ID }),
			store: new MemoryCompanionPairingStore(),
			watching,
			now: () => Date.parse("2026-09-30T00:00:00.000Z"),
			randomCode: () => "AB12CD34",
			randomToken: () => "device-token-plain",
			randomId: () => "dev_1",
			rateLimitHit: () => ({ ok: true, remaining: 0, resetAt: 0 }),
			recordAutoLog: async () => {
				calls += 1;
				return {
					logId: "log_1",
					title: "Stranger Things",
					kind: "tv" as const,
					season: 4,
					episode: 1,
					seriesFinale: false,
				};
			},
		});
		const token = await pair(app);
		const posted = await app.handle(
			new Request("http://test/api/companion/now-watching", {
				method: "POST",
				headers: {
					"content-type": "application/json",
					authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({
					paused: false,
					media: {
						provider: "netflix",
						kind: "episode",
						title: "Stranger Things",
						season: 4,
						episode: 1,
						positionSec: 3300,
						durationSec: 3600,
					},
				}),
			}),
		);
		expect(posted.status).toBe(200);
		expect(await posted.json()).toMatchObject({
			logged: {
				logId: "log_1",
				title: "Stranger Things",
				kind: "tv",
				season: 4,
				episode: 1,
				seriesFinale: false,
			},
		});
		expect(calls).toBe(1);
	});

	test("an early heartbeat does not write a diary log", async () => {
		let calls = 0;
		const watching = new CompanionNowWatching(
			new MemoryCompanionWatchingStore(),
			async () => [{ id: 66732, title: "Stranger Things" }],
			{ now: () => Date.parse("2026-09-30T00:00:00.000Z") },
		);
		const app = buildCompanionRoute({
			deriveUser: () => ({ id: USER_ID }),
			store: new MemoryCompanionPairingStore(),
			watching,
			now: () => Date.parse("2026-09-30T00:00:00.000Z"),
			randomCode: () => "AB12CD34",
			randomToken: () => "device-token-plain",
			randomId: () => "dev_1",
			rateLimitHit: () => ({ ok: true, remaining: 0, resetAt: 0 }),
			recordAutoLog: async () => {
				calls += 1;
				return { title: "Stranger Things" };
			},
		});
		const token = await pair(app);
		const posted = await app.handle(
			new Request("http://test/api/companion/now-watching", {
				method: "POST",
				headers: {
					"content-type": "application/json",
					authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({
					paused: false,
					media: {
						provider: "netflix",
						kind: "episode",
						title: "Stranger Things",
						season: 4,
						episode: 1,
						positionSec: 12,
						durationSec: 3600,
					},
				}),
			}),
		);
		expect(posted.status).toBe(200);
		const payload = (await posted.json()) as { logged: unknown };
		expect(payload.logged).toBeNull();
		expect(calls).toBe(0);
	});

	test("saves a rating on the log that was just written", async () => {
		let seen: { logId: string; ratingTenths: number } | null = null;
		const app = buildCompanionRoute({
			deriveUser: () => ({ id: USER_ID }),
			store: new MemoryCompanionPairingStore(),
			now: () => Date.parse("2026-09-30T00:00:00.000Z"),
			randomCode: () => "AB12CD34",
			randomToken: () => "device-token-plain",
			randomId: () => "dev_1",
			rateLimitHit: () => ({ ok: true, remaining: 0, resetAt: 0 }),
			rateLog: async (_userId, logId, ratingTenths) => {
				seen = { logId, ratingTenths };
				return true;
			},
		});
		const token = await pair(app);
		const posted = await app.handle(
			new Request("http://test/api/companion/log-rating", {
				method: "POST",
				headers: {
					"content-type": "application/json",
					authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({ logId: "log_1", rating: 8.5 }),
			}),
		);
		expect(posted.status).toBe(200);
		expect(seen).toEqual({ logId: "log_1", ratingTenths: 85 });
	});

	test("429 when the heartbeat limit is spent", async () => {
		const app = makeApp({ rateLimitOk: false });
		const token = await pair(app);
		const res = await app.handle(
			new Request("http://test/api/companion/now-watching", {
				method: "POST",
				headers: {
					"content-type": "application/json",
					authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({ clear: true }),
			}),
		);
		expect(res.status).toBe(429);
	});
});
