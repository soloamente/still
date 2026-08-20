import { db } from "@still/db";
import { sql } from "drizzle-orm";
import { normalizeLeaderboardTimeZone } from "../src/lib/leaderboard-period";
import { fetchLeaderboard } from "../src/lib/leaderboard-query";

/** Debug script — recent patrons vs Film ranks month window. */
async function main(): Promise<void> {
	const tz = normalizeLeaderboardTimeZone(
		Intl.DateTimeFormat().resolvedOptions().timeZone,
	);
	const board = await fetchLeaderboard({
		kind: "films",
		period: "month",
		tz,
		viewerId: null,
	});

	console.log("[audit] month window", board.window);
	console.log(
		"[audit] film ranks entries",
		board.entries.map((e) => ({
			handle: e.handle,
			count: e.count,
			userId: e.userId,
		})),
	);

	const patrons = await db.execute(sql`
		SELECT
			p.user_id,
			p.handle,
			p.is_private,
			p.onboarded_at,
			p.created_at,
			COALESCE(jsonb_array_length(p.favorite_movie_ids::jsonb), 0) AS favorite_count,
			(
				SELECT count(*)::int
				FROM "log" l
				WHERE l.user_id = p.user_id
				  AND l.removed_at IS NULL
				  AND l.movie_id IS NOT NULL
			) AS movie_log_count,
			(
				SELECT count(*)::int
				FROM "log" l
				WHERE l.user_id = p.user_id
				  AND l.removed_at IS NULL
				  AND l.movie_id IS NOT NULL
				  AND l.watched_at >= ${board.window.start}::timestamptz
				  AND l.watched_at < ${board.window.end}::timestamptz
			) AS movie_logs_in_month
		FROM profile p
		WHERE p.created_at >= now() - interval '2 days'
		ORDER BY p.created_at DESC
	`);

	const rows = Array.isArray(patrons)
		? patrons
		: ((patrons as { rows?: unknown[] }).rows ?? []);

	console.log("[audit] patrons created in last 2 days:");
	for (const row of rows as Record<string, unknown>[]) {
		console.log(row);
	}
}

main()
	.then(() => process.exit(0))
	.catch((err) => {
		console.error("[audit] failed", err);
		process.exit(1);
	});
