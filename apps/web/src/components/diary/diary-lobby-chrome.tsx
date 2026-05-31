"use client";

import { DiaryCatalogOrderChips } from "@/components/diary/diary-catalog-order-chips";
import { DiaryMediaTabToolbar } from "@/components/diary/diary-media-tab-toolbar";
import { DiaryVenueChips } from "@/components/diary/diary-venue-chips";

/**
 * Diary lobby controls — order (left), Movies / TV (center), venue (right).
 * Mirrors `ProfileLobbyChrome` so patron ledgers feel consistent.
 */
export function DiaryLobbyChrome() {
	return (
		<div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-3">
			<div className="flex min-w-0 justify-start">
				<DiaryCatalogOrderChips />
			</div>

			<div className="flex min-w-0 justify-center">
				<DiaryMediaTabToolbar />
			</div>

			<div className="flex min-w-0 justify-end">
				<DiaryVenueChips />
			</div>
		</div>
	);
}
