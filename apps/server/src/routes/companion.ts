import { db, profile } from "@still/db";
import { env } from "@still/env/server";
import { eq } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { freshContext } from "../context";
import {
	type CompanionAutoLogResult,
	companionDisplayRatingToStored,
	companionLogRatingBody,
	companionPlaybackReadyToLog,
	rateCompanionAutoLog,
	recordCompanionAutoLog,
} from "../lib/companion-auto-log";
import {
	type CompanionNowWatching,
	type CompanionNowWatchingView,
	companionNowWatchingBody,
} from "../lib/companion-now-watching";
import { createCompanionNowWatching } from "../lib/companion-now-watching-redis";
import {
	CompanionPairing,
	type CompanionPairingOptions,
	type CompanionPairingStore,
} from "../lib/companion-pairing";
import { drizzleCompanionPairingStore } from "../lib/companion-pairing-db";
import {
	companionButtonOrigin,
	companionProfileButtonUrl,
	companionTitleButtonUrl,
} from "../lib/companion-profile-button";
import { hit } from "../lib/rate-limit";

type CompanionRequestUser = { id: string } | null;

type RateLimitHit = typeof hit;

type CompanionRouteOptions = CompanionPairingOptions & {
	deriveUser?: () => CompanionRequestUser;
	store: CompanionPairingStore;
	watching?: CompanionNowWatching;
	rateLimitHit?: RateLimitHit;
	recordAutoLog?: (
		userId: string,
		view: CompanionNowWatchingView,
	) => Promise<CompanionAutoLogResult | null>;
	rateLog?: (
		userId: string,
		logId: string,
		ratingTenths: number,
	) => Promise<boolean>;
	/** Optional profile lookup for the Discord profile button URL. */
	profileForUser?: (
		userId: string,
	) => Promise<{ handle: string | null; isPrivate: boolean } | null>;
	/** Public web origin used to build https://…/profile/{handle}. */
	publicOrigin?: string;
};

/** Production profile read — handle + privacy only; never tmdb_json. */
async function loadCompanionProfileForUser(
	userId: string,
): Promise<{ handle: string | null; isPrivate: boolean } | null> {
	const [row] = await db
		.select({ handle: profile.handle, isPrivate: profile.isPrivate })
		.from(profile)
		.where(eq(profile.userId, userId))
		.limit(1);
	if (!row) return null;
	return { handle: row.handle ?? null, isPrivate: row.isPrivate };
}

function readBearerToken(request: Request): string | null {
	const header = request.headers.get("authorization");
	if (!header) return null;
	const [scheme, token] = header.split(" ");
	if (scheme?.toLowerCase() !== "bearer" || !token) return null;
	return token;
}

/**
 * Sense Companion pairing.
 * Settings (session) issues a short code and can revoke devices.
 * The extension exchanges that code for a bearer token — no session cookie.
 */
export function buildCompanionRoute(options: CompanionRouteOptions): Elysia {
	const pairing = new CompanionPairing(options.store, options);
	const watching = options.watching;
	const rateLimitHit = options.rateLimitHit ?? hit;
	const recordAutoLog = options.recordAutoLog ?? recordCompanionAutoLog;
	const rateLog = options.rateLog ?? rateCompanionAutoLog;
	const profileForUser = options.profileForUser;
	const publicOrigin = options.publicOrigin;
	const base = new Elysia({ tags: ["companion"] });
	const deriveUser = options.deriveUser;
	const withAuth = (deriveUser
		? base.derive({ as: "global" }, () => ({
				user: deriveUser(),
			}))
		: base.use(freshContext)) as unknown as Elysia;

	return withAuth
		.post("/api/me/companion/pair", async (ctx) => {
			const { user, status } = ctx as typeof ctx & {
				user: CompanionRequestUser;
			};
			if (!user) return status(401, "Sign in");
			return pairing.issueCode(user.id);
		})
		.get("/api/me/companion", async (ctx) => {
			const { user, status } = ctx as typeof ctx & {
				user: CompanionRequestUser;
			};
			if (!user) return status(401, "Sign in");
			return pairing.status(user.id);
		})
		.get("/api/me/companion/now-watching", async (ctx) => {
			const { user, status } = ctx as typeof ctx & {
				user: CompanionRequestUser;
			};
			if (!user) return status(401, "Sign in");
			if (!watching) return status(404, "Not found");
			return { watching: await watching.read(user.id) };
		})
		.delete("/api/me/companion", async (ctx) => {
			const { user, status } = ctx as typeof ctx & {
				user: CompanionRequestUser;
			};
			if (!user) return status(401, "Sign in");
			const result = await pairing.revoke(user.id);
			return { ok: true as const, revoked: result.revoked };
		})
		.post("/api/me/companion/link", async (ctx) => {
			const { request, status } = ctx;
			const user = (ctx as typeof ctx & { user: CompanionRequestUser }).user;
			if (!user) return status(401, "Sign in");
			// The extension sets this. A normal page does not need to mint device tokens.
			if (request.headers.get("x-sense-companion") !== "link") {
				return status(403, "Forbidden");
			}
			const limited = rateLimitHit(`companion:link:${user.id}`, {
				limit: 10,
				windowMs: 60_000,
			});
			if (!limited.ok) return status(429, "Slow down");
			return pairing.issueDevice(user.id);
		})
		.post(
			"/api/companion/token",
			async (ctx) => {
				const { body, status } = ctx;
				const result = await pairing.exchange(body.code);
				if ("error" in result) return status(401, result);
				return result;
			},
			{
				body: t.Object({
					code: t.String({ minLength: 1, maxLength: 32 }),
				}),
			},
		)
		.get("/api/companion/session", async (ctx) => {
			const { request, status } = ctx;
			const token = readBearerToken(request);
			if (!token) return status(401, "Sign in");
			const session = await pairing.session(token);
			if (!session) return status(401, "Sign in");
			// Missing or failed lookup still returns ok — Discord just omits the button.
			let profile: { handle: string | null; isPrivate: boolean } | null = null;
			try {
				profile = (await profileForUser?.(session.userId)) ?? null;
			} catch {
				profile = null;
			}
			const profileUrl = companionProfileButtonUrl({
				origin: publicOrigin ?? "",
				handle: profile?.handle ?? null,
				isPrivate: profile?.isPrivate ?? true,
			});
			return { ok: true as const, profileUrl };
		})
		.post("/api/companion/now-watching", async (ctx) => {
			const { request, status, body } = ctx;
			const token = readBearerToken(request);
			if (!token) return status(401, "Sign in");
			const session = await pairing.session(token);
			if (!session) return status(401, "Sign in");
			if (!watching) return status(404, "Not found");
			// One playing browser and one idle browser can each save from the
			// extension and the desktop helper. 12 ticks a minute is the floor.
			const limited = rateLimitHit(`companion:watch:${session.userId}`, {
				limit: 90,
				windowMs: 60_000,
			});
			if (!limited.ok) return status(429, "Slow down");

			// `aot: false` already parsed this JSON into `body`. Reading
			// `request.json()` again throws, so every paired heartbeat was 400.
			let json: unknown = body;
			if (json == null) {
				try {
					json = await request.json();
				} catch {
					return status(400, "Invalid body");
				}
			}
			const parsed = companionNowWatchingBody.safeParse(json);
			if (!parsed.success) return status(400, "Invalid body");
			const view = await watching.heartbeat(
				session.userId,
				parsed.data,
				session.deviceId,
			);
			const label = parsed.data.clear
				? "clear"
				: (parsed.data.media?.title ?? "clear");
			console.info("[companion] now-watching", label);
			// Logging is a one-shot. A failure here must not drop the profile row.
			let logged: CompanionAutoLogResult | null = null;
			if (view && companionPlaybackReadyToLog(view)) {
				try {
					logged = await recordAutoLog(session.userId, view);
				} catch (error) {
					console.error("[companion] auto log failed", error);
				}
			}
			if (logged) console.info("[companion] logged", logged.title);
			const titleUrl = companionTitleButtonUrl(publicOrigin ?? "", view?.href);
			return { watching: view, logged, titleUrl };
		})
		.post("/api/companion/log-rating", async (ctx) => {
			const { request, status, body } = ctx;
			const token = readBearerToken(request);
			if (!token) return status(401, "Sign in");
			const session = await pairing.session(token);
			if (!session) return status(401, "Sign in");
			const limited = rateLimitHit(`companion:rate:${session.userId}`, {
				limit: 30,
				windowMs: 60_000,
			});
			if (!limited.ok) return status(429, "Slow down");
			let json: unknown = body;
			if (json == null) {
				try {
					json = await request.json();
				} catch {
					return status(400, "Invalid body");
				}
			}
			const parsed = companionLogRatingBody.safeParse(json);
			if (!parsed.success) return status(400, "Invalid body");
			const stored = companionDisplayRatingToStored(parsed.data.rating);
			if (stored == null) return status(400, "Invalid body");
			const saved = await rateLog(session.userId, parsed.data.logId, stored);
			if (!saved) return status(404, "Log not found");
			return { ok: true as const };
		});
}

/** Production route — hashed codes and device tokens in Postgres. */
export const companionRoute = buildCompanionRoute({
	store: drizzleCompanionPairingStore,
	watching: createCompanionNowWatching(),
	publicOrigin: companionButtonOrigin(env.BETTER_AUTH_URL),
	profileForUser: loadCompanionProfileForUser,
});
