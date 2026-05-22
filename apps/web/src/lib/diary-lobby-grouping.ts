import type { DiaryLogRow } from "@/components/diary/diary-entry";
import type { DiaryLobbyOrder } from "@/lib/diary-lobby-order";
import { formatTvLogScopeLabel } from "@/lib/tv-log-scope-display";
import type { TvLogScope } from "@/lib/tv-watch-types";

export type DiaryLobbyMovieItem = {
	kind: "movie";
	key: string;
	row: DiaryLogRow;
};

export type DiaryLobbyTvGroupItem = {
	kind: "tvGroup";
	key: string;
	tmdbId: number;
	title: string;
	posterPath: string | null;
	logs: DiaryLogRow[];
};

export type DiaryLobbyGridItem = DiaryLobbyMovieItem | DiaryLobbyTvGroupItem;

function watchedAtMs(row: DiaryLogRow): number {
	return new Date(row.log.watchedAt).getTime();
}

function newestWatchedAtMs(logs: DiaryLogRow[]): number {
	const newest = sortLogsNewestFirst(logs)[0];
	return newest ? watchedAtMs(newest) : 0;
}

function oldestWatchedAtMs(logs: DiaryLogRow[]): number {
	const ordered = sortLogsNewestFirst(logs);
	const oldest = ordered[ordered.length - 1];
	return oldest ? watchedAtMs(oldest) : 0;
}

function sortLogsNewestFirst(logs: DiaryLogRow[]): DiaryLogRow[] {
	return logs.slice().sort((a, b) => watchedAtMs(b) - watchedAtMs(a));
}

function listingTitle(row: DiaryLogRow): string {
	return row.movie?.title ?? row.tv?.title ?? "";
}

/** Most specific scope among logs (episode → season → show), newest within tier. */
export function pickPrimaryTvScopeLabel(logs: DiaryLogRow[]): string {
	const ordered = sortLogsNewestFirst(logs);
	const byScope = (scope: TvLogScope) =>
		ordered.find((row) => (row.log.logScope ?? "show") === scope);
	const episode = byScope("episode");
	if (episode) {
		return formatTvLogScopeLabel(
			episode.log.logScope,
			episode.log.seasonNumber,
			episode.log.episodeNumber,
		);
	}
	const season = byScope("season");
	if (season) {
		return formatTvLogScopeLabel(
			season.log.logScope,
			season.log.seasonNumber,
			season.log.episodeNumber,
		);
	}
	return "Whole series";
}

function compareGridItems(
	a: DiaryLobbyGridItem,
	b: DiaryLobbyGridItem,
	order: DiaryLobbyOrder,
): number {
	switch (order) {
		case "latest_seen": {
			const aMs =
				a.kind === "movie" ? watchedAtMs(a.row) : newestWatchedAtMs(a.logs);
			const bMs =
				b.kind === "movie" ? watchedAtMs(b.row) : newestWatchedAtMs(b.logs);
			return bMs - aMs;
		}
		case "earliest_seen": {
			const aMs =
				a.kind === "movie" ? watchedAtMs(a.row) : oldestWatchedAtMs(a.logs);
			const bMs =
				b.kind === "movie" ? watchedAtMs(b.row) : oldestWatchedAtMs(b.logs);
			return aMs - bMs;
		}
		case "title_az": {
			const titleFor = (item: DiaryLobbyGridItem) =>
				item.kind === "movie" ? listingTitle(item.row) : item.title;
			const t = titleFor(a).localeCompare(titleFor(b), undefined, {
				sensitivity: "base",
			});
			if (t !== 0) return t;
			const aMs =
				a.kind === "movie" ? watchedAtMs(a.row) : newestWatchedAtMs(a.logs);
			const bMs =
				b.kind === "movie" ? watchedAtMs(b.row) : newestWatchedAtMs(b.logs);
			return bMs - aMs;
		}
		default: {
			const _exhaustive: never = order;
			return _exhaustive;
		}
	}
}

/**
 * Builds diary lobby grid items — films stay one cell per log; TV rows group by `tmdbId`.
 */
export function buildDiaryLobbyGridItems(
	rows: DiaryLogRow[],
	order: DiaryLobbyOrder,
): DiaryLobbyGridItem[] {
	const movieItems: DiaryLobbyMovieItem[] = [];
	const tvById = new Map<number, DiaryLogRow[]>();

	for (const row of rows) {
		if (row.tv != null) {
			const id = row.tv.tmdbId;
			const bucket = tvById.get(id) ?? [];
			bucket.push(row);
			tvById.set(id, bucket);
			continue;
		}
		if (row.movie != null) {
			movieItems.push({
				kind: "movie",
				key: `movie-${row.log.id}`,
				row,
			});
		}
	}

	const tvItems: DiaryLobbyTvGroupItem[] = [];
	for (const [tmdbId, logs] of tvById) {
		const sorted = sortLogsNewestFirst(logs);
		const listing = sorted[0]?.tv;
		if (!listing) continue;
		tvItems.push({
			kind: "tvGroup",
			key: `tv-${tmdbId}`,
			tmdbId,
			title: listing.title,
			posterPath: listing.posterPath,
			logs: sorted,
		});
	}

	return [...movieItems, ...tvItems].sort((a, b) =>
		compareGridItems(a, b, order),
	);
}
