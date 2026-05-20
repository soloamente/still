"use client";

import { Button } from "@still/ui/components/button";
import { Pencil } from "lucide-react";
import { useRouter } from "next/navigation";

import type { DiaryLogRow } from "@/components/diary/diary-entry";
import { useQuickLog } from "@/components/log/quick-log-sheet";
import { normalizeDiaryLogWatchVenue } from "@/lib/diary-lobby-order";

/**
 * Opens the shared **Quick log** sheet in PATCH mode for this row — keeps diary tickets
 * free of invalid `<button>` inside `<a>` by living beside the title link instead.
 */
export function DiaryLogEditButton({ row }: { row: DiaryLogRow }) {
	const router = useRouter();
	const openQuickLog = useQuickLog((s) => s.open);
	const listing = row.movie ?? row.tv;
	if (!listing) return null;
	const isTv = row.tv != null && row.movie == null;

	return (
		<Button
			type="button"
			variant="ghost-light"
			size="pill"
			className="mt-2 w-full border border-white/25 bg-black/25 text-white text-xs hover:bg-black/35"
			onClick={() => {
				openQuickLog({
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
					onSuccess: () => {
						router.refresh();
					},
				});
			}}
		>
			<Pencil className="size-3.5 opacity-90" aria-hidden />
			Edit log
		</Button>
	);
}
