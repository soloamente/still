import type { DiaryLogRow } from "@/components/diary/diary-entry";
import type { HomeCatalogSort } from "@/lib/home-catalog-sort";
import {
	defaultHomeVenueForSort,
	type HomeVenue,
	parseHomeVenue,
} from "@/lib/home-venue";
import type { TvLogScope } from "@/lib/tv-watch-types";

/**
 * Diary has no `?sort=` row — treat venue defaults like home **Popular** (streaming-first)
 * so a bare `/diary` URL matches **At home** until the patron taps **In cinemas**.
 */
export const DIARY_LOBBY_VENUE_SORT_AS: HomeCatalogSort = "popular";

/** Resolves `?venue=` on `/diary` using the same tokens as `/home` (`theaters` / `streaming`). */
export function parseDiaryLobbyVenue(
	raw: string | null | undefined,
): HomeVenue {
	return parseHomeVenue(raw, DIARY_LOBBY_VENUE_SORT_AS);
}

/** Normalises persisted `log.watch_venue` for edit forms — unknown/absent → **streaming**. */
export function normalizeDiaryLogWatchVenue(
	raw: DiaryLogRow["log"]["watchVenue"],
): HomeVenue {
	if (raw === "theaters" || raw === "streaming") return raw;
	return "streaming";
}

/** Reads venue from Eden/Drizzle camelCase or legacy snake_case JSON. */
function readLogWatchVenueRaw(
	log: DiaryLogRow["log"] & { watch_venue?: unknown },
): unknown {
	if (log.watchVenue === "theaters" || log.watchVenue === "streaming") {
		return log.watchVenue;
	}
	return log.watch_venue;
}

/**
 * Normalises each row after `GET /api/logs/me` — some stacks still surface `watch_venue`
 * while the UI types expect `watchVenue`.
 */
function readTvLogScope(
	log: DiaryLogRow["log"] & {
		log_scope?: unknown;
		season_number?: unknown;
		episode_number?: unknown;
	},
): {
	logScope: TvLogScope;
	seasonNumber: number | null;
	episodeNumber: number | null;
} {
	const rawScope = log.logScope ?? log.log_scope;
	const logScope: TvLogScope =
		rawScope === "episode" || rawScope === "season" || rawScope === "show"
			? rawScope
			: "show";
	const sn = log.seasonNumber ?? log.season_number;
	const en = log.episodeNumber ?? log.episode_number;
	return {
		logScope,
		seasonNumber: typeof sn === "number" ? sn : null,
		episodeNumber: typeof en === "number" ? en : null,
	};
}

export function coerceDiaryLogRows(rows: DiaryLogRow[]): DiaryLogRow[] {
	return rows.map((row) => {
		const logRaw = row.log as DiaryLogRow["log"] & {
			watch_venue?: unknown;
			log_scope?: unknown;
			season_number?: unknown;
			episode_number?: unknown;
		};
		const raw = readLogWatchVenueRaw(logRaw);
		const watchVenue =
			raw === "theaters" || raw === "streaming" ? raw : undefined;
		const scopeFields = readTvLogScope(logRaw);
		const base = row as DiaryLogRow & { tv?: DiaryLogRow["tv"] };
		return {
			...row,
			movie: row.movie ?? null,
			tv: base.tv ?? null,
			log: {
				...row.log,
				watchVenue,
				...scopeFields,
			},
		};
	});
}

/**
 * How to order diary screenings in the lobby grid — driven by `?order=` on `/diary`
 * (separate from `/home` `?sort=` so TMDb catalogue params never collide).
 */
export type DiaryLobbyOrder = "latest_seen" | "earliest_seen" | "title_az";

/** Rows the lobby can render — need either a joined `movie` or `tv` for the poster grid. */
export type DiaryLogWithListing =
	| (DiaryLogRow & { movie: NonNullable<DiaryLogRow["movie"]> })
	| (DiaryLogRow & { tv: NonNullable<DiaryLogRow["tv"]> });

export function isDiaryLogWithListing(
	row: DiaryLogRow,
): row is DiaryLogWithListing {
	return row.movie != null || row.tv != null;
}

/** @deprecated Use `DiaryLogWithListing` — kept for a short transition while imports settle. */
export type DiaryLogWithMovie = DiaryLogWithListing;

/** @deprecated Use `isDiaryLogWithListing`. */
export const isDiaryLogWithMovie = isDiaryLogWithListing;

function diaryListingTitle(row: DiaryLogWithListing): string {
	if (row.movie) return row.movie.title;
	if (row.tv) return row.tv.title;
	return "";
}

/**
 * Diary lobby venue filter — rows **without** an explicit venue (legacy imports / older clients)
 * stay visible in **both** slices until the patron edits the log.
 */
export function diaryLogMatchesDiaryLobbyVenue(
	row: DiaryLogWithListing,
	lobbyVenue: HomeVenue,
): boolean {
	const v = row.log.watchVenue;
	if (v !== "theaters" && v !== "streaming") return true;
	return v === lobbyVenue;
}

function compareDiaryLobbyRows(
	a: DiaryLogWithListing,
	b: DiaryLogWithListing,
	order: DiaryLobbyOrder,
): number {
	switch (order) {
		case "latest_seen":
			return (
				new Date(b.log.watchedAt).getTime() -
				new Date(a.log.watchedAt).getTime()
			);
		case "earliest_seen":
			return (
				new Date(a.log.watchedAt).getTime() -
				new Date(b.log.watchedAt).getTime()
			);
		case "title_az": {
			const t = diaryListingTitle(a).localeCompare(
				diaryListingTitle(b),
				undefined,
				{
					sensitivity: "base",
				},
			);
			if (t !== 0) return t;
			return (
				new Date(b.log.watchedAt).getTime() -
				new Date(a.log.watchedAt).getTime()
			);
		}
		default: {
			const _exhaustive: never = order;
			return _exhaustive;
		}
	}
}

/** Stable sort for the diary lobby — mutates a copy only. */
export function sortDiaryLobbyRowsForOrder(
	rows: DiaryLogWithListing[],
	order: DiaryLobbyOrder,
): DiaryLogWithListing[] {
	return rows.slice().sort((a, b) => compareDiaryLobbyRows(a, b, order));
}

/** Short query tokens for shareable URLs (`?order=earliest`, etc.). */
function orderToParam(order: DiaryLobbyOrder): string {
	switch (order) {
		case "latest_seen":
			return "latest";
		case "earliest_seen":
			return "earliest";
		case "title_az":
			return "title";
		default: {
			const _exhaustive: never = order;
			return _exhaustive;
		}
	}
}

/** Normalises `?order=` for the diary lobby — shared by the RSC page and client chip strip. */
export function parseDiaryLobbyOrder(
	raw: string | undefined | null,
): DiaryLobbyOrder {
	const s = raw?.trim().toLowerCase() ?? "";
	if (s === "earliest" || s === "oldest" || s === "first")
		return "earliest_seen";
	if (s === "title" || s === "a-z" || s === "az") return "title_az";
	if (
		s === "latest" ||
		s === "newest" ||
		s === "latest_seen" ||
		s.length === 0
	) {
		return "latest_seen";
	}
	return "latest_seen";
}

/**
 * Builds `/diary` query links — omits default **`order`** and default **`venue`** so shareable
 * URLs stay short (`/diary`, `/diary?venue=theaters`, `/diary?order=earliest&venue=theaters`, …).
 */
export function buildDiaryLobbyHref(input: {
	order: DiaryLobbyOrder;
	venue: HomeVenue;
}): string {
	const params = new URLSearchParams();
	if (input.order !== "latest_seen") {
		params.set("order", orderToParam(input.order));
	}
	const defaultVenue = defaultHomeVenueForSort(DIARY_LOBBY_VENUE_SORT_AS);
	if (input.venue !== defaultVenue) {
		params.set("venue", input.venue);
	}
	const qs = params.toString();
	return qs.length > 0 ? `/diary?${qs}` : "/diary";
}
