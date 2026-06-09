import { Elysia } from "elysia";
import { strToU8, zipSync } from "fflate";

import { context } from "../context";
import { clearUserLibrary } from "../lib/clear-user-library";
import { assembleExportFiles, fetchExportInput } from "../lib/me-export-data";
import { hit } from "../lib/rate-limit";

type RateLimitHit = (
	key: string,
	opts: { limit: number; windowMs: number },
) => { ok: boolean; remaining: number; resetAt: number };

interface MeDataRouteOptions {
	/** Test seam — production uses the `context` plugin's session user. */
	deriveUser?: () => { id: string } | null;
	exportRateLimit?: { limit: number; windowMs: number };
	/** Test seam — other route tests mock `../lib/rate-limit` to always pass. */
	rateLimitHit?: RateLimitHit;
}

const EXPORT_RATE_LIMIT = { limit: 3, windowMs: 60 * 60_000 };

/**
 * Patron data controls (spec 2026-06-09): synchronous in-memory ZIP export and
 * the clear-library transaction. Account deletion lives in Better Auth
 * (`/api/auth/delete-user/*`), not here.
 */
type MeDataRequestUser = { id: string; name?: string; email?: string } | null;

export function buildMeDataRoute(options: MeDataRouteOptions = {}): Elysia {
	const limits = options.exportRateLimit ?? EXPORT_RATE_LIMIT;
	const checkLimit = options.rateLimitHit ?? hit;

	const base = new Elysia({ prefix: "/api/me", tags: ["me"] });
	// Tests use `deriveUser`; production mounts the shared `context` plugin.
	// Global derive matches `context` so route tests still see `user` after
	// other suites register the real context plugin in-process.
	const deriveUser = options.deriveUser;
	const withAuth = (deriveUser
		? base.derive({ as: "global" }, () => ({
				user: deriveUser(),
			}))
		: base.use(context)) as unknown as Elysia;

	return withAuth
		.get("/export", async (ctx) => {
			const { user, status } = ctx as typeof ctx & { user: MeDataRequestUser };
			if (!user) return status(401, "Sign in");
			if (!checkLimit(`me:export:${user.id}`, limits).ok) {
				return status(429, "Export limit reached — try again in an hour");
			}

			const input = await fetchExportInput(user.id);
			const files = assembleExportFiles(input);
			const zipped = zipSync(
				Object.fromEntries(files.map((f) => [f.path, strToU8(f.contents)])),
			);

			const date = new Date().toISOString().slice(0, 10);
			const handle = input.profile.handle;
			return new Response(zipped, {
				headers: {
					"content-type": "application/zip",
					"content-disposition": `attachment; filename="sense-export-${handle}-${date}.zip"`,
				},
			});
		})
		.delete("/library", async (ctx) => {
			const { user, status } = ctx as typeof ctx & { user: MeDataRequestUser };
			if (!user) return status(401, "Sign in");
			const counts = await clearUserLibrary(user.id);
			return { ok: true as const, counts };
		}) as unknown as Elysia;
}

export const meDataRoute = buildMeDataRoute();
