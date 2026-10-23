import { db, tvWatch, tvWatchEpisode } from "@still/db";
import { eq } from "drizzle-orm";
import { getTmdbLanguageForUser } from "../src/lib/tmdb-poster-language";
import { syncTvCompletionLogs } from "../src/lib/tv-completion-logs";

/**
 * One-off: create the season / whole-show diary logs that check-marks already
 * earned before the server started doing it automatically. Season logs are
 * dated by the newest check-mark in that season; the whole-show log by the
 * newest check-mark of the show. Hits TMDb season caches (24h) per show.
 *
 * Usage:
 *   bun run tv:backfill-completion-logs            # dry run (counts only)
 *   bun run tv:backfill-completion-logs --apply    # write
 */
const APPLY = process.argv.includes("--apply");

async function main(): Promise<void> {
	const watches = await db
		.select({ id: tvWatch.id, userId: tvWatch.userId, tvId: tvWatch.tvId })
		.from(tvWatch);

	let watchesWithWork = 0;
	let seasonLogs = 0;
	let showLogs = 0;

	for (const watch of watches) {
		const watched = await db
			.select({
				seasonNumber: tvWatchEpisode.seasonNumber,
				episodeNumber: tvWatchEpisode.episodeNumber,
				watchedAt: tvWatchEpisode.watchedAt,
			})
			.from(tvWatchEpisode)
			.where(eq(tvWatchEpisode.tvWatchId, watch.id));
		if (watched.length === 0) continue;

		const language = await getTmdbLanguageForUser(watch.userId);
		const result = await syncTvCompletionLogs({
			userId: watch.userId,
			tvId: watch.tvId,
			language,
			watched,
			dating: "history",
			dryRun: !APPLY,
		});
		if (!result) continue;
		if (result.seasonLogsCreated.length === 0 && !result.showLogCreated) {
			continue;
		}

		watchesWithWork += 1;
		seasonLogs += result.seasonLogsCreated.length;
		if (result.showLogCreated) showLogs += 1;
	}

	console.log(
		`[tv-completion-backfill] ${watches.length} watch row(s) scanned, ${watchesWithWork} need logs`,
	);
	console.log(
		`[tv-completion-backfill] ${seasonLogs} season log(s), ${showLogs} whole-show log(s) ${APPLY ? "created" : "would be created"}`,
	);
	if (!APPLY) {
		console.log(
			"[tv-completion-backfill] dry run — re-run with --apply to write",
		);
	}
}

main()
	.then(() => process.exit(0))
	.catch((err) => {
		console.error("[tv-completion-backfill] failed", err);
		process.exit(1);
	});
