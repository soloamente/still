import { badge, db, profile } from "@still/db";
import { eq } from "drizzle-orm";
import { Elysia } from "elysia";

import { context } from "../context";
import { awardBadgeToUser } from "../jobs/badge-evaluator";
import { applyAnilistImport } from "../lib/anilist-import-apply";
import { parseAnilistImportJson } from "../lib/anilist-import-json";
import { hasRecognizedLetterboxdFile } from "../lib/letterboxd-file-classifier";
import { applyLetterboxdImport } from "../lib/letterboxd-import-apply";
import { deliverNotification } from "../lib/notification-delivery";
import { hit } from "../lib/rate-limit";
import { recomputeUserTasteSignature } from "../lib/recompute-user-taste-signature";
import { recordProductEvent } from "../lib/record-product-event";
import { formField } from "../lib/request-form";
import { resolveAnilistMediaToTmdbTvId } from "../lib/resolve-anilist-tv-tmdb";
import { getTmdbLanguageForUser } from "../lib/tmdb-poster-language";
import { ensureTvCached } from "../lib/tv-cache";
import { backfillWatchStreakFromLogs } from "../lib/watch-streak-sync";

/**
 * Sense Tier 0 — Letterboxd CSV import (diary export).
 */
export const importRoute = new Elysia({
	prefix: "/api/import",
	tags: ["import"],
})
	.use(context)
	.post("/letterboxd", async ({ body, user, status }) => {
		if (!user) return status(401, "Sign in");
		if (
			!hit(`import:letterboxd:${user.id}`, {
				limit: 3,
				windowMs: 60 * 60_000,
			}).ok
		) {
			return status(429, "Import limit reached — try again later");
		}

		const csvFiles: File[] = [];
		const multi = formField(body, "files");
		if (Array.isArray(multi)) {
			for (const entry of multi) {
				if (entry instanceof File) csvFiles.push(entry);
			}
		} else if (multi instanceof File) {
			csvFiles.push(multi);
		}
		const single = formField(body, "file");
		if (single instanceof File) csvFiles.push(single);

		if (csvFiles.length === 0) return status(400, "Missing CSV file(s)");

		if (!hasRecognizedLetterboxdFile(csvFiles.map((f) => f.name))) {
			return status(
				400,
				"No recognized Letterboxd CSV files — include diary.csv, watched.csv, watchlist.csv, reviews.csv, films.csv, or ratings.csv",
			);
		}

		let totalBytes = 0;
		const uploaded: { name: string; text: string }[] = [];
		for (const file of csvFiles) {
			const name = file.name.toLowerCase();
			if (!name.endsWith(".csv") && file.type !== "text/csv") {
				return status(400, `Not a CSV: ${file.name}`);
			}
			totalBytes += file.size;
			if (totalBytes > 8_000_000) {
				return status(413, "Files too large (max 8MB total)");
			}
			uploaded.push({ name: file.name, text: await file.text() });
		}

		let applyResult: Awaited<ReturnType<typeof applyLetterboxdImport>>;
		try {
			applyResult = await applyLetterboxdImport({
				userId: user.id,
				files: uploaded,
			});
		} catch (err) {
			console.error("[import/letterboxd] apply failed", err);
			return status(500, {
				error: "Import failed — try again in a moment",
			});
		}

		if (applyResult.totalRows === 0) {
			return status(
				400,
				"No importable rows found — check your Letterboxd export CSV files",
			);
		}

		const [prof] = await db
			.select({ handle: profile.handle })
			.from(profile)
			.where(eq(profile.userId, user.id))
			.limit(1);

		const touched =
			applyResult.diary.imported +
			applyResult.ratingFilled +
			applyResult.watched.imported +
			applyResult.watchlist.imported +
			applyResult.reviews.imported +
			applyResult.reviews.updated +
			applyResult.likes.favorited;

		if (touched > 0) {
			const tasteChanged =
				applyResult.diary.imported > 0 ||
				applyResult.ratingFilled > 0 ||
				applyResult.watched.imported > 0 ||
				applyResult.reviews.imported > 0 ||
				applyResult.reviews.updated > 0;
			if (tasteChanged) {
				await recomputeUserTasteSignature(user.id).catch((err) => {
					console.error("[import/letterboxd] taste recompute failed", err);
				});
			}
			const diaryTouched =
				applyResult.diary.imported > 0 ||
				applyResult.ratingFilled > 0 ||
				applyResult.watched.imported > 0;
			if (diaryTouched) {
				await backfillWatchStreakFromLogs(user.id).catch((err) => {
					console.error("[import/letterboxd] streak backfill failed", err);
				});
			}
			const diaryHref = prof?.handle ? `/profile/${prof.handle}` : "/diary";
			const summaryParts = [`${applyResult.diary.imported} diary`];
			if (applyResult.watched.imported > 0) {
				summaryParts.push(`${applyResult.watched.imported} watched`);
			}
			summaryParts.push(
				`${applyResult.watchlist.imported} watchlist`,
				`${applyResult.reviews.imported + applyResult.reviews.updated} reviews`,
				`${applyResult.likes.favorited} favorites`,
			);
			const summary = summaryParts.join(" · ");
			await deliverNotification({
				userId: user.id,
				kind: "import.completed",
				title: "Letterboxd import complete",
				body: `Letterboxd import complete — ${summary}`,
				payload: {
					imported: applyResult.diary.imported,
					source: "letterboxd",
					href: diaryHref,
					diary: applyResult.diary,
					watched: applyResult.watched,
					watchlist: applyResult.watchlist,
					reviews: applyResult.reviews,
					likes: applyResult.likes,
				},
			});
			if (applyResult.diary.imported > 0) {
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
							imported: applyResult.diary.imported,
							source: "letterboxd",
						},
						{ suppressInbox: true },
					);
				}
			}
			void recordProductEvent(user.id, "import.letterboxd.completed", {
				imported: applyResult.diary.imported,
				skipped: applyResult.diary.skipped,
				unmatched: applyResult.diary.unmatched,
				totalRows: applyResult.totalRows,
				diary: applyResult.diary,
				watched: applyResult.watched,
				watchlist: applyResult.watchlist,
				reviews: applyResult.reviews,
				likes: applyResult.likes,
			});
		}

		return {
			...applyResult,
			profileHandle: prof?.handle ?? null,
		};
	})
	.post("/anilist", async ({ body, user, status }) => {
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

			const file = formField(body, "file");
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
				if (applyResult.imported > 0) {
					await backfillWatchStreakFromLogs(user.id).catch((err) => {
						console.error("[import/anilist] streak backfill failed", err);
					});
				}
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
