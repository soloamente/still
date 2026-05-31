import {
	db,
	log,
	type TvWatchStatus,
	tvWatch,
	tvWatchEpisode,
	watchlistItem,
} from "@still/db";
import { and, eq } from "drizzle-orm";
import { episodeSlotsForProgressCount } from "./anilist-import-episodes";
import {
	type AnilistImportEntry,
	anilistEntryDisplayTitle,
	anilistImportDedupeKey,
	anilistScoreToStoredTenths,
} from "./anilist-import-json";
import { makeId } from "./cuid";
import {
	filterSeasonsForProgress,
	getTvSeasonDetailCached,
	getTvSeasonsCached,
} from "./tv-season-cache";

export interface AnilistImportApplyResult {
	imported: number;
	watchlist: number;
	watches: number;
	/** Existing tv_watch row updated (status / episode progress). */
	watchesUpdated: number;
	/** Already on watchlist — no duplicate row. */
	watchlistExisting: number;
	episodesMarked: number;
	/** Duplicate rows in the same JSON file only. */
	skipped: number;
	unmatched: number;
	unmatchedTitles: { anilistId: number; title: string }[];
}

function tvWatchStatusForEntry(
	entry: AnilistImportEntry,
): TvWatchStatus | null {
	switch (entry.status) {
		case "COMPLETED":
			return "finished";
		case "CURRENT":
			return "watching";
		case "REPEATING":
			return "rewatching";
		case "PAUSED":
			return "paused";
		case "DROPPED":
			return "abandoned";
		default:
			return null;
	}
}

function parseImportDate(raw: string | null | undefined): Date {
	if (raw?.trim()) {
		const d = new Date(raw);
		if (!Number.isNaN(d.getTime())) return d;
	}
	return new Date();
}

async function upsertWatchlistTv(
	userId: string,
	tvId: number,
): Promise<boolean> {
	const [existing] = await db
		.select({ userId: watchlistItem.userId })
		.from(watchlistItem)
		.where(and(eq(watchlistItem.userId, userId), eq(watchlistItem.tvId, tvId)))
		.limit(1);
	if (existing) return false;

	await db.insert(watchlistItem).values({
		userId,
		tvId,
		addedAt: new Date(),
	});
	return true;
}

async function ensureTvWatchRow(
	userId: string,
	tvId: number,
	status: TvWatchStatus,
	progressMode: "season" | "episode",
): Promise<{ id: string; created: boolean }> {
	const [existing] = await db
		.select()
		.from(tvWatch)
		.where(and(eq(tvWatch.userId, userId), eq(tvWatch.tvId, tvId)))
		.limit(1);

	if (existing) {
		await db
			.update(tvWatch)
			.set({
				status,
				progressMode,
				statusChangedAt: new Date(),
				notifyNewEpisodes: status === "watching" || status === "rewatching",
			})
			.where(eq(tvWatch.id, existing.id));
		return { id: existing.id, created: false };
	}

	const id = makeId("tvw");
	await db.insert(tvWatch).values({
		id,
		userId,
		tvId,
		status,
		progressMode,
		notifyNewEpisodes: status === "watching" || status === "rewatching",
	});
	return { id, created: true };
}

async function markEpisodeProgress(
	watchId: string,
	tvId: number,
	progress: number,
	language: string,
): Promise<number> {
	if (progress <= 0) return 0;

	// Fetch season details lazily — long runners (One Piece, etc.) must not need every season for small progress counts.
	const seasons = filterSeasonsForProgress(
		await getTvSeasonsCached(tvId, language),
	);
	const seasonPayloads: {
		seasonNumber: number;
		episodes: Awaited<ReturnType<typeof getTvSeasonDetailCached>>["episodes"];
	}[] = [];
	let slotsSoFar = 0;

	for (const season of seasons) {
		if (slotsSoFar >= progress) break;
		const detail = await getTvSeasonDetailCached(
			tvId,
			season.season_number,
			language,
		);
		const episodes = detail.episodes ?? [];
		seasonPayloads.push({
			seasonNumber: season.season_number,
			episodes,
		});
		slotsSoFar += episodes.length;
	}

	const slots = episodeSlotsForProgressCount(seasonPayloads, progress);
	if (slots.length === 0) return 0;

	await db
		.insert(tvWatchEpisode)
		.values(
			slots.map((slot) => ({
				tvWatchId: watchId,
				seasonNumber: slot.seasonNumber,
				episodeNumber: slot.episodeNumber,
			})),
		)
		.onConflictDoNothing();

	const last = slots[slots.length - 1];
	if (last) {
		await db
			.update(tvWatch)
			.set({
				lastSeason: last.seasonNumber,
				lastEpisode: last.episodeNumber,
			})
			.where(eq(tvWatch.id, watchId));
	}

	return slots.length;
}

function importLogIsCompletion(entry: AnilistImportEntry): boolean {
	return (
		entry.status === "COMPLETED" ||
		(entry.status === "REPEATING" && Boolean(entry.completedAt?.trim()))
	);
}

/** Whole-show diary row so profile / diary grids can list imported anime. */
async function ensureImportedShowLog(
	userId: string,
	tvId: number,
	entry: AnilistImportEntry,
): Promise<boolean> {
	const [existing] = await db
		.select({ id: log.id })
		.from(log)
		.where(
			and(eq(log.userId, userId), eq(log.tvId, tvId), eq(log.logScope, "show")),
		)
		.limit(1);
	if (existing) return false;

	const completion = importLogIsCompletion(entry);
	const watchedAt = parseImportDate(
		completion
			? (entry.completedAt ?? entry.startedAt)
			: (entry.startedAt ?? entry.completedAt),
	);
	const rating =
		completion && entry.score != null
			? anilistScoreToStoredTenths(entry.score)
			: null;
	const rewatch =
		entry.status === "REPEATING" || (entry.repeat != null && entry.repeat > 0);
	const statusNote =
		entry.status === "COMPLETED" ? "completed" : entry.status.toLowerCase();

	await db.insert(log).values({
		id: makeId("log"),
		userId,
		tvId,
		logScope: "show",
		watchedAt,
		rating,
		rewatch,
		note: `Imported from Anilist (${statusNote}, media #${entry.media.anilistId})`,
		watchVenue: "streaming",
	});
	return true;
}

export interface ApplyAnilistImportOptions {
	userId: string;
	entries: AnilistImportEntry[];
	language: string;
	resolveTvId: (entry: AnilistImportEntry) => Promise<number | null>;
	/** Must return true when a `tv` row exists for FK writes. */
	ensureTv: (tvId: number) => Promise<boolean>;
}

/**
 * Apply normalized Anilist rows for one patron — watchlist, tv_watch, diary logs.
 */
export async function applyAnilistImport(
	opts: ApplyAnilistImportOptions,
): Promise<AnilistImportApplyResult> {
	const result: AnilistImportApplyResult = {
		imported: 0,
		watchlist: 0,
		watches: 0,
		watchesUpdated: 0,
		watchlistExisting: 0,
		episodesMarked: 0,
		skipped: 0,
		unmatched: 0,
		unmatchedTitles: [],
	};

	const seenKeys = new Set<string>();

	for (const entry of opts.entries) {
		const dedupeKey = anilistImportDedupeKey(entry);
		if (seenKeys.has(dedupeKey)) {
			result.skipped++;
			continue;
		}
		seenKeys.add(dedupeKey);

		const tvId = await opts.resolveTvId(entry);
		if (tvId == null) {
			result.unmatched++;
			result.unmatchedTitles.push({
				anilistId: entry.media.anilistId,
				title: anilistEntryDisplayTitle(entry),
			});
			continue;
		}

		// TMDb detail can fail after a search hit — count separately from title misses.
		const tvCached = await opts.ensureTv(tvId);
		if (!tvCached) {
			console.warn(
				"[anilist-import-apply] TMDb cache failed after match",
				entry.media.anilistId,
				tvId,
			);
			result.unmatched++;
			result.unmatchedTitles.push({
				anilistId: entry.media.anilistId,
				title: anilistEntryDisplayTitle(entry),
			});
			continue;
		}

		try {
			if (entry.status === "PLANNING") {
				const added = await upsertWatchlistTv(opts.userId, tvId);
				if (added) result.watchlist++;
				else result.watchlistExisting++;
				continue;
			}

			const watchStatus = tvWatchStatusForEntry(entry);
			if (!watchStatus) {
				result.skipped++;
				continue;
			}

			const needsEpisodeMode =
				entry.status === "CURRENT" ||
				entry.status === "REPEATING" ||
				(entry.progress != null && entry.progress > 0);

			const { id: watchId, created } = await ensureTvWatchRow(
				opts.userId,
				tvId,
				watchStatus,
				needsEpisodeMode ? "episode" : "season",
			);
			if (created) result.watches++;
			else result.watchesUpdated++;

			if (needsEpisodeMode && entry.progress != null && entry.progress > 0) {
				const marked = await markEpisodeProgress(
					watchId,
					tvId,
					entry.progress,
					opts.language,
				);
				result.episodesMarked += marked;
			}

			// Profile and /diary read `log` rows — backfill a show log when missing so
			// in-progress Anilist entries appear on the TV grid, not only in tv_watch.
			const logged = await ensureImportedShowLog(opts.userId, tvId, entry);
			if (logged) result.imported++;
		} catch (err) {
			console.error(
				"[anilist-import-apply] row failed",
				entry.media.anilistId,
				err,
			);
			result.skipped++;
		}
	}

	return result;
}

/** Map Anilist list status to tv_watch status — exported for tests. */
export function anilistStatusToTvWatchStatus(
	status: AnilistImportEntry["status"],
): TvWatchStatus | null {
	return tvWatchStatusForEntry({ status, media: { anilistId: 0, title: {} } });
}
