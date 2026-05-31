import { badge, db, log, movie, profile } from "@still/db";
import { and, eq, ilike, sql } from "drizzle-orm";
import { Elysia } from "elysia";

import { context } from "../context";
import { awardBadgeToUser } from "../jobs/badge-evaluator";
import { applyAnilistImport } from "../lib/anilist-import-apply";
import { parseAnilistImportJson } from "../lib/anilist-import-json";
import { makeId } from "../lib/cuid";
import { ensureMovieCached } from "../lib/ensure-movie-cached";
import {
	letterboxdImportDedupeKey,
	letterboxdStarsToStoredTenths,
	mergeLetterboxdImportRows,
	parseLetterboxdCsv,
} from "../lib/letterboxd-csv";
import { deliverNotification } from "../lib/notification-delivery";
import { hit } from "../lib/rate-limit";
import { recomputeUserTasteSignature } from "../lib/recompute-user-taste-signature";
import { recordProductEvent } from "../lib/record-product-event";
import { resolveAnilistMediaToTmdbTvId } from "../lib/resolve-anilist-tv-tmdb";
import { tmdbApi } from "../lib/tmdb";
import { getTmdbLanguageForUser } from "../lib/tmdb-poster-language";
import { ensureTvCached } from "../lib/tv-cache";

async function resolveMovieTmdbId(
	name: string,
	year: number | null,
): Promise<number | null> {
	if (year != null) {
		const [byYear] = await db
			.select({ tmdbId: movie.tmdbId })
			.from(movie)
			.where(and(ilike(movie.title, name), eq(movie.year, year)))
			.limit(1);
		if (byYear) return byYear.tmdbId;
	}
	const [byTitle] = await db
		.select({ tmdbId: movie.tmdbId })
		.from(movie)
		.where(ilike(movie.title, name))
		.limit(1);
	return byTitle?.tmdbId ?? null;
}

/**
 * Sense Tier 0 — Letterboxd CSV import (diary export).
 */
export const importRoute = new Elysia({
	prefix: "/api/import",
	tags: ["import"],
})
	.use(context)
	.post("/letterboxd", async ({ request, user, status }) => {
		if (!user) return status(401, "Sign in");
		if (
			!hit(`import:letterboxd:${user.id}`, {
				limit: 3,
				windowMs: 60 * 60_000,
			}).ok
		) {
			return status(429, "Import limit reached — try again later");
		}

		const formData = await request.formData();
		const csvFiles: File[] = [];
		const multi = formData.getAll("files");
		if (multi.length > 0) {
			for (const entry of multi) {
				if (entry instanceof File) csvFiles.push(entry);
			}
		}
		const single = formData.get("file");
		if (single instanceof File) csvFiles.push(single);

		if (csvFiles.length === 0) return status(400, "Missing CSV file(s)");

		let totalBytes = 0;
		const parsedBatches: ReturnType<typeof parseLetterboxdCsv>[] = [];
		for (const file of csvFiles) {
			const name = file.name.toLowerCase();
			if (!name.endsWith(".csv") && file.type !== "text/csv") {
				return status(400, `Not a CSV: ${file.name}`);
			}
			totalBytes += file.size;
			if (totalBytes > 8_000_000) {
				return status(413, "Files too large (max 8MB total)");
			}
			const rows = parseLetterboxdCsv(await file.text());
			if (rows.length > 0) parsedBatches.push(rows);
		}

		const parsed = mergeLetterboxdImportRows(parsedBatches);
		if (parsed.length === 0) {
			return status(
				400,
				"No diary rows found — use diary.csv and/or ratings.csv from your Letterboxd export folder",
			);
		}

		const seenKeys = new Set<string>();
		let imported = 0;
		let skipped = 0;
		let unmatched = 0;

		for (const row of parsed) {
			const dedupeKey = letterboxdImportDedupeKey(row);
			if (seenKeys.has(dedupeKey)) {
				skipped++;
				continue;
			}
			seenKeys.add(dedupeKey);

			let tmdbId = await resolveMovieTmdbId(row.name, row.year);
			if (tmdbId == null) {
				try {
					const search = await tmdbApi.searchMovies(row.name, 1);
					const candidates = search.results ?? [];
					const hit =
						row.year != null
							? candidates.find((c) =>
									c.release_date?.startsWith(String(row.year)),
								)
							: candidates[0];
					if (hit?.id) tmdbId = hit.id;
				} catch (err) {
					console.error("[import/letterboxd] TMDb search failed", err);
				}
			}
			if (tmdbId == null) {
				unmatched++;
				continue;
			}

			await ensureMovieCached(tmdbId);

			const watchedAt = row.watchedAt ?? new Date();
			const [existing] = await db
				.select({ id: log.id })
				.from(log)
				.where(
					and(
						eq(log.userId, user.id),
						eq(log.movieId, tmdbId),
						sql`date_trunc('day', ${log.watchedAt}) = date_trunc('day', ${watchedAt}::timestamp)`,
					),
				)
				.limit(1);
			if (existing) {
				skipped++;
				continue;
			}

			const rating =
				row.ratingStars != null
					? letterboxdStarsToStoredTenths(row.ratingStars)
					: null;

			await db.insert(log).values({
				id: makeId("log"),
				userId: user.id,
				movieId: tmdbId,
				watchedAt,
				rating,
				rewatch: row.rewatch,
				note: row.letterboxdUri
					? `Imported from Letterboxd (${row.letterboxdUri})`
					: "Imported from Letterboxd",
				watchVenue: "streaming",
			});
			imported++;
		}

		const [prof] = await db
			.select({ handle: profile.handle })
			.from(profile)
			.where(eq(profile.userId, user.id))
			.limit(1);

		if (imported > 0) {
			await recomputeUserTasteSignature(user.id).catch((err) => {
				console.error("[import/letterboxd] taste recompute failed", err);
			});
			const diaryHref = prof?.handle ? `/profile/${prof.handle}` : "/diary";
			await deliverNotification({
				userId: user.id,
				kind: "import.completed",
				title: "Letterboxd import complete",
				body: `Added ${imported} ${imported === 1 ? "film" : "films"} to your diary.`,
				payload: {
					imported,
					source: "letterboxd",
					href: diaryHref,
				},
			});
			const [importBadge] = await db
				.select()
				.from(badge)
				.where(eq(badge.id, "prestige_diaries_merged"))
				.limit(1);
			if (importBadge) {
				await awardBadgeToUser(
					user.id,
					importBadge,
					{
						imported,
						source: "letterboxd",
					},
					{ suppressInbox: true },
				);
			}
			void recordProductEvent(user.id, "import.letterboxd.completed", {
				imported,
				skipped,
				unmatched,
				totalRows: parsed.length,
			});
		}

		return {
			imported,
			skipped,
			unmatched,
			totalRows: parsed.length,
			profileHandle: prof?.handle ?? null,
		};
	})
	.post("/anilist", async ({ request, user, status }) => {
		try {
			if (!user) return status(401, "Sign in");
			if (
				!hit(`import:anilist:${user.id}`, {
					limit: 3,
					windowMs: 60 * 60_000,
				}).ok
			) {
				return status(429, "Import limit reached — try again later");
			}

			const formData = await request.formData();
			const file = formData.get("file");
			if (!(file instanceof File)) {
				return status(400, "Missing JSON file");
			}

			const name = file.name.toLowerCase();
			if (
				!name.endsWith(".json") &&
				file.type !== "application/json" &&
				file.type !== "text/json"
			) {
				return status(400, "Not a JSON file");
			}
			if (file.size > 8_000_000) {
				return status(413, "File too large (max 8MB)");
			}

			console.info("[import/anilist] start", user.id, file.name, file.size);

			const parsed = parseAnilistImportJson(await file.text());
			if (parsed.length === 0) {
				return status(
					400,
					"No anime list entries found — export your Anilist anime list as JSON",
				);
			}

			const language = await getTmdbLanguageForUser(user.id);
			let applyResult: Awaited<ReturnType<typeof applyAnilistImport>>;
			try {
				applyResult = await applyAnilistImport({
					userId: user.id,
					entries: parsed,
					language,
					resolveTvId: (entry) => resolveAnilistMediaToTmdbTvId(entry.media),
					ensureTv: ensureTvCached,
				});
			} catch (err) {
				console.error("[import/anilist] apply failed", err);
				return status(500, {
					error: "Import failed — try again in a moment",
				});
			}

			const [prof] = await db
				.select({ handle: profile.handle })
				.from(profile)
				.where(eq(profile.userId, user.id))
				.limit(1);

			const touched =
				applyResult.imported +
				applyResult.watchlist +
				applyResult.watches +
				applyResult.episodesMarked;

			if (touched > 0) {
				await recomputeUserTasteSignature(user.id).catch((err) => {
					console.error("[import/anilist] taste recompute failed", err);
				});
				const diaryHref = prof?.handle ? `/profile/${prof.handle}` : "/diary";
				await deliverNotification({
					userId: user.id,
					kind: "import.completed",
					title: "Anilist import complete",
					body: `Synced ${applyResult.imported} shows to your diary and ${applyResult.watches} to Watching.`,
					payload: {
						imported: applyResult.imported,
						source: "anilist",
						href: diaryHref,
					},
				}).catch((err) => {
					console.error("[import/anilist] notification failed", err);
				});
				const [importBadge] = await db
					.select()
					.from(badge)
					.where(eq(badge.id, "prestige_diaries_merged"))
					.limit(1);
				if (importBadge) {
					await awardBadgeToUser(
						user.id,
						importBadge,
						{
							imported: applyResult.imported,
							source: "anilist",
						},
						{ suppressInbox: true },
					).catch((err) => {
						console.error("[import/anilist] badge award failed", err);
					});
				}
				void recordProductEvent(user.id, "import.anilist.completed", {
					imported: applyResult.imported,
					watchlist: applyResult.watchlist,
					watches: applyResult.watches,
					episodesMarked: applyResult.episodesMarked,
					skipped: applyResult.skipped,
					unmatched: applyResult.unmatched,
					totalRows: parsed.length,
				});
			}

			console.info(
				"[import/anilist] done",
				user.id,
				applyResult.imported,
				applyResult.watches,
				applyResult.unmatched,
			);

			return {
				...applyResult,
				totalRows: parsed.length,
				profileHandle: prof?.handle ?? null,
			};
		} catch (err) {
			console.error("[import/anilist] unhandled", err);
			return status(500, {
				error: "Import failed — try again in a moment",
			});
		}
	});
