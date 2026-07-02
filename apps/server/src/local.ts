import { db, ensureMoviePaletteColumns } from "@still/db";
import { runEvaluator } from "./jobs/badge-evaluator";
import { ingestRss } from "./jobs/rss-ingest";
import { seedCatalog } from "./jobs/seed";
import { refreshStaleMovies, syncTmdbFeeds } from "./jobs/tmdb-sync";
import { syncTvNewEpisodeNotifications } from "./jobs/tv-new-episode-sync";
import { shouldUsePresenceDevStore } from "./lib/presence-dev-store";
import { syncWatchlistStreamingAlerts } from "./lib/watchlist-streaming-alerts";
import { app } from "./server/app";
import { wsRoute } from "./ws";

export type { App } from "./server/app";

// Align remote DBs that shipped without running migration 0001 (palette columns).
try {
	await ensureMoviePaletteColumns(db);
} catch (err) {
	// Still listen so the web app gets a real HTTP error instead of ECONNREFUSED.
	console.error(
		"[boot] ensureMoviePaletteColumns failed — DB may be unavailable",
		err,
	);
}

// Local-only: the Elysia WebSocket chat route runs on Bun, not Workers.
app.use(wsRoute);

app.listen(3000, () => {
	console.log("Server listening on http://localhost:3000");
	if (process.env.NODE_ENV === "development") {
		console.info(
			"[boot] Profile banners/avatars use R2 keys — local dev reads via wrangler (slow first load) or R2_ACCESS_KEY_ID in apps/server/.env",
		);
		if (shouldUsePresenceDevStore()) {
			console.info(
				"[boot] Presence uses in-process dev store (set UPSTASH_REDIS_* in apps/server/.env to mirror production)",
			);
		}
	}
});

// ---------------------------------------------------------------------------
// Background jobs. Single-process scheduler — fine until we shard.
// ---------------------------------------------------------------------------
async function safeRun(name: string, fn: () => Promise<void>) {
	try {
		await fn();
	} catch (err) {
		console.error(`[jobs] ${name} failed`, err);
	}
}

// Boot-time: ensure the badge/achievement catalog exists, ensure RSS sources
// are present, and warm the TMDb-backed news feed once so the UI isn't empty.
void (async () => {
	await safeRun("seed", seedCatalog);
	await safeRun("tmdb-news", syncTmdbFeeds);
	await safeRun("rss", ingestRss);
})();

// Recurring schedules (kept in-process; replace with a real scheduler in prod).
const ONE_MINUTE = 60_000;
setInterval(
	() => void safeRun("evaluator", runEvaluator),
	2 * ONE_MINUTE,
).unref?.();
setInterval(() => void safeRun("rss", ingestRss), 30 * ONE_MINUTE).unref?.();
setInterval(
	() => void safeRun("tmdb-news", syncTmdbFeeds),
	6 * 60 * ONE_MINUTE,
).unref?.();
setInterval(
	() => void safeRun("tmdb-stale", refreshStaleMovies),
	24 * 60 * ONE_MINUTE,
).unref?.();
setInterval(
	() => void safeRun("tv-new-episode", syncTvNewEpisodeNotifications),
	6 * 60 * ONE_MINUTE,
).unref?.();
setInterval(
	() => void safeRun("watchlist-streaming", syncWatchlistStreamingAlerts),
	24 * 60 * ONE_MINUTE,
).unref?.();
