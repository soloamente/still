import { db, ensureMoviePaletteColumns } from "@still/db";
import { env } from "@still/env/server";
import {
	isLocalJobsEnabled,
	runLocalBootJobs,
	startLocalJobScheduler,
} from "./jobs/run-local-scheduler";
import {
	classifyDatabaseTarget,
	formatDatabaseTargetBootLine,
} from "./lib/database-target";
import { shouldUsePresenceDevStore } from "./lib/presence-dev-store";
import { app } from "./server/app";
import { wsRoute } from "./ws";

export type { App } from "./server/app";

const dbTarget = classifyDatabaseTarget(env.DATABASE_URL, env.NODE_ENV);
console.info(formatDatabaseTargetBootLine(dbTarget));
if (dbTarget.warnRecurringJobs && !isLocalJobsEnabled()) {
	console.info(
		"[boot] Recurring DB jobs are OFF (set RUN_LOCAL_JOBS=true to enable — prefer local Postgres for dev)",
	);
} else if (dbTarget.warnRecurringJobs && isLocalJobsEnabled()) {
	console.warn(
		"[boot] RUN_LOCAL_JOBS=true — recurring jobs will hit remote Postgres and prevent Neon scale-to-zero",
	);
}

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

// Opt-in request log — pairs with `STILL_TRACE_TIMING` to attribute DB/TMDb calls to routes.
if (process.env.STILL_TRACE_TIMING === "1") {
	app.onRequest(({ request }) => {
		console.log(
			`[trace:req] ${request.method} ${new URL(request.url).pathname}`,
		);
	});
}

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

// Optional local job scheduler — explicit opt-in so ordinary dev does not keep Neon awake.
if (isLocalJobsEnabled()) {
	void runLocalBootJobs();
	startLocalJobScheduler();
}
