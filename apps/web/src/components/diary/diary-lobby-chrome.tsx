"use client";

import { DiaryCatalogOrderChips } from "@/components/diary/diary-catalog-order-chips";
import { DiaryMediaTabToolbar } from "@/components/diary/diary-media-tab-toolbar";
import { DiaryVenueChips } from "@/components/diary/diary-venue-chips";

/**
 * Diary lobby controls — order (left), Movies / TV (center), venue (right).
 * Mirrors `ProfileLobbyChrome` so patron ledgers feel consistent.
 *
 * Mobile-first: the three chip groups stack in a single column so the `shrink-0`
 * venue rail can't overflow a narrow grid track and collide with the others;
 * the order/center/venue 3-up grid only kicks in from `sm` where it fits.
 */
export function DiaryLobbyChrome() {
	return (
		<div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:gap-3">
			<div className="flex min-w-0 justify-start">
				<DiaryCatalogOrderChips />
			</div>

			<div className="flex min-w-0 justify-start sm:justify-center">
				<DiaryMediaTabToolbar />
			</div>

			<div className="flex min-w-0 justify-start sm:justify-end">
				<DiaryVenueChips />
			</div>
		</div>
	);
}
