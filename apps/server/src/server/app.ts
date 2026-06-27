import { cors } from "@elysiajs/cors";
import { auth } from "@still/auth";
import { db } from "@still/db";
import { env } from "@still/env/server";
import { sql } from "drizzle-orm";
import { Elysia } from "elysia";

import { adminAssetsRoute } from "../routes/admin-assets";
import { achievementsRoute, badgesRoute } from "../routes/badges";
import { challengesRoute } from "../routes/challenges";
import { chatRoute } from "../routes/chat";
import { commentsRoute } from "../routes/comments";
import { feedRoute } from "../routes/feed";
import { followsRoute } from "../routes/follows";
import { importRoute } from "../routes/import";
import { journalRoute } from "../routes/journal";
import { leaderboardRoute } from "../routes/leaderboard";
import { listsRoute } from "../routes/lists";
import { logsRoute } from "../routes/logs";
import { meDataRoute } from "../routes/me-data";
import { membersRoute } from "../routes/members";
import { moviesRoute } from "../routes/movies";
import { newsRoute } from "../routes/news";
import { notificationsRoute } from "../routes/notifications";
import { peopleRoute } from "../routes/people";
import { planFeaturesRoute } from "../routes/plan-features";
import { postsRoute } from "../routes/posts";
import { productEventsRoute } from "../routes/product-events";
import { profilesRoute } from "../routes/profiles";
import { quotesRoute } from "../routes/quotes";
import { realtimeConnectRoute } from "../routes/realtime-connect";
import { realtimePresenceRoute } from "../routes/realtime-presence";
import { reviewsRoute } from "../routes/reviews";
import { staffRoute } from "../routes/staff";
import { streaksRoute } from "../routes/streaks";
import { tasteRoute } from "../routes/taste";
import { tvRoute } from "../routes/tv";
import { tvWatchRoute } from "../routes/tv-watch";
import { watchlistRoute } from "../routes/watchlist";

/**
 * Pure Elysia app — no `listen`, no schedulers. Importable by clients
 * (via Eden Treaty) to grab the type without spinning up a process.
 *
 * Lives under `src/server/` so Vercel does not treat this file as the
 * serverless entry (which would transpile workspace imports to missing `.ts` paths).
 *
 * Compose order matters: CORS first, then the auth pass-through, then
 * the typed route tree, then the WebSocket endpoint.
 */
// `aot: false` disables Elysia's `new Function()` codegen optimizer, which
// Cloudflare Workers forbid ("Code generation from strings disallowed").
export const app = new Elysia({ aot: false })
	.use(
		cors({
			origin: env.CORS_ORIGIN,
			methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
			allowedHeaders: ["Content-Type", "Authorization"],
			credentials: true,
		}),
	)
	// Better Auth handler — uses its own internal router.
	.all("/api/auth/*", async (ctx) => {
		const { request } = ctx;
		if (request.method !== "POST" && request.method !== "GET") {
			return ctx.status(405);
		}
		// On Cloudflare Workers, request bodies are single-use streams and Elysia
		// has already consumed it into `ctx.body`. Rebuild the Request so Better
		// Auth can read the body itself (Bun tolerated re-reads; workerd does not).
		const init: RequestInit = {
			method: request.method,
			headers: request.headers,
		};
		if (request.method === "POST" && ctx.body != null) {
			init.body =
				typeof ctx.body === "string" ? ctx.body : JSON.stringify(ctx.body);
		}
		return auth.handler(new Request(request.url, init));
	})
	// Liveness probe.
	.get("/", () => ({ ok: true, name: "still-server", version: "0.1.0" }))
	.get("/api/health/db", async ({ set }) => {
		try {
			await db.execute(sql`select 1 as ok`);
			return { ok: true };
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			const cause =
				err instanceof Error && err.cause instanceof Error
					? err.cause.message
					: "";
			const quotaExceeded =
				message.includes("402") ||
				cause.includes("data transfer quota") ||
				cause.includes("exceeded the data transfer");
			set.status = 503;
			return {
				ok: false,
				code: quotaExceeded ? "NEON_QUOTA_EXCEEDED" : "DATABASE_UNAVAILABLE",
				message: quotaExceeded
					? "Neon data transfer quota exceeded — upgrade the plan or wait for reset."
					: "Database is not reachable.",
			};
		}
	})
	.use(moviesRoute)
	.use(tvRoute)
	.use(tvWatchRoute)
	.use(peopleRoute)
	.use(logsRoute)
	.use(reviewsRoute)
	.use(quotesRoute)
	.use(watchlistRoute)
	.use(listsRoute)
	.use(profilesRoute)
	.use(productEventsRoute)
	.use(tasteRoute)
	.use(challengesRoute)
	.use(streaksRoute)
	.use(importRoute)
	.use(meDataRoute)
	.use(followsRoute)
	.use(feedRoute)
	.use(leaderboardRoute)
	.use(membersRoute)
	.use(postsRoute)
	.use(commentsRoute)
	.use(badgesRoute)
	.use(achievementsRoute)
	.use(newsRoute)
	.use(journalRoute)
	.use(chatRoute)
	.use(notificationsRoute)
	.use(realtimePresenceRoute)
	.use(realtimeConnectRoute)
	.use(staffRoute)
	.use(adminAssetsRoute)
	.use(planFeaturesRoute)
	.onError(({ error, code }) => {
		console.error(`[server] error code=${code}`, error);
		return {
			error: error instanceof Error ? error.message : String(error),
			code,
		};
	});

export type App = typeof app;

// Vercel Elysia expects a default export when this module is the function entry.
export default app;
