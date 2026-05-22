import { cors } from "@elysiajs/cors";
import { auth } from "@still/auth";
import { db } from "@still/db";
import { env } from "@still/env/server";
import { sql } from "drizzle-orm";
import { Elysia } from "elysia";

import { achievementsRoute, badgesRoute } from "../routes/badges";
import { chatRoute } from "../routes/chat";
import { commentsRoute } from "../routes/comments";
import { feedRoute } from "../routes/feed";
import { followsRoute } from "../routes/follows";
import { leaderboardRoute } from "../routes/leaderboard";
import { listsRoute } from "../routes/lists";
import { logsRoute } from "../routes/logs";
import { moviesRoute } from "../routes/movies";
import { newsRoute } from "../routes/news";
import { notificationsRoute } from "../routes/notifications";
import { peopleRoute } from "../routes/people";
import { postsRoute } from "../routes/posts";
import { profilesRoute } from "../routes/profiles";
import { reviewsRoute } from "../routes/reviews";
import { tvRoute } from "../routes/tv";
import { tvWatchRoute } from "../routes/tv-watch";
import { watchlistRoute } from "../routes/watchlist";
import { wsRoute } from "../ws";

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
export const app = new Elysia()
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
		if (["POST", "GET"].includes(ctx.request.method)) {
			return auth.handler(ctx.request);
		}
		return ctx.status(405);
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
	.use(watchlistRoute)
	.use(listsRoute)
	.use(profilesRoute)
	.use(followsRoute)
	.use(feedRoute)
	.use(leaderboardRoute)
	.use(postsRoute)
	.use(commentsRoute)
	.use(badgesRoute)
	.use(achievementsRoute)
	.use(newsRoute)
	.use(chatRoute)
	.use(notificationsRoute)
	.use(wsRoute)
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
