import type { DiaryLogRow } from "@/components/diary/diary-entry";
import type { QuickLogArgs } from "@/components/log/quick-log-sheet";
import { normalizeDiaryLogWatchVenue } from "@/lib/diary-lobby-order";

/** Builds Quick Log PATCH payload for a diary row — shared by ticket edit and TV group rows. */
export function diaryLogToQuickLogOpenPayload(
	row: DiaryLogRow,
	onSuccess: () => void,
): QuickLogArgs | null {
	const listing = row.movie ?? row.tv;
	if (!listing) return null;
	const isTv = row.tv != null && row.movie == null;

	return {
		logId: row.log.id,
		...(isTv ? { tvId: listing.tmdbId } : { movieId: listing.tmdbId }),
		movieTitle:
			listing.title + (listing.year != null ? ` (${listing.year})` : ""),
		posterUrl: listing.posterPath,
		watchedAt: row.log.watchedAt,
		rating: row.log.rating,
		note: row.log.note,
		liked: row.log.liked,
		rewatch: row.log.rewatch,
		watchVenue: normalizeDiaryLogWatchVenue(row.log.watchVenue),
		...(row.log.visibility ? { visibility: row.log.visibility } : {}),
		...(isTv
			? {
					logScope: row.log.logScope ?? "show",
					seasonNumber: row.log.seasonNumber ?? undefined,
					episodeNumber: row.log.episodeNumber ?? undefined,
				}
			: {}),
		onSuccess,
	};
}
