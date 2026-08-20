/**
 * In-process background job scheduler for local development only.
 * Production must use Cloudflare Cron / GitHub Actions — not this module.
 */

import { syncWatchlistStreamingAlerts } from "../lib/watchlist-streaming-alerts";
import { runEvaluator } from "./badge-evaluator";
import { ingestRss } from "./rss-ingest";
import { seedCatalog } from "./seed";
import { refreshStaleMovies, syncTmdbFeeds } from "./tmdb-sync";
import { syncTvNewEpisodeNotifications } from "./tv-new-episode-sync";

export const LOCAL_JOB_INTERVALS = {
	evaluatorMs: 2 * 60_000,
	rssMs: 30 * 60_000,
	tmdbNewsMs: 6 * 60 * 60_000,
	tmdbStaleMs: 24 * 60 * 60_000,
	tvNewEpisodeMs: 6 * 60 * 60_000,
	watchlistStreamingMs: 24 * 60 * 60_000,
} as const;

/** Explicit opt-in — ordinary `bun dev` must not schedule DB work against Neon. */
export function isLocalJobsEnabled(): boolean {
	const raw = process.env.RUN_LOCAL_JOBS?.trim().toLowerCase();
	return raw === "1" || raw === "true" || raw === "yes";
}

async function safeRun(name: string, fn: () => Promise<void>) {
	try {
		await fn();
	} catch (err) {
		console.error(`[jobs] ${name} failed`, err);
	}
}

/** One-shot boot jobs (seed catalog, warm news feeds). */
export async function runLocalBootJobs(): Promise<void> {
	await safeRun("seed", seedCatalog);
	await safeRun("tmdb-news", syncTmdbFeeds);
	await safeRun("rss", ingestRss);
}

type SchedulerHandle = {
	stop: () => void;
};

/**
 * Start recurring local jobs. Returns a handle to clear intervals.
 * Call only when `isLocalJobsEnabled()` is true.
 */
export function startLocalJobScheduler(): SchedulerHandle {
	const timers: ReturnType<typeof setInterval>[] = [];

	timers.push(
		setInterval(
			() => void safeRun("evaluator", runEvaluator),
			LOCAL_JOB_INTERVALS.evaluatorMs,
		),
	);
	timers.push(
		setInterval(
			() => void safeRun("rss", ingestRss),
			LOCAL_JOB_INTERVALS.rssMs,
		),
	);
	timers.push(
		setInterval(
			() => void safeRun("tmdb-news", syncTmdbFeeds),
			LOCAL_JOB_INTERVALS.tmdbNewsMs,
		),
	);
	timers.push(
		setInterval(
			() => void safeRun("tmdb-stale", refreshStaleMovies),
			LOCAL_JOB_INTERVALS.tmdbStaleMs,
		),
	);
	timers.push(
		setInterval(
			() => void safeRun("tv-new-episode", syncTvNewEpisodeNotifications),
			LOCAL_JOB_INTERVALS.tvNewEpisodeMs,
		),
	);
	timers.push(
		setInterval(
			() => void safeRun("watchlist-streaming", syncWatchlistStreamingAlerts),
			LOCAL_JOB_INTERVALS.watchlistStreamingMs,
		),
	);

	for (const timer of timers) timer.unref?.();

	console.info(
		"[jobs] Local scheduler running (evaluator every 2m — disable with RUN_LOCAL_JOBS unset)",
	);

	return {
		stop: () => {
			for (const timer of timers) clearInterval(timer);
		},
	};
}
