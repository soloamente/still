import { db, ensureMoviePaletteColumns } from "@still/db";
import { app } from "./app";
import { runEvaluator } from "./jobs/badge-evaluator";
import { ingestRss } from "./jobs/rss-ingest";
import { seedCatalog } from "./jobs/seed";
import { refreshStaleMovies, syncTmdbFeeds } from "./jobs/tmdb-sync";
import { syncTvNewEpisodeNotifications } from "./jobs/tv-new-episode-sync";

export type { App } from "./app";

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

app.listen(3000, () => {
	console.log("Server listening on http://localhost:3000");
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
