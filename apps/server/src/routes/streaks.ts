import { Elysia } from "elysia";

import { context } from "../context";
import { hit } from "../lib/rate-limit";
import { applyStreakShield } from "../lib/watch-streak";
import {
	getWatchStreakSnapshot,
	loadUserStreakState,
	saveUserStreakState,
} from "../lib/watch-streak-sync";

export const streaksRoute = new Elysia({
	prefix: "/api/streaks",
	tags: ["streaks"],
})
	.use(context)
	.get("/me", async ({ user, status }) => {
		if (!user) return status(401, "Sign in");
		try {
			const streak = await getWatchStreakSnapshot(user.id);
			return { streak };
		} catch (err) {
			const detail = err instanceof Error ? err.message : String(err);
			console.error("[streaks] me failed", err);
			const missingTable =
				detail.includes("user_streak") &&
				(detail.includes("does not exist") || detail.includes("Failed query"));
			return status(
				503,
				missingTable
					? "Missing user_streak table — run `bun run db:migrate` from repo root (migrations 0011–0012 must be in the Drizzle journal), then restart the API."
					: `Streak error: ${detail}`,
			);
		}
	})
	.post("/freeze", async ({ user, status }) => {
		if (!user) return status(401, "Sign in");
		if (!hit(`streak-freeze:${user.id}`, { limit: 10, windowMs: 60_000 }).ok) {
			return status(429, "Slow down");
		}

		const prev = await loadUserStreakState(user.id);
		const applied = applyStreakShield(prev);
		if (!applied.ok) return status(400, applied.reason);

		await saveUserStreakState(user.id, applied.next);
		const streak = await getWatchStreakSnapshot(user.id);
		return { streak };
	});
