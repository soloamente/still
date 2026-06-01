import type { ContentVisibility } from "@still/db";
import {
	achievement,
	badge,
	db,
	follow,
	list,
	log,
	movie,
	profile,
	review,
	tv,
	user,
	userAchievement,
	userBadge,
} from "@still/db";
import { env } from "@still/env/server";
import { get, put } from "@vercel/blob";
import { and, desc, eq, gte, ilike, isNotNull, ne, or, sql } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { context } from "../context";
import {
	ACTIVITY_SIGNATURE_DAYS,
	buildActivitySignature,
} from "../lib/activity-signature";
import {
	contentVisibilityWhere,
	visibilitySchema,
} from "../lib/content-visibility";
import { fetchCreatorAnalyticsForUser } from "../lib/creator-analytics";
import {
	fetchCuratorSpotlightPatrons,
	resolveCuratorRecognition,
} from "../lib/creator-recognition";
import { withCoverPosterPaths } from "../lib/list-cover-posters";
import {
	isProfileAccentId,
	PROFILE_PREF_PROFILE_ACCENT,
	profileAccentHex,
} from "../lib/profile-appearance";
import {
	hydratePinnedReviews,
	validatePinnedReviewIdsForUser,
} from "../lib/profile-pinned-reviews";
import {
	normalizeProfileSearchQuery,
	rankProfileSearchHits,
} from "../lib/profile-search";
import { hit } from "../lib/rate-limit";
import { recomputeUserTasteSignature } from "../lib/recompute-user-taste-signature";
import { recordProductEvent } from "../lib/record-product-event";
import { routeBody } from "../lib/route-body";
import { sanitizeAppearancePreferences } from "../lib/sanitize-appearance-preferences";

type ProfileMePatchBody = {
	handle?: string;
	displayName?: string;
	bio?: string;
	pronouns?: string;
	location?: string;
	website?: string;
	bannerUrl?: string;
	accentColor?: string;
	favoriteMovieIds?: number[];
	sectionOrder?: string[];
	preferences?: Record<string, unknown>;
	isPrivate?: boolean;
	markOnboarded?: boolean;
	defaultVisibility?: ContentVisibility;
};

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
		async ({ body: rawBody, user, status }) => {
			if (!user) return status(401, "Sign in");
			if (!hit(`profile:update:${user.id}`, { limit: 20, windowMs: 60_000 }).ok)
				return status(429, "Slow down");
			const body = routeBody<ProfileMePatchBody>(rawBody);

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

			let preferencesForUpdate = mergedPreferences;
			if (mergedPreferences !== undefined) {
				const appearance = sanitizeAppearancePreferences(
					mergedPreferences,
					Boolean(existing?.isPro),
				);
				if (appearance.ok === false) {
					return status(appearance.status, appearance.error);
				}
				preferencesForUpdate = appearance.preferences;
			}

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
				preferences: preferencesForUpdate ?? undefined,
				isPrivate: body.isPrivate,
				onboardedAt: body.markOnboarded ? new Date() : undefined,
				...(body.defaultVisibility
					? { defaultVisibility: body.defaultVisibility }
					: {}),
			};

			// Strip undefineds — drizzle's set() won't ignore them otherwise.
			const set: Record<string, unknown> = {};
			for (const [k, v] of Object.entries(updates))
				if (v !== undefined) set[k] = v;

			// Pro profile accent preset mirrors into public `accentColor` for visitors.
			if (preferencesForUpdate !== undefined) {
				const accentPref = preferencesForUpdate[PROFILE_PREF_PROFILE_ACCENT];
				if (isProfileAccentId(accentPref)) {
					set.accentColor = profileAccentHex(accentPref);
				}
			}

			if (existing) {
				const [row] = await db
					.update(profile)
					.set(set)
					.where(eq(profile.userId, user.id))
					.returning();
				if (body.markOnboarded) {
					void recomputeUserTasteSignature(user.id).catch((err) => {
						console.error("[profiles/me] taste recompute failed", err);
					});
					if (!existing.onboardedAt) {
						void recordProductEvent(user.id, "onboarding.completed", {
							source: "profiles.me.patch",
						});
					}
				}
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
			if (body.markOnboarded) {
				void recomputeUserTasteSignature(user.id).catch((err) => {
					console.error("[profiles/me] taste recompute failed", err);
				});
				void recordProductEvent(user.id, "onboarding.completed", {
					source: "profiles.me.insert",
				});
			}
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
				defaultVisibility: t.Optional(visibilitySchema),
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
	.get("/me/creator-analytics", async ({ user, status }) => {
		if (!user) return status(401, "Sign in");
		const analytics = await fetchCreatorAnalyticsForUser(user.id);
		if (!analytics) return { eligible: false as const };
		return { eligible: true as const, analytics };
	})
	.post("/me/recompute-taste-signature", async ({ user, status }) => {
		if (!user) return status(401, "Sign in");
		if (
			!hit(`profile:taste:${user.id}`, { limit: 12, windowMs: 60 * 60_000 }).ok
		) {
			return status(429, "Slow down");
		}
		const payload = await recomputeUserTasteSignature(user.id);
		return payload;
	})
	/** Pin up to 3 signature reviews on profile hero (ST.3). */
	.patch(
		"/me/pins",
		async ({ body: rawBody, user, status }) => {
			if (!user) return status(401, "Sign in");
			if (!hit(`profile:pins:${user.id}`, { limit: 30, windowMs: 60_000 }).ok) {
				return status(429, "Slow down");
			}
			const body = routeBody<{ reviewIds: string[] }>(rawBody);
			const validated = await validatePinnedReviewIdsForUser(
				user.id,
				body.reviewIds,
			);
			if (!validated.ok) {
				return status(validated.status, validated.error);
			}
			const [row] = await db
				.update(profile)
				.set({ pinnedReviewIds: validated.reviewIds })
				.where(eq(profile.userId, user.id))
				.returning({ pinnedReviewIds: profile.pinnedReviewIds });
			return {
				pinnedReviewIds: row?.pinnedReviewIds ?? [],
			};
		},
		{
			body: t.Object({
				reviewIds: t.Array(t.String(), { maxItems: 3 }),
			}),
		},
	)
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
	 * Avatar upload: multipart form with field `file`. Persists to Vercel Blob
	 * and updates the auth `user.image` column (shown on profile + nav).
	 */
	.post("/me/avatar", async ({ request, user: authUser, status }) => {
		if (!authUser) return status(401, "Sign in");
		if (!env.BLOB_READ_WRITE_TOKEN) {
			return status(503, {
				error: "BLOB_READ_WRITE_TOKEN is not set",
				code: "BLOB_UNCONFIGURED",
				hint: "Add BLOB_READ_WRITE_TOKEN to apps/server .env (Vercel Blob read-write token).",
			});
		}
		if (
			!hit(`profile:avatar:${authUser.id}`, { limit: 10, windowMs: 60_000 }).ok
		)
			return status(429, "Slow down");

		const formData = await request.formData();
		const file = formData.get("file");
		if (!(file instanceof File)) return status(400, "Missing file");
		if (!file.type.startsWith("image/")) return status(400, "Image only");
		if (file.size > 5_000_000) return status(413, "File too large (max 5MB)");

		const key = `avatars/${authUser.id}/${Date.now()}-${encodeURIComponent(file.name)}`;
		let blob: { url: string };
		try {
			blob = await put(key, file, {
				access: env.BLOB_STORE_ACCESS,
				addRandomSuffix: false,
				token: env.BLOB_READ_WRITE_TOKEN,
			});
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			console.error("[profiles/me/avatar] put failed", err);
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

		await db
			.update(user)
			.set({ image: blob.url })
			.where(eq(user.id, authUser.id));

		return { url: blob.url };
	})
	/**
	 * Streams the signed-in user's portrait. Required when Blob objects are private
	 * (browser cannot load raw `user.image` URLs). Cookie-authenticated.
	 */
	.get("/me/avatar", async ({ user: authUser, status }) => {
		if (!authUser) return status(401, "Sign in");

		const [row] = await db
			.select({ image: user.image })
			.from(user)
			.where(eq(user.id, authUser.id))
			.limit(1);
		if (!row?.image) return status(404, "No avatar");

		if (!env.BLOB_READ_WRITE_TOKEN) {
			return status(503, "BLOB_READ_WRITE_TOKEN is not set");
		}

		try {
			const result = await get(row.image, {
				access: env.BLOB_STORE_ACCESS,
				token: env.BLOB_READ_WRITE_TOKEN,
			});
			if (!result || result.statusCode !== 200 || !result.stream) {
				return status(404, "Avatar not found");
			}
			return new Response(result.stream, {
				headers: {
					"Content-Type": result.blob.contentType,
					"Cache-Control": "private, no-cache",
				},
			});
		} catch (err) {
			console.error("[profiles/me/avatar] get failed", err);
			return status(502, "Avatar load failed");
		}
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
	/**
	 * Streams the profile user's portrait for `handle`. Matches `/banner/:handle`:
	 * Vercel Blob objects may be **private** (raw `user.image` URLs do not load in the browser).
	 * Non-blob URLs (OAuth headshots, etc.) are fetched server-side and streamed.
	 */
	.get(
		"/avatar/:handle",
		async ({ params, status }) => {
			const handle = params.handle.toLowerCase();
			const [row] = await db
				.select({ image: user.image })
				.from(profile)
				.leftJoin(user, eq(profile.userId, user.id))
				.where(eq(profile.handle, handle))
				.limit(1);
			const imageUrl = row?.image?.trim();
			if (!imageUrl) return status(404, "No avatar");

			const looksLikeVercelBlob = imageUrl.includes("blob.vercel-storage.com");

			if (looksLikeVercelBlob) {
				if (!env.BLOB_READ_WRITE_TOKEN) {
					return status(503, "BLOB_READ_WRITE_TOKEN is not set");
				}
				try {
					const result = await get(imageUrl, {
						access: env.BLOB_STORE_ACCESS,
						token: env.BLOB_READ_WRITE_TOKEN,
					});
					if (!result || result.statusCode !== 200 || !result.stream) {
						return status(404, "Avatar not found");
					}
					return new Response(result.stream, {
						headers: {
							"Content-Type": result.blob.contentType,
							"Cache-Control": "public, max-age=3600, s-maxage=86400",
						},
					});
				} catch (err) {
					console.error("[profiles/avatar] blob get failed", err);
					return status(502, "Avatar load failed");
				}
			}

			if (imageUrl.startsWith("https://") || imageUrl.startsWith("http://")) {
				try {
					const upstream = await fetch(imageUrl);
					if (!upstream.ok) return status(404, "Avatar not found");
					const contentType =
						upstream.headers.get("content-type") ?? "image/jpeg";
					return new Response(upstream.body, {
						headers: {
							"Content-Type": contentType,
							"Cache-Control": "public, max-age=3600, s-maxage=86400",
						},
					});
				} catch (err) {
					console.error("[profiles/avatar] fetch failed", err);
					return status(502, "Avatar load failed");
				}
			}

			return status(404, "Avatar not found");
		},
		{ params: t.Object({ handle: t.String() }) },
	)
	/** Public profile typeahead — following/mutual boosted when viewer is signed in. */
	.get(
		"/search",
		async ({ query, user: viewer, status }) => {
			const q = normalizeProfileSearchQuery(query.q ?? "");
			if (!q) return status(400, "Query required");
			const limit = Math.min(
				Math.max(Number.parseInt(query.limit ?? "8", 10) || 8, 1),
				20,
			);
			const pattern = `%${q}%`;
			const handlePrefix = `${q}%`;
			const rows = await db
				.select({
					userId: user.id,
					handle: profile.handle,
					displayName: profile.displayName,
					image: user.image,
					isMutual: follow.isMutual,
					followerId: follow.followerId,
				})
				.from(profile)
				.innerJoin(user, eq(profile.userId, user.id))
				.leftJoin(
					follow,
					viewer
						? and(
								eq(follow.followerId, viewer.id),
								eq(follow.followingId, profile.userId),
							)
						: sql`false`,
				)
				.where(
					and(
						eq(profile.isPrivate, false),
						or(
							ilike(profile.handle, handlePrefix),
							ilike(profile.displayName, pattern),
						),
						...(viewer ? [ne(profile.userId, viewer.id)] : []),
					),
				)
				.limit(50);
			return rankProfileSearchHits(
				rows.map((row) => ({
					userId: row.userId,
					handle: row.handle,
					displayName: row.displayName,
					image: row.image,
					isFollowing: row.followerId != null,
					isMutual: row.isMutual ?? false,
				})),
				q,
			).slice(0, limit);
		},
		{
			query: t.Object({
				q: t.String(),
				limit: t.Optional(t.String()),
			}),
		},
	)
	.get(
		"/curators/spotlight",
		async ({ query }) => {
			const limit = Math.min(Number(query.limit ?? 6), 12);
			const patrons = await fetchCuratorSpotlightPatrons(limit);
			return { patrons };
		},
		{ query: t.Object({ limit: t.Optional(t.String()) }) },
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
	/** Diary heatmap for profile — ST.2 activity signature. */
	.get(
		"/:handle/activity-signature",
		async ({ params, user: viewer, status }) => {
			const handle = params.handle.toLowerCase();
			const [row] = await db
				.select({ userId: profile.userId, isPrivate: profile.isPrivate })
				.from(profile)
				.where(eq(profile.handle, handle))
				.limit(1);
			if (!row) return status(404, "Not found");

			const isOwner = viewer?.id === row.userId;
			if (row.isPrivate && !isOwner) return status(404, "Not found");

			const windowStart = new Date();
			windowStart.setUTCDate(
				windowStart.getUTCDate() - (ACTIVITY_SIGNATURE_DAYS - 1),
			);
			windowStart.setUTCHours(0, 0, 0, 0);

			const rows = await db
				.select({ watchedAt: log.watchedAt })
				.from(log)
				.where(
					and(eq(log.userId, row.userId), gte(log.watchedAt, windowStart)),
				);

			return buildActivitySignature(rows.map((r) => r.watchedAt));
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

			// neon-http does one HTTP round trip per query, so every independent
			// read below is dispatched concurrently — otherwise the handler stacks
			// ~10 sequential round trips and the profile page stalls on load.
			const targetUserId = row.user.id;
			const viewerId = viewer?.id ?? null;
			// Full watch ledger for profile Movies / TV grids (deduped per title on the web app).
			const PROFILE_WATCH_LEDGER_LIMIT = 500;

			const [
				followCount,
				followingCount,
				isFollowing,
				recent,
				recentReviews,
				pinnedReviews,
				lists,
				pinned,
				curator,
				earnedBadges,
				unlockedAchievements,
			] = await Promise.all([
				db
					.select({
						followers: sql<number>`count(distinct ${follow.followerId})`,
					})
					.from(follow)
					.where(eq(follow.followingId, targetUserId))
					.then((r) => r[0]),
				db
					.select({
						following: sql<number>`count(distinct ${follow.followingId})`,
					})
					.from(follow)
					.where(eq(follow.followerId, targetUserId))
					.then((r) => r[0]),
				// Is the viewer following this profile?
				viewerId
					? db
							.select()
							.from(follow)
							.where(
								and(
									eq(follow.followerId, viewerId),
									eq(follow.followingId, targetUserId),
								),
							)
							.limit(1)
							.then((r) => Boolean(r[0]))
					: Promise.resolve(false),
				db
					.select({ log, movie, tv })
					.from(log)
					.leftJoin(movie, eq(log.movieId, movie.tmdbId))
					.leftJoin(tv, eq(log.tvId, tv.tmdbId))
					.where(
						and(
							eq(log.userId, targetUserId),
							contentVisibilityWhere(viewerId, log.userId, log.visibility),
						),
					)
					.orderBy(desc(log.watchedAt))
					.limit(PROFILE_WATCH_LEDGER_LIMIT),
				// Recent reviews (3).
				db
					.select({ review, movie })
					.from(review)
					.leftJoin(movie, eq(review.movieId, movie.tmdbId))
					.where(
						and(
							eq(review.userId, targetUserId),
							contentVisibilityWhere(
								viewerId,
								review.userId,
								review.visibility,
							),
						),
					)
					.orderBy(desc(review.publishedAt))
					.limit(3),
				hydratePinnedReviews(targetUserId, row.profile.pinnedReviewIds),
				// Popular lists (public only) — poster paths hydrated for profile list rows.
				db
					.select()
					.from(list)
					.where(and(eq(list.userId, targetUserId), eq(list.isPublic, true)))
					.orderBy(desc(list.likesCount), desc(list.updatedAt))
					.limit(6)
					.then((listRows) => withCoverPosterPaths(listRows)),
				// Pinned badges.
				db
					.select()
					.from(userBadge)
					.where(
						and(
							eq(userBadge.userId, targetUserId),
							eq(userBadge.isPinned, true),
						),
					)
					.limit(8),
				resolveCuratorRecognition(targetUserId),
				// Folded in so the profile page renders from one round trip instead of
				// firing separate /badges/of and /achievements/of calls afterward.
				db
					.select({ userBadge, badge })
					.from(userBadge)
					.leftJoin(badge, eq(userBadge.badgeId, badge.id))
					.where(eq(userBadge.userId, targetUserId))
					.orderBy(desc(userBadge.awardedAt)),
				db
					.select({ userAchievement, achievement })
					.from(userAchievement)
					.leftJoin(
						achievement,
						eq(userAchievement.achievementId, achievement.id),
					)
					.where(
						and(
							eq(userAchievement.userId, targetUserId),
							isNotNull(userAchievement.unlockedAt),
						),
					)
					.orderBy(desc(userAchievement.unlockedAt)),
			]);

			return {
				user: { id: row.user.id, name: row.user.name, image: row.user.image },
				profile: row.profile,
				stats: {
					followers: Number(followCount?.followers ?? 0),
					following: Number(followingCount?.following ?? 0),
				},
				creator: curator,
				isFollowing,
				recentlyWatched: recent,
				recentReviews,
				pinnedReviews,
				lists,
				pinnedBadges: pinned,
				earnedBadges,
				unlockedAchievements,
			};
		},
		{ params: t.Object({ handle: t.String() }) },
	);
