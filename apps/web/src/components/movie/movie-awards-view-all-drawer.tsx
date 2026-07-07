"use client";

import { cn } from "@still/ui/lib/utils";
import { useRef, useState } from "react";

import { DetailDrawerScrollBody } from "@/components/movie/detail-drawer-scroll-body";
import { DetailMotionButton } from "@/components/movie/detail-motion-pressable";
import { DetailVaulSheet } from "@/components/movie/detail-vaul-sheet";
import { FestivalRecognitionGrid } from "@/components/movie/festival-recognition-grid";
import { SheetScrollScrims } from "@/components/movie/sheet-scroll-scrims";
import { DETAIL_CANVAS_ON_CARD_HOVER_CLASS } from "@/lib/detail-action-motion";
import type { FestivalRecognitionEntry } from "@/lib/movie-festival-recognition";
import { useSheetScrollFades } from "@/lib/use-sheet-scroll-fades";

/**
 * Full awards & festivals catalogue — opens from the About tab when the inline
 * grid is capped at twelve festival columns.
 */
export function MovieAwardsViewAllDrawer({
	listingTitle,
	entries,
}: {
	listingTitle: string;
	entries: FestivalRecognitionEntry[];
}) {
	const scrollRef = useRef<HTMLDivElement>(null);
	const [open, setOpen] = useState(false);
	const contentKey = `${listingTitle}:${entries.length}`;

	const { showHeaderFade, showFooterFade } = useSheetScrollFades(
		scrollRef,
		open,
		contentKey,
	);

	const awardLineCount = entries.reduce(
		(total, entry) => total + entry.lines.length,
		0,
	);

	return (
		<DetailVaulSheet
			open={open}
			onOpenChange={setOpen}
			scrollLock={false}
			title={`Awards & festivals — ${listingTitle}`}
			description={`${entries.length} festival and award groups, ${awardLineCount} recognition lines for ${listingTitle}.`}
			trigger={
				<DetailMotionButton
					type="button"
					className={cn(
						"inline-flex items-center justify-center rounded-full bg-background px-5 py-2.5 font-medium text-foreground text-sm",
						"transition-colors duration-200 ease-out motion-reduce:transition-none",
						DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
						"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
					)}
				>
					View all awards
				</DetailMotionButton>
			}
		>
			<div className="relative isolate flex min-h-0 w-full flex-1 flex-col">
				<DetailDrawerScrollBody scrollRef={scrollRef}>
					<div className="mx-auto w-full max-w-6xl px-2 pb-6 sm:px-4">
						<p className="mx-auto mb-8 max-w-2xl text-balance text-center font-editorial text-muted-foreground text-sm leading-relaxed sm:text-base">
							{entries.length} festival and award{" "}
							{entries.length === 1 ? "group" : "groups"}
							{awardLineCount > 0
								? ` · ${awardLineCount} wins and nominations`
								: null}
						</p>
						<FestivalRecognitionGrid entries={entries} />
					</div>
				</DetailDrawerScrollBody>
				<SheetScrollScrims
					showHeaderFade={showHeaderFade}
					showFooterFade={showFooterFade}
					footerTone="filmography"
				/>
			</div>
		</DetailVaulSheet>
	);
}
