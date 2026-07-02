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
import {
	and,
	asc,
	count,
	desc,
	eq,
	gte,
	ilike,
	isNotNull,
	isNull,
	ne,
	or,
	sql,
} from "drizzle-orm";
import { Elysia, t } from "elysia";
import { context } from "../context";
import {
	ACTIVITY_SIGNATURE_DAYS,
	buildActivitySignature,
} from "../lib/activity-signature";
import { patronMeetsAdultAgeGate } from "../lib/adult-content-age-gate";
import { readShowAdultContentPref } from "../lib/adult-content-policy";
import { movieNotAdultSql, tvNotAdultSql } from "../lib/adult-content-sql";
import { getShowAdultContentForUser } from "../lib/adult-content-user-pref";
import { getImageAsset, putImageAsset } from "../lib/asset-store";
import { backfillMissingListingPosters } from "../lib/backfill-listing-posters";
import {
	contentVisibilityWhere,
	visibilitySchema,
} from "../lib/content-visibility";
import { fetchCreatorAnalyticsForUser } from "../lib/creator-analytics";
import {
	fetchCuratorSpotlightPatrons,
	resolveCuratorRecognition,
} from "../lib/creator-recognition";
import {
	fetchDiaryLogCountsForUserIds,
	resolveDiaryMetalTier,
} from "../lib/diary-metal-tier";
import { withCoverPosterPaths } from "../lib/list-cover-posters";
import { resolveListingPosterPath } from "../lib/listing-poster-path";
import { fetchProfilePinnedQuotes } from "../lib/listing-quote-saves-query";
import {
	grandfatherOnboardedTimestamp,
	shouldGrandfatherLegacyOnboarding,
} from "../lib/onboarding-grandfather";
import {
	isProfileAccentId,
	PROFILE_PREF_PROFILE_ACCENT,
	profileAccentHex,
} from "../lib/profile-appearance";
import { sanitizeProfileAudioPreferences } from "../lib/profile-audio-preferences";
import {
	formatBirthdayDisplayPublic,
	parseProfileBirthDate,
	profileBirthDateToIso,
	readShowBirthDateOnProfilePref,
} from "../lib/profile-birth-date";
import {
	filmographyOffset,
	filmographyTotalPages,
	parseFilmographyFavorites,
	parseFilmographyLimit,
	parseFilmographyMedia,
	parseFilmographyOrder,
	parseFilmographyPage,
	parseFilmographyVenue,
} from "../lib/profile-filmography-query";
import {
	isAnimatedGifUpload,
	mergeAvatarAnimationPref,
	mergeBannerAnimationPref,
	PRO_ANIMATED_MEDIA_REQUIRED,
	readAvatarIsAnimatedPref,
} from "../lib/profile-media";
import { validatePinnedQuoteSaveIdsForUser } from "../lib/profile-pinned-quotes";
import {
	hydratePinnedReviews,
	validatePinnedReviewIdsForUser,
} from "../lib/profile-pinned-reviews";
import {
	fetchProfileReviewsCount,
	fetchProfileReviewsPage,
	parseProfileReviewsLimit,
	parseProfileReviewsPage,
	resolveProfileReviewsAccess,
} from "../lib/profile-reviews-query";
import {
	normalizeProfileSearchQuery,
	rankProfileSearchHits,
} from "../lib/profile-search";
import {
	hydrateShowcaseTiles,
	validateShowcaseItemsForUser,
} from "../lib/profile-showcase";
import { hit } from "../lib/rate-limit";
import { recomputeUserTasteSignature } from "../lib/recompute-user-taste-signature";
import { recordProductEvent } from "../lib/record-product-event";
import { formField } from "../lib/request-form";
import {
	assertEmailVerified,
	EmailVerificationRequiredError,
	emailVerificationRequiredBody,
} from "../lib/require-verified-email";
import { routeBody } from "../lib/route-body";
import { sanitizeAppearancePreferences } from "../lib/sanitize-appearance-preferences";
import { ensureFreshTasteSignature } from "../lib/taste-signature-cache";
import {
	fetchYearInReviewForUser,
	parseYearInReviewYear,
} from "../lib/year-in-review";

type ProfileMePatchBody = {
	handle?: string;
	displayName?: string;
	bio?: string;
	pronouns?: string;
	location?: string;
	website?: string;
	birthDate?: string | null;
	bannerUrl?: string;
	accentColor?: string;
	favoriteMovieIds?: number[];
	sectionOrder?: string[];
	preferences?: Record<string, unknown>;
	isPrivate?: boolean;
	markOnboarded?: boolean;
	defaultVisibility?: ContentVisibility;
};

import { HANDLE_RE } from "../lib/handle-re";

export { HANDLE_RE };

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

			if (body.isPrivate === false || body.defaultVisibility === "public") {
				try {
					assertEmailVerified(user);
				} catch (e) {
					if (e instanceof EmailVerificationRequiredError) {
						return status(403, emailVerificationRequiredBody());
					}
					throw e;
				}
			}

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

			const existingPreferences =
				(existing?.preferences as Record<string, unknown> | undefined) ?? {};

			if (preferencesForUpdate !== undefined) {
				// Normalize nested audio prefs and keep legacy theaterAudio in sync.
				preferencesForUpdate = sanitizeProfileAudioPreferences(
					existingPreferences,
					preferencesForUpdate,
				);
			}

			const effectivePreferences = preferencesForUpdate ?? existingPreferences;
			const adultPrefOn = readShowAdultContentPref(effectivePreferences);

			let birthDateForUpdate: string | null | undefined;
			if (body.birthDate !== undefined) {
				if (body.birthDate === null || body.birthDate === "") {
					if (adultPrefOn) {
						// Clearing the date of birth removes the age-gate basis, so turn
						// adult content off rather than rejecting the whole update — a
						// hard 400 here deadlocks saving anything else (e.g. an avatar).
						preferencesForUpdate = {
							...effectivePreferences,
							showAdultContent: false,
						};
					}
					birthDateForUpdate = null;
				} else {
					const parsed = parseProfileBirthDate(body.birthDate);
					if (!parsed) {
						return status(400, "Invalid date of birth");
					}
					if (!patronMeetsAdultAgeGate(parsed)) {
						return status(400, "You must be at least 18 years old");
					}
					birthDateForUpdate = parsed;
				}
			}

			const existingBirthIso = profileBirthDateToIso(existing?.birthDate);
			if (
				adultPrefOn &&
				birthDateForUpdate === undefined &&
				existingBirthIso &&
				!patronMeetsAdultAgeGate(existingBirthIso)
			) {
				preferencesForUpdate = {
					...effectivePreferences,
					showAdultContent: false,
				};
			}

			if (
				preferencesForUpdate !== undefined &&
				birthDateForUpdate &&
				!patronMeetsAdultAgeGate(birthDateForUpdate) &&
				readShowAdultContentPref(preferencesForUpdate)
			) {
				preferencesForUpdate = {
					...preferencesForUpdate,
					showAdultContent: false,
				};
			}

			const updates = {
				handle: body.handle?.toLowerCase(),
				displayName: body.displayName,
				bio: body.bio,
				pronouns: body.pronouns,
				location: body.location,
				website: body.website,
				birthDate:
					birthDateForUpdate === undefined
						? undefined
						: birthDateForUpdate === null
							? null
							: birthDateForUpdate,
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
				return {
					...row,
					birthDate: profileBirthDateToIso(row.birthDate),
				};
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
			return {
				...row,
				birthDate: profileBirthDateToIso(row?.birthDate),
			};
		},
		{
			body: t.Object({
				handle: t.Optional(t.String({ minLength: 2, maxLength: 24 })),
				displayName: t.Optional(t.String({ minLength: 1, maxLength: 60 })),
				bio: t.Optional(t.String({ maxLength: 600 })),
				pronouns: t.Optional(t.String({ maxLength: 30 })),
				location: t.Optional(t.String({ maxLength: 60 })),
				website: t.Optional(t.String({ maxLength: 200 })),
				birthDate: t.Optional(t.Union([t.String(), t.Null()])),
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
	.get("/me", async ({ user: authUser, status }) => {
		if (!authUser) return status(401, "Sign in");
		const [row] = await db
			.select()
			.from(profile)
			.where(eq(profile.userId, authUser.id))
			.limit(1);
		if (!row) return null;
		const [logCountRow] = await db
			.select({ c: count(log.id) })
			.from(log)
			.where(and(eq(log.userId, authUser.id), isNull(log.removedAt)));
		const diaryLogCount = Number(logCountRow?.c ?? 0);

		// Fresh portrait for nav chrome — session cookies can lag after blob upload.
		const [userRow] = await db
			.select({ image: user.image })
			.from(user)
			.where(eq(user.id, authUser.id))
			.limit(1);
		const portraitImage = userRow?.image ?? null;

		// One-time legacy backfill — v3 gate uses onboarded_at; pre-v3 patrons never got it.
		if (shouldGrandfatherLegacyOnboarding(row, diaryLogCount)) {
			const [updated] = await db
				.update(profile)
				.set({
					onboardedAt: grandfatherOnboardedTimestamp(row),
				})
				.where(eq(profile.userId, authUser.id))
				.returning();
			if (updated) {
				return {
					...updated,
					image: portraitImage,
					birthDate: profileBirthDateToIso(updated.birthDate),
					diaryMetalTier: resolveDiaryMetalTier(diaryLogCount),
				};
			}
		}

		return {
			...row,
			image: portraitImage,
			birthDate: profileBirthDateToIso(row.birthDate),
			diaryMetalTier: resolveDiaryMetalTier(diaryLogCount),
		};
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
			try {
				assertEmailVerified(user);
			} catch (e) {
				if (e instanceof EmailVerificationRequiredError) {
					return status(403, emailVerificationRequiredBody());
				}
				throw e;
			}
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
	/** Pin up to 3 saved quotes on profile (from `/quotes` collection). */
	.patch(
		"/me/pins/quotes",
		async ({ body: rawBody, user, status }) => {
			if (!user) return status(401, "Sign in");
			try {
				assertEmailVerified(user);
			} catch (e) {
				if (e instanceof EmailVerificationRequiredError) {
					return status(403, emailVerificationRequiredBody());
				}
				throw e;
			}
			if (!hit(`profile:pins:${user.id}`, { limit: 30, windowMs: 60_000 }).ok) {
				return status(429, "Slow down");
			}
			const body = routeBody<{ quoteSaveIds: string[] }>(rawBody);
			const validated = await validatePinnedQuoteSaveIdsForUser(
				user.id,
				body.quoteSaveIds,
			);
			if (!validated.ok) {
				return status(validated.status, validated.error);
			}
			const [row] = await db
				.update(profile)
				.set({ pinnedQuoteSaveIds: validated.quoteSaveIds })
				.where(eq(profile.userId, user.id))
				.returning({ pinnedQuoteSaveIds: profile.pinnedQuoteSaveIds });
			return {
				pinnedQuoteSaveIds: row?.pinnedQuoteSaveIds ?? [],
			};
		},
		{
			body: t.Object({
				quoteSaveIds: t.Array(t.String(), { maxItems: 3 }),
			}),
		},
	)
	/** Patron-curated showcase strip — up to 4 film · TV · review slots. */
	.patch(
		"/me/showcase",
		async ({ body: rawBody, user, status }) => {
			if (!user) return status(401, "Sign in");
			try {
				assertEmailVerified(user);
			} catch (e) {
				if (e instanceof EmailVerificationRequiredError) {
					return status(403, emailVerificationRequiredBody());
				}
				throw e;
			}
			if (
				!hit(`profile:showcase:${user.id}`, { limit: 30, windowMs: 60_000 }).ok
			) {
				return status(429, "Slow down");
			}

			const body = routeBody<{ items: unknown }>(rawBody);
			const validated = await validateShowcaseItemsForUser(user.id, body.items);
			if (!validated.ok) {
				return status(validated.status, validated.error);
			}

			const [row] = await db
				.update(profile)
				.set({ showcaseItems: validated.items })
				.where(eq(profile.userId, user.id))
				.returning({ showcaseItems: profile.showcaseItems });

			void recordProductEvent(user.id, "showcase.edited", {
				count: validated.items.length,
			});

			return {
				showcaseItems: row?.showcaseItems ?? [],
			};
		},
		{
			body: t.Object({
				items: t.Array(
					t.Object({
						kind: t.Union([
							t.Literal("movie"),
							t.Literal("tv"),
							t.Literal("review"),
						]),
						id: t.Union([t.Number(), t.String()]),
						logScope: t.Optional(
							t.Union([
								t.Literal("show"),
								t.Literal("season"),
								t.Literal("episode"),
							]),
						),
						seasonNumber: t.Optional(t.Number()),
						episodeNumber: t.Optional(t.Number()),
					}),
					{ maxItems: 4 },
				),
			}),
		},
	)
	/**
	 * Banner upload: multipart form with field `file`. Uses Vercel Blob with
	 * `BLOB_READ_WRITE_TOKEN` from **server** env (apps/server/.env), not Next.js.
	 */
	.post("/me/banner", async ({ body, user, status }) => {
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

		const file = formField(body, "file");
		if (!(file instanceof File)) return status(400, "Missing file");
		if (!file.type.startsWith("image/")) return status(400, "Image only");
		if (file.size > 4_000_000) return status(413, "File too large (max 4MB)");

		const wantsAnimated = isAnimatedGifUpload(file);

		const [profileRow] = await db
			.select({ isPro: profile.isPro, preferences: profile.preferences })
			.from(profile)
			.where(eq(profile.userId, user.id))
			.limit(1);
		if (!profileRow) return status(400, "Profile not found");

		// Pro gate: animated GIF banners require Sense Pro before blob upload.
		if (wantsAnimated && !profileRow.isPro) {
			return status(403, {
				error: "Animated banner requires Sense Pro",
				code: PRO_ANIMATED_MEDIA_REQUIRED,
			});
		}

		const key = `banners/${user.id}/${Date.now()}-${encodeURIComponent(file.name)}`;
		const upload = await putImageAsset(key, file);
		if ("error" in upload) {
			console.error("[profiles/me/banner] upload failed", upload);
			return status(502, {
				error: upload.error,
				code: upload.code,
				hint: upload.hint,
			});
		}

		const mergedPrefs = mergeBannerAnimationPref(
			(profileRow.preferences as Record<string, unknown>) ?? {},
			wantsAnimated,
		);
		const [updated] = await db
			.update(profile)
			.set({ bannerUrl: upload.value, preferences: mergedPrefs })
			.where(eq(profile.userId, user.id))
			.returning({ bannerUrl: profile.bannerUrl });
		if (!updated?.bannerUrl) {
			console.error("[profiles/me/banner] profile row not updated", user.id);
			return status(500, { error: "Failed to save banner to profile" });
		}
		return { url: updated.bannerUrl };
	})
	/**
	 * Avatar upload: multipart form with field `file`. Persists to Vercel Blob
	 * and updates the auth `user.image` column (shown on profile + nav).
	 */
	.post("/me/avatar", async ({ body, user: authUser, status }) => {
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

		const file = formField(body, "file");
		if (!(file instanceof File)) return status(400, "Missing file");
		if (!file.type.startsWith("image/")) return status(400, "Image only");
		if (file.size > 4_000_000) return status(413, "File too large (max 4MB)");

		const wantsAnimated = isAnimatedGifUpload(file);

		const [profileRow] = await db
			.select({ isPro: profile.isPro, preferences: profile.preferences })
			.from(profile)
			.where(eq(profile.userId, authUser.id))
			.limit(1);
		if (!profileRow) return status(400, "Profile not found");

		// Pro gate: animated GIF portraits require Sense Pro before blob upload.
		if (wantsAnimated && !profileRow.isPro) {
			return status(403, {
				error: "Animated portrait requires Sense Pro",
				code: PRO_ANIMATED_MEDIA_REQUIRED,
			});
		}

		const key = `avatars/${authUser.id}/${Date.now()}-${encodeURIComponent(file.name)}`;
		const upload = await putImageAsset(key, file);
		if ("error" in upload) {
			console.error("[profiles/me/avatar] upload failed", upload);
			return status(502, {
				error: upload.error,
				code: upload.code,
				hint: upload.hint,
			});
		}

		const [updated] = await db
			.update(user)
			.set({ image: upload.value })
			.where(eq(user.id, authUser.id))
			.returning({ image: user.image });
		if (!updated?.image) {
			console.error("[profiles/me/avatar] user row not updated", authUser.id);
			return status(500, { error: "Failed to save portrait" });
		}

		// Avatar bytes live on user.image; animation flag lives on profile.preferences.
		const mergedPrefs = mergeAvatarAnimationPref(
			(profileRow.preferences as Record<string, unknown>) ?? {},
			wantsAnimated,
		);
		await db
			.update(profile)
			.set({ preferences: mergedPrefs })
			.where(eq(profile.userId, authUser.id));

		return { url: updated.image };
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

		const asset = await getImageAsset(row.image);
		if (!asset) return status(404, "Avatar not found");
		return new Response(asset.body, {
			headers: {
				"Content-Type": asset.contentType,
				"Cache-Control": "private, no-cache",
			},
		});
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

			const asset = await getImageAsset(row.bannerUrl);
			if (!asset) return status(404, "Banner not found");
			return new Response(asset.body, {
				headers: {
					"Content-Type": asset.contentType,
					"Cache-Control": "public, max-age=3600, s-maxage=86400",
				},
			});
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

			const asset = await getImageAsset(imageUrl);
			if (!asset) return status(404, "Avatar not found");
			return new Response(asset.body, {
				headers: {
					"Content-Type": asset.contentType,
					"Cache-Control": "public, max-age=3600, s-maxage=86400",
				},
			});
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
					preferences: profile.preferences,
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
			const logCounts = await fetchDiaryLogCountsForUserIds(
				rows.map((row) => row.userId),
			);
			return rankProfileSearchHits(
				rows.map((row) => ({
					userId: row.userId,
					handle: row.handle,
					displayName: row.displayName,
					image: row.image,
					avatarIsAnimated: readAvatarIsAnimatedPref(
						row.preferences as Record<string, unknown> | null,
					),
					diaryMetalTier: resolveDiaryMetalTier(logCounts.get(row.userId) ?? 0),
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
	// Lightweight availability check for signup + onboarding (own handle counts as free).
	.get(
		"/check-handle/:handle",
		async ({ params, user }) => {
			const handle = params.handle.toLowerCase();
			if (!HANDLE_RE.test(handle))
				return { available: false, reason: "format" as const };
			const [taken] = await db
				.select({ userId: profile.userId })
				.from(profile)
				.where(eq(profile.handle, handle))
				.limit(1);
			if (!taken) {
				return { available: true, reason: "ok" as const };
			}
			if (user?.id === taken.userId) {
				return { available: true, reason: "yours" as const };
			}
			return { available: false, reason: "taken" as const };
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
					and(
						eq(log.userId, row.userId),
						isNull(log.removedAt),
						gte(log.watchedAt, windowStart),
					),
				);

			return buildActivitySignature(rows.map((r) => r.watchedAt));
		},
		{ params: t.Object({ handle: t.String() }) },
	)
	/** Pinned saved quotes for profile strip — owner sees all visibilities; visitors public only. */
	.get(
		"/:handle/quotes",
		async ({ params, query, user: viewer, status }) => {
			const handle = params.handle.toLowerCase();
			const [row] = await db
				.select({
					userId: profile.userId,
					isPrivate: profile.isPrivate,
					pinnedQuoteSaveIds: profile.pinnedQuoteSaveIds,
				})
				.from(profile)
				.where(eq(profile.handle, handle))
				.limit(1);
			if (!row) return status(404, "Not found");

			const isOwner = viewer?.id === row.userId;
			if (row.isPrivate && !isOwner) return status(404, "Not found");

			return fetchProfilePinnedQuotes({
				userId: row.userId,
				rawSaveIds: row.pinnedQuoteSaveIds,
				publicOnly: !isOwner,
				page: query.page,
				limit: query.limit,
				kind: query.kind,
			});
		},
		{
			params: t.Object({ handle: t.String() }),
			query: t.Object({
				page: t.Optional(t.String()),
				limit: t.Optional(t.String()),
				kind: t.Optional(t.String()),
			}),
		},
	)
	/**
	 * Paginated filmography for the Movies / TV profile grids. When `venue` is set,
	 * dedup keeps the newest log per title **within that venue slice** (not the
	 * globally newest log), then favorites filter, order, and paginate.
	 */
	.get(
		"/:handle/filmography",
		async ({ params, query, user: viewer, status }) => {
			const handle = params.handle.toLowerCase();
			const [row] = await db
				.select({ userId: profile.userId, isPrivate: profile.isPrivate })
				.from(profile)
				.where(eq(profile.handle, handle))
				.limit(1);
			if (!row) return status(404, "Not found");
			const viewerId = viewer?.id ?? null;
			const isOwner = viewerId === row.userId;
			if (row.isPrivate && !isOwner) return status(404, "Not found");

			const media = parseFilmographyMedia(query.media);
			const order = parseFilmographyOrder(query.order);
			const venue = parseFilmographyVenue(query.venue);
			const favorites = parseFilmographyFavorites(query.favorites);
			const page = parseFilmographyPage(query.page);
			const limit = parseFilmographyLimit(query.limit);
			const offset = filmographyOffset(page, limit);
			const showAdultContent = await getShowAdultContentForUser(viewerId);

			const isTv = media === "tv";
			const idCol = isTv ? log.tvId : log.movieId;
			const listing = isTv ? tv : movie;

			// Venue slice before dedup — keeps the newest in-venue log per title so
			// "Latest seen" + "At home" reflects the latest at-home watch, not the
			// globally newest log that may belong to the other venue.
			const venueLogWhere = venue
				? or(
						eq(log.watchVenue, venue),
						sql`${log.watchVenue} not in ('theaters','streaming')`,
					)
				: undefined;

			// Newest log per title within the active slice (DISTINCT ON media id).
			const deduped = db
				.selectDistinctOn([idCol], {
					logId: log.id,
					watchedAt: log.watchedAt,
					createdAt: log.createdAt,
					rating: log.rating,
					liked: log.liked,
					watchVenue: log.watchVenue,
					movieId: log.movieId,
					tvId: log.tvId,
					tmdbId: listing.tmdbId,
					title: listing.title,
					posterPath: listing.posterPath,
					listingTmdbJson: listing.tmdbJson,
				})
				.from(log)
				.innerJoin(listing, eq(idCol, listing.tmdbId))
				.where(
					and(
						eq(log.userId, row.userId),
						isNull(log.removedAt),
						isNotNull(idCol),
						contentVisibilityWhere(viewerId, log.userId, log.visibility),
						isTv
							? tvNotAdultSql(showAdultContent)
							: movieNotAdultSql(showAdultContent),
						venueLogWhere,
					),
				)
				.orderBy(idCol, desc(log.watchedAt), desc(log.createdAt), desc(log.id))
				.as("dedup");

			const favWhere = favorites ? eq(deduped.liked, true) : undefined;

			const orderBy =
				order === "earliest"
					? [
							asc(deduped.watchedAt),
							asc(deduped.createdAt),
							asc(deduped.tmdbId),
						]
					: order === "title"
						? [asc(deduped.title), asc(deduped.tmdbId)]
						: [
								desc(deduped.watchedAt),
								desc(deduped.createdAt),
								asc(deduped.tmdbId),
							];

			const [rows, totalRow, venueCountRow] = await Promise.all([
				db
					.select({
						logId: deduped.logId,
						watchedAt: deduped.watchedAt,
						rating: deduped.rating,
						liked: deduped.liked,
						watchVenue: deduped.watchVenue,
						movieId: deduped.movieId,
						tvId: deduped.tvId,
						tmdbId: deduped.tmdbId,
						title: deduped.title,
						posterPath: deduped.posterPath,
						listingTmdbJson: deduped.listingTmdbJson,
					})
					.from(deduped)
					.where(favWhere)
					.orderBy(...orderBy)
					.limit(limit)
					.offset(offset),
				db.select({ total: count() }).from(deduped).where(favWhere),
				db.select({ total: count() }).from(deduped),
			]);

			const total = Number(totalRow[0]?.total ?? 0);

			// Resolve artwork from column or cached TMDb JSON; backfill remaining gaps
			// so profile grids match detail pages after a single load.
			const resolvedPosters = rows.map((r) =>
				resolveListingPosterPath(r.posterPath, r.listingTmdbJson),
			);
			const idsNeedingBackfill = rows
				.filter((_r, index) => resolvedPosters[index] == null)
				.map((r) => r.tmdbId);
			const backfilledPosters = await backfillMissingListingPosters(
				isTv ? "tv" : "movie",
				idsNeedingBackfill,
			);

			const results = rows.map((r, index) => {
				const posterPath =
					resolvedPosters[index] ?? backfilledPosters.get(r.tmdbId) ?? null;
				return {
					log: {
						id: r.logId,
						watchedAt: r.watchedAt,
						rating: r.rating,
						liked: r.liked,
						watchVenue: r.watchVenue,
					},
					movie: isTv ? null : { tmdbId: r.tmdbId, title: r.title, posterPath },
					tv: isTv ? { tmdbId: r.tmdbId, title: r.title, posterPath } : null,
				};
			});

			const venueCountForMedia = Number(venueCountRow[0]?.total ?? 0);
			return {
				results,
				total_pages: filmographyTotalPages(total, limit),
				total_results: total,
				venueCounts: {
					movies: isTv ? 0 : venueCountForMedia,
					tv: isTv ? venueCountForMedia : 0,
				},
			};
		},
		{
			params: t.Object({ handle: t.String() }),
			query: t.Object({
				media: t.Optional(t.String()),
				order: t.Optional(t.String()),
				venue: t.Optional(t.String()),
				favorites: t.Optional(t.String()),
				page: t.Optional(t.String()),
				limit: t.Optional(t.String()),
			}),
		},
	)
	/** Paginated published reviews for the profile **Reviews** tab. */
	.get(
		"/:handle/reviews",
		async ({ params, query, user: viewer, status }) => {
			const viewerId = viewer?.id ?? null;
			const access = await resolveProfileReviewsAccess(params.handle, viewerId);
			if (!access.ok) return status(access.status, access.error);

			const page = parseProfileReviewsPage(query.page);
			const limit = parseProfileReviewsLimit(query.limit);
			const payload = await fetchProfileReviewsPage({
				userId: access.userId,
				viewerId,
				page,
				limit,
			});

			return {
				results: payload.results,
				total_pages: payload.totalPages,
				total_results: payload.total,
			};
		},
		{
			params: t.Object({ handle: t.String() }),
			query: t.Object({
				page: t.Optional(t.String()),
				limit: t.Optional(t.String()),
			}),
		},
	)
	/**
	 * Public Wrapped stats for share previews — same payload as `/api/me/year/:year`
	 * when the profile is public (404 for private non-owners).
	 */
	.get(
		"/:handle/year/:year",
		async ({ params, user: viewer, status }) => {
			const handle = params.handle.toLowerCase();
			const year = parseYearInReviewYear(params.year);
			if (year == null) return status(400, "Invalid year");

			const [row] = await db
				.select({ userId: profile.userId, isPrivate: profile.isPrivate })
				.from(profile)
				.where(eq(profile.handle, handle))
				.limit(1);
			if (!row) return status(404, "Not found");

			const viewerId = viewer?.id ?? null;
			const isOwner = viewerId === row.userId;
			if (row.isPrivate && !isOwner) return status(404, "Not found");

			return fetchYearInReviewForUser(row.userId, year);
		},
		{
			params: t.Object({ handle: t.String(), year: t.String() }),
		},
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

			// Distinct-title counts for tab availability + count lines (replaces the
			// old 500-row ledger). Newest-log-per-title dedup, viewer visibility applied.
			const dedupMovies = db
				.selectDistinctOn([log.movieId], { liked: log.liked })
				.from(log)
				.where(
					and(
						eq(log.userId, targetUserId),
						isNull(log.removedAt),
						isNotNull(log.movieId),
						contentVisibilityWhere(viewerId, log.userId, log.visibility),
					),
				)
				.orderBy(log.movieId, desc(log.watchedAt))
				.as("dedup_movies");
			const dedupTv = db
				.selectDistinctOn([log.tvId], { liked: log.liked })
				.from(log)
				.where(
					and(
						eq(log.userId, targetUserId),
						isNull(log.removedAt),
						isNotNull(log.tvId),
						contentVisibilityWhere(viewerId, log.userId, log.visibility),
					),
				)
				.orderBy(log.tvId, desc(log.watchedAt))
				.as("dedup_tv");

			const filmographyCountsPromise = Promise.all([
				db.select({ c: count() }).from(dedupMovies),
				db.select({ c: count() }).from(dedupTv),
				db
					.select({ c: count() })
					.from(dedupMovies)
					.where(eq(dedupMovies.liked, true)),
				db.select({ c: count() }).from(dedupTv).where(eq(dedupTv.liked, true)),
				fetchProfileReviewsCount(targetUserId, viewerId),
			]).then(([m, tvc, lm, ltv, reviews]) => ({
				movies: Number(m[0]?.c ?? 0),
				tv: Number(tvc[0]?.c ?? 0),
				likedMovies: Number(lm[0]?.c ?? 0),
				likedTv: Number(ltv[0]?.c ?? 0),
				reviews,
			}));

			const cachedStats = row.profile.statsCache as {
				followers?: number;
				following?: number;
				logCount?: number;
			} | null;
			const hasCachedFollowCounts =
				cachedStats != null &&
				typeof cachedStats.followers === "number" &&
				typeof cachedStats.following === "number";

			const [
				followCount,
				followingCount,
				isFollowing,
				filmographyCounts,
				pinnedReviews,
				lists,
				pinned,
				curator,
				earnedBadges,
				unlockedAchievements,
			] = await Promise.all([
				hasCachedFollowCounts
					? Promise.resolve({ followers: cachedStats!.followers! })
					: db
							.select({
								followers: sql<number>`count(distinct ${follow.followerId})`,
							})
							.from(follow)
							.where(eq(follow.followingId, targetUserId))
							.then((r) => r[0]),
				hasCachedFollowCounts
					? Promise.resolve({ following: cachedStats!.following! })
					: db
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
				filmographyCountsPromise,
				hydratePinnedReviews(targetUserId, row.profile.pinnedReviewIds),
				// Popular lists (public only) — poster paths hydrated for profile list rows.
				db
					.select()
					.from(list)
					.where(
						and(
							eq(list.userId, targetUserId),
							eq(list.isPublic, true),
							isNull(list.removedAt),
						),
					)
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

			// Legacy taste rows only stored second-person headline — refresh before paint.
			const freshTasteSignature = await ensureFreshTasteSignature(
				targetUserId,
				row.profile.tasteSignature,
			);

			const cachedLogCount =
				typeof cachedStats?.logCount === "number" ? cachedStats.logCount : null;
			const diaryLogCount =
				cachedLogCount !== null
					? cachedLogCount
					: await db
							.select({ c: count(log.id) })
							.from(log)
							.where(and(eq(log.userId, targetUserId), isNull(log.removedAt)))
							.then((r) => Number(r[0]?.c ?? 0));
			const diaryMetalTier = resolveDiaryMetalTier(diaryLogCount);

			const birthIso = profileBirthDateToIso(row.profile.birthDate);
			const showBirthday = readShowBirthDateOnProfilePref(
				row.profile.preferences as Record<string, unknown> | null,
			);
			const { birthDate: _privateBirthDate, ...publicProfile } = row.profile;
			const birthdayDisplay =
				showBirthday && birthIso
					? formatBirthdayDisplayPublic(birthIso)
					: undefined;

			// Showcase is identity chrome — hide on private profiles for non-owners.
			const showcaseVisible =
				!row.profile.isPrivate || viewerId === targetUserId;
			const showcaseResolved = showcaseVisible
				? {
						items: await hydrateShowcaseTiles(
							row.profile.showcaseItems,
							row.profile.favoriteMovieIds,
						),
					}
				: { items: [] };

			return {
				user: { id: row.user.id, name: row.user.name, image: row.user.image },
				profile: {
					...publicProfile,
					diaryMetalTier,
					...(freshTasteSignature
						? { tasteSignature: freshTasteSignature }
						: {}),
					...(birthdayDisplay ? { birthdayDisplay } : {}),
				},
				stats: {
					followers: Number(followCount?.followers ?? 0),
					following: Number(followingCount?.following ?? 0),
				},
				creator: curator,
				isFollowing,
				filmographyCounts,
				pinnedReviews,
				showcaseResolved,
				lists,
				pinnedBadges: pinned,
				earnedBadges,
				unlockedAchievements,
			};
		},
		{ params: t.Object({ handle: t.String() }) },
	);
