import {
	db,
	follow,
	list,
	log,
	movie,
	profile,
	review,
	tv,
	user,
	userBadge,
} from "@still/db";
import { env } from "@still/env/server";
import { get, put } from "@vercel/blob";
import { and, desc, eq, sql } from "drizzle-orm";
import Elysia, { t } from "elysia";
import { context } from "../context";
import { withCoverPosterPaths } from "../lib/list-cover-posters";
import { hit } from "../lib/rate-limit";

/** Lowercase letterboxd-style handle: letters, digits, underscore, dot, dash, 2–24 chars. */
const HANDLE_RE = /^[a-z0-9._-]{2,24}$/;

/**
 * Profile routes. **Order matters:** `/me` and `/check-handle/*` must be
 * registered before `GET /:handle`, or "me" is treated as a handle.
 */
export const profilesRoute = new Elysia({
	prefix: "/api/profiles",
	tags: ["profiles"],
})
	.use(context)
	// Create/update your own profile. Used by the onboarding flow + settings.
	.patch(
		"/me",
		async ({ body, user, status }) => {
			if (!user) return status(401, "Sign in");
			if (!hit(`profile:update:${user.id}`, { limit: 20, windowMs: 60_000 }).ok)
				return status(429, "Slow down");

			const [existing] = await db
				.select()
				.from(profile)
				.where(eq(profile.userId, user.id))
				.limit(1);

			// Handle availability check (case-insensitive).
			if (body.handle) {
				const desired = body.handle.toLowerCase();
				if (!HANDLE_RE.test(desired))
					return status(400, "Invalid handle format");
				const [taken] = await db
					.select()
					.from(profile)
					.where(
						and(
							eq(profile.handle, desired),
							sql`${profile.userId} <> ${user.id}`,
						),
					)
					.limit(1);
				if (taken) return status(409, "Handle already taken");
			}

			const mergedPreferences =
				body.preferences !== undefined
					? {
							...((existing?.preferences as Record<string, unknown>) ?? {}),
							...(body.preferences as Record<string, unknown>),
						}
					: undefined;

			const updates = {
				handle: body.handle?.toLowerCase(),
				displayName: body.displayName,
				bio: body.bio,
				pronouns: body.pronouns,
				location: body.location,
				website: body.website,
				bannerUrl: body.bannerUrl,
				accentColor: body.accentColor,
				favoriteMovieIds: body.favoriteMovieIds,
				sectionOrder: body.sectionOrder,
				preferences: mergedPreferences ?? undefined,
				isPrivate: body.isPrivate,
				onboardedAt: body.markOnboarded ? new Date() : undefined,
			};

			// Strip undefineds — drizzle's set() won't ignore them otherwise.
			const set: Record<string, unknown> = {};
			for (const [k, v] of Object.entries(updates))
				if (v !== undefined) set[k] = v;

			if (existing) {
				const [row] = await db
					.update(profile)
					.set(set)
					.where(eq(profile.userId, user.id))
					.returning();
				return row;
			}
			if (!body.handle || !body.displayName) {
				return status(
					400,
					"handle and displayName are required on first profile creation",
				);
			}
			const [row] = await db
				.insert(profile)
				.values({
					userId: user.id,
					handle: body.handle.toLowerCase(),
					displayName: body.displayName,
					...set,
				} as typeof profile.$inferInsert)
				.returning();
			return row;
		},
		{
			body: t.Object({
				handle: t.Optional(t.String({ minLength: 2, maxLength: 24 })),
				displayName: t.Optional(t.String({ minLength: 1, maxLength: 60 })),
				bio: t.Optional(t.String({ maxLength: 600 })),
				pronouns: t.Optional(t.String({ maxLength: 30 })),
				location: t.Optional(t.String({ maxLength: 60 })),
				website: t.Optional(t.String({ maxLength: 200 })),
				bannerUrl: t.Optional(t.String()),
				accentColor: t.Optional(t.String({ maxLength: 9 })),
				favoriteMovieIds: t.Optional(t.Array(t.Number(), { maxItems: 8 })),
				sectionOrder: t.Optional(t.Array(t.String())),
				preferences: t.Optional(t.Record(t.String(), t.Unknown())),
				isPrivate: t.Optional(t.Boolean()),
				markOnboarded: t.Optional(t.Boolean()),
			}),
		},
	)
	// Get your own profile (used to bootstrap settings).
	.get("/me", async ({ user, status }) => {
		if (!user) return status(401, "Sign in");
		const [row] = await db
			.select()
			.from(profile)
			.where(eq(profile.userId, user.id))
			.limit(1);
		return row ?? null;
	})
	/**
	 * Banner upload: multipart form with field `file`. Uses Vercel Blob with
	 * `BLOB_READ_WRITE_TOKEN` from **server** env (apps/server/.env), not Next.js.
	 */
	.post("/me/banner", async ({ request, user, status }) => {
		if (!user) return status(401, "Sign in");
		if (!env.BLOB_READ_WRITE_TOKEN) {
			return status(503, {
				error: "BLOB_READ_WRITE_TOKEN is not set",
				code: "BLOB_UNCONFIGURED",
				hint: "Add BLOB_READ_WRITE_TOKEN to apps/server .env (Vercel Blob read-write token).",
			});
		}
		if (!hit(`profile:banner:${user.id}`, { limit: 10, windowMs: 60_000 }).ok)
			return status(429, "Slow down");

		const formData = await request.formData();
		const file = formData.get("file");
		if (!(file instanceof File)) return status(400, "Missing file");
		if (!file.type.startsWith("image/")) return status(400, "Image only");
		if (file.size > 5_000_000) return status(413, "File too large (max 5MB)");

		const key = `banners/${user.id}/${Date.now()}-${encodeURIComponent(file.name)}`;
		let blob: { url: string };
		try {
			// Access must match the Blob *store* access (public vs private) or `put` rejects.
			blob = await put(key, file, {
				access: env.BLOB_STORE_ACCESS,
				addRandomSuffix: false,
				token: env.BLOB_READ_WRITE_TOKEN,
			});
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			console.error("[profiles/me/banner] put failed", err);
			if (msg.includes("private store")) {
				return status(502, {
					error:
						"Blob store is private but upload used public access (or the reverse).",
					code: "BLOB_ACCESS_MISMATCH",
					hint: "Set BLOB_STORE_ACCESS=private in apps/server .env to match a private Vercel Blob store (default in env is public).",
				});
			}
			if (msg.includes("public store") || msg.includes("public access")) {
				return status(502, {
					error: msg,
					code: "BLOB_ACCESS_MISMATCH",
					hint: "Set BLOB_STORE_ACCESS=public in apps/server .env if your Blob store is public, or use a private store with BLOB_STORE_ACCESS=private.",
				});
			}
			return status(502, { error: "Blob upload failed" });
		}

		const [existing] = await db
			.select()
			.from(profile)
			.where(eq(profile.userId, user.id))
			.limit(1);
		if (!existing) return status(400, "Profile not found");
		await db
			.update(profile)
			.set({ bannerUrl: blob.url })
			.where(eq(profile.userId, user.id));

		return { url: blob.url };
	})
	/**
	 * Streams the profile banner for `handle`. Required for **private** Blob
	 * stores (browser cannot load the raw blob URL). Public stores work here too.
	 */
	.get(
		"/banner/:handle",
		async ({ params, status }) => {
			const handle = params.handle.toLowerCase();
			const [row] = await db
				.select({ bannerUrl: profile.bannerUrl })
				.from(profile)
				.where(eq(profile.handle, handle))
				.limit(1);
			if (!row?.bannerUrl) return status(404, "No banner");

			if (!env.BLOB_READ_WRITE_TOKEN) {
				return status(503, "BLOB_READ_WRITE_TOKEN is not set");
			}

			try {
				const result = await get(row.bannerUrl, {
					access: env.BLOB_STORE_ACCESS,
					token: env.BLOB_READ_WRITE_TOKEN,
				});
				if (!result || result.statusCode !== 200 || !result.stream) {
					return status(404, "Banner not found");
				}
				return new Response(result.stream, {
					headers: {
						"Content-Type": result.blob.contentType,
						"Cache-Control": "public, max-age=3600, s-maxage=86400",
					},
				});
			} catch (err) {
				console.error("[profiles/banner] get failed", err);
				return status(502, "Banner load failed");
			}
		},
		{ params: t.Object({ handle: t.String() }) },
	)
	// Lightweight availability check for the signup form.
	.get(
		"/check-handle/:handle",
		async ({ params }) => {
			const handle = params.handle.toLowerCase();
			if (!HANDLE_RE.test(handle))
				return { available: false, reason: "format" as const };
			const [taken] = await db
				.select({ userId: profile.userId })
				.from(profile)
				.where(eq(profile.handle, handle))
				.limit(1);
			return {
				available: !taken,
				reason: taken ? ("taken" as const) : ("ok" as const),
			};
		},
		{ params: t.Object({ handle: t.String() }) },
	)
	// Public profile by handle (case-insensitive) — must stay last (catch-all).
	.get(
		"/:handle",
		async ({ params, user: viewer, status }) => {
			const handle = params.handle.toLowerCase();
			const [row] = await db
				.select({ user, profile })
				.from(profile)
				.leftJoin(user, eq(profile.userId, user.id))
				.where(eq(profile.handle, handle))
				.limit(1);
			if (!row?.user) return status(404, "Not found");

			const [followCount] = await db
				.select({
					followers: sql<number>`count(distinct ${follow.followerId})`,
				})
				.from(follow)
				.where(eq(follow.followingId, row.user.id));
			const [followingCount] = await db
				.select({
					following: sql<number>`count(distinct ${follow.followingId})`,
				})
				.from(follow)
				.where(eq(follow.followerId, row.user.id));

			// Is the viewer following this profile?
			let isFollowing = false;
			if (viewer) {
				const [f] = await db
					.select()
					.from(follow)
					.where(
						and(
							eq(follow.followerId, viewer.id),
							eq(follow.followingId, row.user.id),
						),
					)
					.limit(1);
				isFollowing = Boolean(f);
			}

			// Recently watched (last 6 logs).
			const recent = await db
				.select({ log, movie, tv })
				.from(log)
				.leftJoin(movie, eq(log.movieId, movie.tmdbId))
				.leftJoin(tv, eq(log.tvId, tv.tmdbId))
				.where(eq(log.userId, row.user.id))
				.orderBy(desc(log.watchedAt))
				.limit(6);

			// Recent reviews (3).
			const recentReviews = await db
				.select({ review, movie })
				.from(review)
				.leftJoin(movie, eq(review.movieId, movie.tmdbId))
				.where(and(eq(review.userId, row.user.id), eq(review.isPublic, true)))
				.orderBy(desc(review.publishedAt))
				.limit(3);

			// Popular lists (public only) — poster paths hydrated for profile list rows.
			const listRows = await db
				.select()
				.from(list)
				.where(and(eq(list.userId, row.user.id), eq(list.isPublic, true)))
				.orderBy(desc(list.likesCount), desc(list.updatedAt))
				.limit(6);
			const lists = await withCoverPosterPaths(listRows);

			// Pinned badges.
			const pinned = await db
				.select()
				.from(userBadge)
				.where(
					and(eq(userBadge.userId, row.user.id), eq(userBadge.isPinned, true)),
				)
				.limit(8);

			return {
				user: { id: row.user.id, name: row.user.name, image: row.user.image },
				profile: row.profile,
				stats: {
					followers: Number(followCount?.followers ?? 0),
					following: Number(followingCount?.following ?? 0),
				},
				isFollowing,
				recentlyWatched: recent,
				recentReviews,
				lists,
				pinnedBadges: pinned,
			};
		},
		{ params: t.Object({ handle: t.String() }) },
	);
