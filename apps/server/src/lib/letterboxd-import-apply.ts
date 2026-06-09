import { db, log, profile, review, watchlistItem } from "@still/db";
import { and, eq } from "drizzle-orm";

import { makeId } from "./cuid";
import { ensureMovieCached } from "./ensure-movie-cached";
import { syncFavoritesListForUserTitle } from "./favorites-list-sync";
import {
	type LetterboxdCsvRow,
	letterboxdImportDedupeKey,
	letterboxdStarsToStoredTenths,
	mergeLetterboxdImportRows,
	parseLetterboxdCsv,
} from "./letterboxd-csv";
import {
	classifyLetterboxdFileName,
	type LetterboxdCsvKind,
} from "./letterboxd-file-classifier";
import {
	createMinimalLetterboxdLog,
	defaultMinimalLogWatchedAt,
	fillLogRatingIfNull,
	findLatestLogForMovie,
	findSameDayLog,
	letterboxdTitleMatchKey,
	setLogLiked,
} from "./letterboxd-import-log-resolve";
import { parseLetterboxdLikesCsv } from "./letterboxd-likes-csv";
import { parseLetterboxdReviewsCsv } from "./letterboxd-reviews-csv";
import { resolveLetterboxdMovieTmdbId } from "./letterboxd-tmdb-resolve";
import { parseLetterboxdWatchlistCsv } from "./letterboxd-watchlist-csv";

export interface LetterboxdImportDiaryCounts {
	imported: number;
	skipped: number;
	unmatched: number;
}

export interface LetterboxdImportWatchlistCounts {
	imported: number;
	skipped: number;
	unmatched: number;
}

export interface LetterboxdImportReviewsCounts {
	imported: number;
	updated: number;
	skipped: number;
	unmatched: number;
}

export interface LetterboxdImportLikesCounts {
	favorited: number;
	logsCreated: number;
	skipped: number;
	unmatched: number;
}

export interface LetterboxdImportApplyResult {
	diary: LetterboxdImportDiaryCounts;
	watchlist: LetterboxdImportWatchlistCounts;
	reviews: LetterboxdImportReviewsCounts;
	likes: LetterboxdImportLikesCounts;
	/** Legacy top-level diary fields for older clients. */
	imported: number;
	skipped: number;
	unmatched: number;
	totalRows: number;
	ratingFilled: number;
}

export interface LetterboxdUploadedFile {
	name: string;
	text: string;
}

export interface ApplyLetterboxdImportOptions {
	userId: string;
	files: LetterboxdUploadedFile[];
	resolveTmdbId?: (name: string, year: number | null) => Promise<number | null>;
	ensureMovie?: (tmdbId: number) => Promise<void>;
	importedAt?: Date;
}

function emptyResult(): LetterboxdImportApplyResult {
	return {
		diary: { imported: 0, skipped: 0, unmatched: 0 },
		watchlist: { imported: 0, skipped: 0, unmatched: 0 },
		reviews: { imported: 0, updated: 0, skipped: 0, unmatched: 0 },
		likes: { favorited: 0, logsCreated: 0, skipped: 0, unmatched: 0 },
		imported: 0,
		skipped: 0,
		unmatched: 0,
		totalRows: 0,
		ratingFilled: 0,
	};
}

function syncLegacyDiaryFields(result: LetterboxdImportApplyResult): void {
	result.imported = result.diary.imported;
	result.skipped = result.diary.skipped;
	result.unmatched = result.diary.unmatched;
}

async function resolveMovieId(
	name: string,
	year: number | null,
	resolveTmdbId: (name: string, year: number | null) => Promise<number | null>,
	ensureMovie: (tmdbId: number) => Promise<void>,
): Promise<number | null> {
	const tmdbId = await resolveTmdbId(name, year);
	if (tmdbId == null) return null;
	await ensureMovie(tmdbId);
	return tmdbId;
}

async function applyDiaryPhase(
	userId: string,
	rows: LetterboxdCsvRow[],
	resolveTmdbId: (name: string, year: number | null) => Promise<number | null>,
	ensureMovie: (tmdbId: number) => Promise<void>,
): Promise<{
	counts: LetterboxdImportDiaryCounts;
	ratingFilled: number;
}> {
	const counts: LetterboxdImportDiaryCounts = {
		imported: 0,
		skipped: 0,
		unmatched: 0,
	};
	let ratingFilled = 0;
	const seenKeys = new Set<string>();

	for (const row of rows) {
		const dedupeKey = letterboxdImportDedupeKey(row);
		if (seenKeys.has(dedupeKey)) {
			counts.skipped++;
			continue;
		}
		seenKeys.add(dedupeKey);

		const movieId = await resolveMovieId(
			row.name,
			row.year,
			resolveTmdbId,
			ensureMovie,
		);
		if (movieId == null) {
			counts.unmatched++;
			continue;
		}

		const watchedAt = row.watchedAt ?? new Date();
		const existing = await findSameDayLog(userId, movieId, watchedAt);
		if (existing) {
			if (row.ratingStars != null && existing.rating == null) {
				const filled = await fillLogRatingIfNull(existing.id, row.ratingStars);
				if (filled) ratingFilled++;
			}
			counts.skipped++;
			continue;
		}

		const rating =
			row.ratingStars != null
				? letterboxdStarsToStoredTenths(row.ratingStars)
				: null;

		await db.insert(log).values({
			id: makeId("log"),
			userId,
			movieId,
			watchedAt,
			rating,
			rewatch: row.rewatch,
			note: row.letterboxdUri
				? `Imported from Letterboxd (${row.letterboxdUri})`
				: "Imported from Letterboxd",
			watchVenue: "streaming",
		});
		counts.imported++;
	}

	return { counts, ratingFilled };
}

async function loadDefaultReviewVisibility(userId: string) {
	const [prof] = await db
		.select({ visibility: profile.defaultVisibility })
		.from(profile)
		.where(eq(profile.userId, userId))
		.limit(1);
	return prof?.visibility ?? "public";
}

async function applyReviewsPhase(
	userId: string,
	rows: ReturnType<typeof parseLetterboxdReviewsCsv>,
	resolveTmdbId: (name: string, year: number | null) => Promise<number | null>,
	ensureMovie: (tmdbId: number) => Promise<void>,
	importDay: Date,
	defaultVisibility: Awaited<ReturnType<typeof loadDefaultReviewVisibility>>,
): Promise<LetterboxdImportReviewsCounts> {
	const counts: LetterboxdImportReviewsCounts = {
		imported: 0,
		updated: 0,
		skipped: 0,
		unmatched: 0,
	};
	const seenKeys = new Set<string>();

	for (const row of rows) {
		const key = letterboxdTitleMatchKey(row);
		if (seenKeys.has(key)) {
			counts.skipped++;
			continue;
		}
		seenKeys.add(key);

		const movieId = await resolveMovieId(
			row.name,
			row.year,
			resolveTmdbId,
			ensureMovie,
		);
		if (movieId == null) {
			counts.unmatched++;
			continue;
		}

		const watchedAt = defaultMinimalLogWatchedAt(
			row.watchedAt,
			row.publishedAt,
			importDay,
		);

		let linkedLog = await findSameDayLog(userId, movieId, watchedAt);
		let logsCreated = 0;
		if (!linkedLog) {
			const latest = await findLatestLogForMovie(userId, movieId);
			if (latest) {
				linkedLog = { id: latest.id, rating: latest.rating };
			} else {
				const logId = await createMinimalLetterboxdLog({
					userId,
					movieId,
					watchedAt,
					ratingStars: row.ratingStars,
					rewatch: row.rewatch,
					letterboxdUri: row.letterboxdUri,
				});
				linkedLog = {
					id: logId,
					rating:
						row.ratingStars != null
							? letterboxdStarsToStoredTenths(row.ratingStars)
							: null,
				};
				logsCreated++;
			}
		}

		const reviewRating =
			row.ratingStars != null
				? letterboxdStarsToStoredTenths(row.ratingStars)
				: (linkedLog.rating ?? null);
		const publishedAt = row.publishedAt ?? row.watchedAt ?? watchedAt;

		const [existingReview] = await db
			.select({
				id: review.id,
				body: review.body,
				rating: review.rating,
			})
			.from(review)
			.where(and(eq(review.userId, userId), eq(review.movieId, movieId)))
			.limit(1);

		if (existingReview) {
			const bodyChanged = existingReview.body !== row.body;
			const ratingChanged =
				reviewRating != null && existingReview.rating !== reviewRating;
			if (bodyChanged || ratingChanged) {
				await db
					.update(review)
					.set({
						body: row.body,
						...(ratingChanged ? { rating: reviewRating } : {}),
						logId: linkedLog.id,
						publishedAt,
					})
					.where(eq(review.id, existingReview.id));
				counts.updated++;
			} else {
				counts.skipped++;
			}
			void logsCreated;
			continue;
		}

		await db.insert(review).values({
			id: makeId("rev"),
			userId,
			movieId,
			logId: linkedLog.id,
			title: null,
			body: row.body,
			containsSpoilers: false,
			visibility: defaultVisibility,
			rating: reviewRating,
			publishedAt,
		});
		counts.imported++;
	}

	return counts;
}

async function applyLikesPhase(
	userId: string,
	rows: ReturnType<typeof parseLetterboxdLikesCsv>,
	resolveTmdbId: (name: string, year: number | null) => Promise<number | null>,
	ensureMovie: (tmdbId: number) => Promise<void>,
	importDay: Date,
): Promise<LetterboxdImportLikesCounts> {
	const counts: LetterboxdImportLikesCounts = {
		favorited: 0,
		logsCreated: 0,
		skipped: 0,
		unmatched: 0,
	};
	const seenKeys = new Set<string>();

	for (const row of rows) {
		const key = letterboxdTitleMatchKey(row);
		if (seenKeys.has(key)) {
			counts.skipped++;
			continue;
		}
		seenKeys.add(key);

		const movieId = await resolveMovieId(
			row.name,
			row.year,
			resolveTmdbId,
			ensureMovie,
		);
		if (movieId == null) {
			counts.unmatched++;
			continue;
		}

		const watchedAt = defaultMinimalLogWatchedAt(row.likedAt, null, importDay);
		let latest = await findLatestLogForMovie(userId, movieId);
		if (!latest) {
			const logId = await createMinimalLetterboxdLog({
				userId,
				movieId,
				watchedAt,
				ratingStars: null,
				rewatch: false,
				letterboxdUri: row.letterboxdUri,
			});
			latest = { id: logId, rating: null, watchedAt };
			counts.logsCreated++;
		}

		const [likedRow] = await db
			.select({ liked: log.liked })
			.from(log)
			.where(eq(log.id, latest.id))
			.limit(1);
		if (likedRow?.liked) {
			counts.skipped++;
			continue;
		}

		await setLogLiked(userId, latest.id, true);
		await syncFavoritesListForUserTitle({
			userId,
			movieId,
			tvId: null,
			liked: true,
		});
		counts.favorited++;
	}

	return counts;
}

async function applyWatchlistPhase(
	userId: string,
	rows: ReturnType<typeof parseLetterboxdWatchlistCsv>,
	resolveTmdbId: (name: string, year: number | null) => Promise<number | null>,
	ensureMovie: (tmdbId: number) => Promise<void>,
): Promise<LetterboxdImportWatchlistCounts> {
	const counts: LetterboxdImportWatchlistCounts = {
		imported: 0,
		skipped: 0,
		unmatched: 0,
	};
	const seenKeys = new Set<string>();

	for (const row of rows) {
		const key = letterboxdTitleMatchKey(row);
		if (seenKeys.has(key)) {
			counts.skipped++;
			continue;
		}
		seenKeys.add(key);

		const movieId = await resolveMovieId(
			row.name,
			row.year,
			resolveTmdbId,
			ensureMovie,
		);
		if (movieId == null) {
			counts.unmatched++;
			continue;
		}

		const [anyLog] = await db
			.select({ id: log.id })
			.from(log)
			.where(and(eq(log.userId, userId), eq(log.movieId, movieId)))
			.limit(1);
		if (anyLog) {
			counts.skipped++;
			continue;
		}

		const [existingItem] = await db
			.select({ userId: watchlistItem.userId })
			.from(watchlistItem)
			.where(
				and(
					eq(watchlistItem.userId, userId),
					eq(watchlistItem.movieId, movieId),
				),
			)
			.limit(1);
		if (existingItem) {
			counts.skipped++;
			continue;
		}

		await db.insert(watchlistItem).values({
			userId,
			movieId,
			addedAt: row.addedAt ?? new Date(),
		});
		counts.imported++;
	}

	return counts;
}

function bucketFiles(
	files: LetterboxdUploadedFile[],
): Map<LetterboxdCsvKind, string[]> {
	const buckets = new Map<LetterboxdCsvKind, string[]>();
	for (const file of files) {
		const kind = classifyLetterboxdFileName(file.name);
		if (kind === "unknown") continue;
		const prev = buckets.get(kind) ?? [];
		prev.push(file.text);
		buckets.set(kind, prev);
	}
	return buckets;
}

/**
 * Apply a multi-file Letterboxd export for one patron — diary, reviews, likes,
 * then watchlist (diary first so later phases can attach to new logs).
 */
export async function applyLetterboxdImport(
	opts: ApplyLetterboxdImportOptions,
): Promise<LetterboxdImportApplyResult> {
	const result = emptyResult();
	const importDay = opts.importedAt ?? new Date();
	const resolveTmdbId =
		opts.resolveTmdbId ??
		((name, year) => resolveLetterboxdMovieTmdbId(name, year));
	const ensureMovie =
		opts.ensureMovie ?? (async (tmdbId) => ensureMovieCached(tmdbId));

	const buckets = bucketFiles(opts.files);
	const diaryTexts = [
		...(buckets.get("diary") ?? []),
		...(buckets.get("ratings") ?? []),
	];
	const diaryBatches = diaryTexts.map((text) => parseLetterboxdCsv(text));
	const diaryRows = mergeLetterboxdImportRows(diaryBatches);
	const reviewRows = (buckets.get("reviews") ?? []).flatMap((text) =>
		parseLetterboxdReviewsCsv(text),
	);
	const likeRows = (buckets.get("likes") ?? []).flatMap((text) =>
		parseLetterboxdLikesCsv(text),
	);
	const watchlistRows = (buckets.get("watchlist") ?? []).flatMap((text) =>
		parseLetterboxdWatchlistCsv(text),
	);

	result.totalRows =
		diaryRows.length +
		reviewRows.length +
		likeRows.length +
		watchlistRows.length;

	if (result.totalRows === 0) {
		return result;
	}

	const diaryOutcome = await applyDiaryPhase(
		opts.userId,
		diaryRows,
		resolveTmdbId,
		ensureMovie,
	);
	result.diary = diaryOutcome.counts;
	result.ratingFilled = diaryOutcome.ratingFilled;
	syncLegacyDiaryFields(result);

	const defaultVisibility = await loadDefaultReviewVisibility(opts.userId);

	result.reviews = await applyReviewsPhase(
		opts.userId,
		reviewRows,
		resolveTmdbId,
		ensureMovie,
		importDay,
		defaultVisibility,
	);
	result.likes = await applyLikesPhase(
		opts.userId,
		likeRows,
		resolveTmdbId,
		ensureMovie,
		importDay,
	);
	result.watchlist = await applyWatchlistPhase(
		opts.userId,
		watchlistRows,
		resolveTmdbId,
		ensureMovie,
	);

	return result;
}
