import type { ProfileFilmographyRow } from "@/components/profile/profile-filmography-panel";
import type {
	ProfileSocialTabId,
	ProfileTabId,
} from "@/components/profile/profile-tab-toolbar";
import type {
	ProfileLedgerTabId,
	ProfileLobbyOrder,
} from "@/lib/profile-lobby-order";
import { sortProfileFilmographyRows } from "@/lib/profile-lobby-order";

function readLogWatchVenue(
	log: ProfileFilmographyRow["log"] & { watch_venue?: unknown },
): ProfileFilmographyRow["log"]["watchVenue"] {
	if (log.watchVenue === "theaters" || log.watchVenue === "streaming") {
		return log.watchVenue;
	}
	const raw = log.watch_venue;
	if (raw === "theaters" || raw === "streaming") return raw;
	return undefined;
}

function compareFilmographyRecency(
	a: ProfileFilmographyRow,
	b: ProfileFilmographyRow,
): number {
	const aw = new Date(a.log.watchedAt).getTime();
	const bw = new Date(b.log.watchedAt).getTime();
	if (aw !== bw) return bw - aw;
	const ac =
		"createdAt" in a.log && a.log.createdAt
			? new Date(a.log.createdAt as string | Date).getTime()
			: 0;
	const bc =
		"createdAt" in b.log && b.log.createdAt
			? new Date(b.log.createdAt as string | Date).getTime()
			: 0;
	if (ac !== bc) return bc - ac;
	return b.log.id.localeCompare(a.log.id);
}

/** One row per film or series — keeps the newest log when the patron rewatched a title. */
export function filmographyFromRecentlyWatched(
	recentlyWatched: ProfileFilmographyRow[],
): ProfileFilmographyRow[] {
	const byKey = new Map<string, ProfileFilmographyRow>();
	for (const row of recentlyWatched) {
		const key = row.movie
			? `m:${row.movie.tmdbId}`
			: row.tv
				? `t:${row.tv.tmdbId}`
				: null;
		if (!key) continue;
		const existing = byKey.get(key);
		if (!existing || compareFilmographyRecency(row, existing) < 0) {
			const log = row.log as ProfileFilmographyRow["log"] & {
				watch_venue?: unknown;
			};
			byKey.set(key, {
				...row,
				log: {
					...log,
					watchVenue: readLogWatchVenue(log),
				},
			});
		}
	}
	return [...byKey.values()].sort(compareFilmographyRecency);
}

export function profileInitials(displayName: string): string {
	const parts = displayName.trim().split(/\s+/).filter(Boolean);
	if (!parts.length) return "?";
	if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
	const a = parts[0][0];
	const b = parts[parts.length - 1][0];
	return `${a}${b}`.toUpperCase();
}

export function splitProfileFilmographyLedger(rows: ProfileFilmographyRow[]) {
	const movieRows = rows.filter((r) => r.movie != null);
	const tvRows = rows.filter((r) => r.tv != null);
	return { movieRows, tvRows };
}

export function resolveProfileTab(
	raw: string | undefined | null,
	socialTabs: readonly ProfileSocialTabId[],
	movieRows: ProfileFilmographyRow[],
	tvRows: ProfileFilmographyRow[],
): ProfileTabId {
	let v = raw?.toLowerCase();
	if (v === "filmography") {
		v = movieRows.length > 0 ? "movies" : tvRows.length > 0 ? "tv" : "movies";
	}
	const available: ProfileTabId[] = ["movies", "tv", ...socialTabs];
	if (v && (available as readonly string[]).includes(v))
		return v as ProfileTabId;
	if (movieRows.length > 0) return "movies";
	if (tvRows.length > 0) return "tv";
	return socialTabs[0] ?? "movies";
}

/** Counts-based default-tab resolution — mirrors `resolveProfileTab` without rows. */
export function resolveProfileTabFromCounts(
	raw: string | undefined | null,
	socialTabs: readonly ProfileSocialTabId[],
	counts: { movies: number; tv: number },
): ProfileTabId {
	let v = raw?.toLowerCase();
	if (v === "filmography") {
		v = counts.movies > 0 ? "movies" : counts.tv > 0 ? "tv" : "movies";
	}
	const available: ProfileTabId[] = ["movies", "tv", ...socialTabs];
	if (v && (available as readonly string[]).includes(v)) {
		return v as ProfileTabId;
	}
	if (counts.movies > 0) return "movies";
	if (counts.tv > 0) return "tv";
	return socialTabs[0] ?? "movies";
}

export function titleCountLineForProfileTab(
	tab: ProfileTabId,
	movieCount: number,
	tvCount: number,
	favoritesOnly: boolean,
	reviewsCount: number,
	listsCount: number,
): string | null {
	if (tab === "favorites" && movieCount > 0) {
		return `${movieCount} favorite film${movieCount === 1 ? "" : "s"}`;
	}
	if (tab === "movies" && movieCount > 0) {
		return `${movieCount} film${movieCount === 1 ? "" : "s"} logged`;
	}
	if (tab === "tv" && tvCount > 0) {
		if (favoritesOnly) {
			return `${tvCount} favorite show${tvCount === 1 ? "" : "s"}`;
		}
		return `${tvCount} TV show${tvCount === 1 ? "" : "s"} logged`;
	}
	if (tab === "reviews" && reviewsCount > 0) {
		return `${reviewsCount} review${reviewsCount === 1 ? "" : "s"}`;
	}
	if (tab === "lists" && listsCount > 0) {
		return `${listsCount} list${listsCount === 1 ? "" : "s"}`;
	}
	return null;
}

export function prepareProfileFilmography(
	recentlyWatched: ProfileFilmographyRow[],
	order: ProfileLobbyOrder,
) {
	return sortProfileFilmographyRows(
		filmographyFromRecentlyWatched(recentlyWatched),
		order,
	);
}

export function profileLedgerTabFromContent(
	contentTab: ProfileTabId,
): ProfileLedgerTabId {
	return contentTab === "tv" ? "tv" : "movies";
}
