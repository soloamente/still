/**
 * Standalone local job runner — use when you explicitly want background DB work
 * during development (`RUN_LOCAL_JOBS=true bun run dev:jobs`).
 */
import { db, ensureMoviePaletteColumns } from "@still/db";
import { env } from "@still/env/server";
import {
	runLocalBootJobs,
	startLocalJobScheduler,
} from "./jobs/run-local-scheduler";
import {
	classifyDatabaseTarget,
	formatDatabaseTargetBootLine,
} from "./lib/database-target";

process.env.RUN_LOCAL_JOBS = "true";

const dbTarget = classifyDatabaseTarget(env.DATABASE_URL, env.NODE_ENV);
console.info(formatDatabaseTargetBootLine(dbTarget));
console.warn(
	"[jobs] Standalone scheduler — this process will keep hitting the configured database",
);

try {
	await ensureMoviePaletteColumns(db);
} catch (err) {
	console.error("[jobs] ensureMoviePaletteColumns failed", err);
	process.exit(1);
}

await runLocalBootJobs();
const scheduler = startLocalJobScheduler();

const shutdown = () => {
	scheduler.stop();
	process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

console.info("[jobs] Scheduler running — Ctrl+C to stop");
