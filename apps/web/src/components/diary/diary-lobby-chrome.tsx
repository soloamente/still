"use client";

import { cn } from "@still/ui/lib/utils";
import { useRef } from "react";

import { DiaryCatalogOrderChips } from "@/components/diary/diary-catalog-order-chips";
import { DiaryMediaTabToolbar } from "@/components/diary/diary-media-tab-toolbar";
import { DiaryVenueChips } from "@/components/diary/diary-venue-chips";
import {
	HOME_LOBBY_FILTER_ROW_CLASSNAME,
	HOME_LOBBY_SCROLL_FADE_LEFT_CLASSNAME,
	HOME_LOBBY_SCROLL_FADE_RIGHT_CLASSNAME,
} from "@/lib/home-lobby-catalogue-layout";
import {
	HORIZONTAL_OVERFLOW_RAIL_CLASSNAME,
	useHorizontalScrollFades,
} from "@/lib/use-horizontal-scroll-fades";

/**
 * Diary lobby controls — order (left), Movies / TV (center), venue (right).
 * Mirrors `ProfileLobbyChrome` so patron ledgers feel consistent.
 *
 * Mobile: row 1 — order chips + filters; row 2 — Movies / TV centered.
 * Desktop: classic 3-column grid with left / center / right alignment.
 */
export function DiaryLobbyChrome() {
	const scrollRef = useRef<HTMLDivElement>(null);
	const { showStartFade, showEndFade } = useHorizontalScrollFades(
		scrollRef,
		true,
	);

	return (
		<div className="flex w-full flex-col gap-2 sm:grid sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:gap-3">
			{/* Row 1 — order scroll rail + filters (desktop: cols 1 + 3 via contents) */}
			<div className={cn(HOME_LOBBY_FILTER_ROW_CLASSNAME, "sm:contents")}>
				<div className="relative min-w-0 flex-1 overflow-hidden sm:col-start-1 sm:overflow-visible">
					<div
						aria-hidden
						className={cn(
							HOME_LOBBY_SCROLL_FADE_LEFT_CLASSNAME,
							"transition-opacity duration-200 motion-reduce:transition-none sm:hidden",
							showStartFade ? "opacity-100" : "opacity-0",
						)}
					/>
					<div
						aria-hidden
						className={cn(
							HOME_LOBBY_SCROLL_FADE_RIGHT_CLASSNAME,
							"transition-opacity duration-200 motion-reduce:transition-none sm:hidden",
							showEndFade ? "opacity-100" : "opacity-0",
						)}
					/>
					<div
						ref={scrollRef}
						className={cn(
							HORIZONTAL_OVERFLOW_RAIL_CLASSNAME,
							"gap-0 pb-0 sm:overflow-visible",
						)}
						data-lenis-prevent-wheel
					>
						<DiaryCatalogOrderChips />
					</div>
				</div>

				<div className="flex shrink-0 items-center sm:col-start-3 sm:row-start-1 sm:justify-self-end">
					<DiaryVenueChips />
				</div>
			</div>

			{/* Row 2 mobile / center column desktop — Movies · TV Shows */}
			<div className="flex justify-center sm:col-start-2 sm:row-start-1">
				<DiaryMediaTabToolbar />
			</div>
		</div>
	);
}
