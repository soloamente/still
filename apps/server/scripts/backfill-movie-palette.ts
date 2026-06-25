import { db, movie } from "@still/db";
import { and, isNotNull, isNull } from "drizzle-orm";

import { syncMoviePosterPalette } from "../src/lib/sync-movie-palette";

/**
 * Backfill poster palettes for movies missing them. Runs in Node/Bun (uses
 * node-vibrant), NOT on Workers. Intended for a scheduled cron (e.g. GitHub
 * Action) now that the movie detail request path no longer extracts palettes.
 */
async function main(): Promise<void> {
	const rows = await db
		.select({ tmdbId: movie.tmdbId, posterPath: movie.posterPath })
		.from(movie)
		.where(and(isNull(movie.paletteAccent), isNotNull(movie.posterPath)));

	console.log(`[palette-backfill] ${rows.length} movies need a palette`);
	let done = 0;
	for (const row of rows) {
		await syncMoviePosterPalette(row.tmdbId, row.posterPath);
		done += 1;
		if (done % 50 === 0) {
			console.log(`[palette-backfill] ${done}/${rows.length}`);
		}
	}
	console.log(`[palette-backfill] complete — ${done} processed`);
}

main()
	.then(() => process.exit(0))
	.catch((err) => {
		console.error("[palette-backfill] failed", err);
		process.exit(1);
	});
