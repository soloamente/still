import { db } from "@still/db";
import { sql } from "drizzle-orm";

/**
 * One-off backfill: flip onboarding-era PRIVATE movie logs to each user's
 * current default visibility. Onboarding writes its taste logs immediately
 * before `markOnboarded` sets `profile.onboarded_at`, so they land in a tight
 * window just before it. Intentional private logs are filed AFTER onboarding
 * and fall outside the window, so they are left untouched.
 *
 * Usage:
 *   bun run scripts/backfill-onboarding-visibility.ts            # dry run
 *   bun run scripts/backfill-onboarding-visibility.ts --apply    # write
 *   ONBOARDING_BACKFILL_WINDOW="30 minutes" bun run ... --apply   # custom window
 */
const APPLY = process.argv.includes("--apply");
const WINDOW = process.env.ONBOARDING_BACKFILL_WINDOW ?? "15 minutes";

/** neon-http and postgres-js return result rows in slightly different shapes. */
function rowsOf<T>(res: unknown): T[] {
	const r = res as { rows?: T[] };
	return Array.isArray(r.rows) ? r.rows : (res as T[]);
}

async function main(): Promise<void> {
	const matches = await db.execute(sql`
		SELECT l.id AS id, p.default_visibility AS target
		FROM "log" l
		JOIN "profile" p ON p.user_id = l.user_id
		WHERE p.onboarded_at IS NOT NULL
		  AND p.default_visibility <> 'private'
		  AND l.visibility = 'private'
		  AND l.movie_id IS NOT NULL
		  AND l.note IS NULL
		  AND l.rating IS NOT NULL
		  AND l.removed_at IS NULL
		  AND l.created_at <= p.onboarded_at
		  AND l.created_at >= p.onboarded_at - (${WINDOW})::interval
	`);

	const rows = rowsOf<{ id: string; target: string }>(matches);
	console.log(
		`[onboarding-visibility] window=${WINDOW} — ${rows.length} private onboarding-era log(s) match`,
	);

	if (!APPLY) {
		console.log(
			"[onboarding-visibility] dry run — re-run with --apply to update",
		);
		return;
	}

	let done = 0;
	for (const row of rows) {
		await db.execute(
			sql`UPDATE "log" SET visibility = ${row.target} WHERE id = ${row.id}`,
		);
		done += 1;
		if (done % 50 === 0) {
			console.log(`[onboarding-visibility] ${done}/${rows.length}`);
		}
	}
	console.log(`[onboarding-visibility] complete — ${done} updated`);
}

main()
	.then(() => process.exit(0))
	.catch((err) => {
		console.error("[onboarding-visibility] failed", err);
		process.exit(1);
	});
