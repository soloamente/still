import { db, profile } from "@still/db";
import { isNotNull } from "drizzle-orm";

import {
	onboardingFavoriteMovieIdsMissingDiary,
	parseProfileFavoriteMovieIds,
	repairLegacyOnboardingFavoriteDiary,
} from "../src/lib/onboarding-favorite-diary-backfill";

/**
 * Bulk repair for patrons who finished onboarding before favorites were synced
 * into diary. Restores missing logs dated to `onboarded_at` so period ranks
 * reflect when they actually joined.
 *
 * Usage:
 *   bun run onboarding:backfill-diary            # dry run
 *   bun run onboarding:backfill-diary --apply    # write
 */
const APPLY = process.argv.includes("--apply");

async function main(): Promise<void> {
	const rows = await db
		.select({
			userId: profile.userId,
			favoriteMovieIds: profile.favoriteMovieIds,
			onboardedAt: profile.onboardedAt,
			showcaseItems: profile.showcaseItems,
		})
		.from(profile)
		.where(isNotNull(profile.onboardedAt));

	let withFavorites = 0;
	let needsRepair = 0;
	let repaired = 0;

	for (const row of rows) {
		const favoriteMovieIds = parseProfileFavoriteMovieIds(row.favoriteMovieIds);
		if (favoriteMovieIds.length === 0) continue;
		withFavorites += 1;

		const missing = await onboardingFavoriteMovieIdsMissingDiary(
			row.userId,
			favoriteMovieIds,
		);
		const showcaseEmpty =
			!Array.isArray(row.showcaseItems) || row.showcaseItems.length === 0;
		if (missing.length === 0 && !showcaseEmpty) continue;

		needsRepair += 1;
		if (!APPLY) continue;

		const did = await repairLegacyOnboardingFavoriteDiary({
			userId: row.userId,
			favoriteMovieIds,
			onboardedAt: row.onboardedAt,
			showcaseItems: row.showcaseItems,
		});
		if (did) repaired += 1;
	}

	console.log(
		`[onboarding-diary] ${withFavorites} onboarded patron(s) with favorites`,
	);
	console.log(
		`[onboarding-diary] ${needsRepair} need diary and/or showcase repair`,
	);

	if (!APPLY) {
		console.log("[onboarding-diary] dry run — re-run with --apply to write");
		return;
	}

	console.log(`[onboarding-diary] complete — ${repaired} patron(s) repaired`);
}

main()
	.then(() => process.exit(0))
	.catch((err) => {
		console.error("[onboarding-diary] failed", err);
		process.exit(1);
	});
