import { cors } from "@elysiajs/cors";
import { auth } from "@still/auth";
import { env } from "@still/env/server";
import { Elysia } from "elysia";

import { achievementsRoute, badgesRoute } from "./routes/badges";
import { chatRoute } from "./routes/chat";
import { commentsRoute } from "./routes/comments";
import { feedRoute } from "./routes/feed";
import { followsRoute } from "./routes/follows";
import { listsRoute } from "./routes/lists";
import { logsRoute } from "./routes/logs";
import { moviesRoute } from "./routes/movies";
import { newsRoute } from "./routes/news";
import { notificationsRoute } from "./routes/notifications";
import { peopleRoute } from "./routes/people";
import { postsRoute } from "./routes/posts";
import { profilesRoute } from "./routes/profiles";
import { reviewsRoute } from "./routes/reviews";
import { tvRoute } from "./routes/tv";
import { watchlistRoute } from "./routes/watchlist";
import { wsRoute } from "./ws";

/**
 * Pure Elysia app — no `listen`, no schedulers. Importable by clients
 * (via Eden Treaty) to grab the type without spinning up a process.
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
	.use(moviesRoute)
	.use(tvRoute)
	.use(peopleRoute)
	.use(logsRoute)
	.use(reviewsRoute)
	.use(watchlistRoute)
	.use(listsRoute)
	.use(profilesRoute)
	.use(followsRoute)
	.use(feedRoute)
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
