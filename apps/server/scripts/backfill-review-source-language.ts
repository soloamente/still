import { db, review } from "@still/db";
import { and, isNull, sql } from "drizzle-orm";

import { detectReviewLanguage } from "../src/lib/detect-language";

/**
 * One-off backfill: fill `review.source_language` for reviews written before
 * detection existed, so the translate affordance can appear on legacy rows.
 *
 * Detection is local (tinyld) — this costs nothing but database round trips, so
 * it is safe to re-run. Rows whose text is too short or ambiguous to call stay
 * NULL and are simply re-examined on the next run.
 *
 * Usage:
 *   bun run scripts/backfill-review-source-language.ts            # dry run
 *   bun run scripts/backfill-review-source-language.ts --apply    # write
 */
const APPLY = process.argv.includes("--apply");

async function main(): Promise<void> {
	const rows = await db
		.select({ id: review.id, body: review.body })
		.from(review)
		.where(and(isNull(review.sourceLanguage), isNull(review.removedAt)));

	const detected: { id: string; language: string }[] = [];
	let undetectable = 0;
	for (const row of rows) {
		const language = detectReviewLanguage(row.body);
		if (language) detected.push({ id: row.id, language });
		else undetectable += 1;
	}

	const byLanguage = new Map<string, number>();
	for (const row of detected) {
		byLanguage.set(row.language, (byLanguage.get(row.language) ?? 0) + 1);
	}
	const summary = Array.from(byLanguage.entries())
		.sort((a, b) => b[1] - a[1])
		.map(([language, n]) => `${language}=${n}`)
		.join(" ");

	console.log(
		`[review-source-language] ${rows.length} row(s) without a language — ${detected.length} detected, ${undetectable} too short/ambiguous`,
	);
	if (summary) console.log(`[review-source-language] ${summary}`);

	if (!APPLY) {
		console.log(
			"[review-source-language] dry run — re-run with --apply to write",
		);
		return;
	}

	let done = 0;
	for (const row of detected) {
		// Raw SQL on purpose: a Drizzle `.set()` fires `review.updatedAt`'s
		// `$onUpdate` hook, which would stamp every historical review as freshly
		// edited. Backfilling a derived column is not an edit.
		await db.execute(
			sql`UPDATE "review" SET source_language = ${row.language} WHERE id = ${row.id}`,
		);
		done += 1;
		if (done % 50 === 0) {
			console.log(`[review-source-language] ${done}/${detected.length}`);
		}
	}
	console.log(`[review-source-language] complete — ${done} updated`);
}

main()
	.then(() => process.exit(0))
	.catch((err) => {
		console.error("[review-source-language] failed", err);
		process.exit(1);
	});
