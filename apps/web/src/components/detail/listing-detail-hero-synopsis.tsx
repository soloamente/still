"use client";

import { Button } from "@still/ui/components/button";
import { cn } from "@still/ui/lib/utils";
import { useRef, useState } from "react";

import { DetailDrawerScrollBody } from "@/components/movie/detail-drawer-scroll-body";
import { DetailMotionButtonWrap } from "@/components/movie/detail-motion-pressable";
import { DetailVaulSheet } from "@/components/movie/detail-vaul-sheet";
import { SheetScrollScrims } from "@/components/movie/sheet-scroll-scrims";
import { ReviewSlideCursorCtaButton } from "@/components/review/review-slide-cursor-cta-button";
import { resolveListingDetailHeroSynopsis } from "@/lib/listing-detail-hero-synopsis";
import { SHEET_PRIMARY_PILL_CLASS } from "@/lib/sheet-chrome";
import { useSheetScrollFades } from "@/lib/use-sheet-scroll-fades";

const SYNOPSIS_MAX_WIDTH_CLASS = "max-w-md";

const SYNOPSIS_TEXT_CLASS = `w-full ${SYNOPSIS_MAX_WIDTH_CLASS} text-pretty text-muted-foreground text-sm sm:text-base leading-relaxed`;

/** Hero overview clamp — long TMDb overviews use the review-slide blur + CTA. */
const SYNOPSIS_LINE_CLAMP_CLASS = "line-clamp-5";

/** Press feedback — same modal scale token as review carousel slides. */
const SYNOPSIS_PRESS_CLASS =
	"transition-transform duration-[var(--page-slide-dur)] ease-[var(--page-slide-ease)] motion-reduce:transition-none active:scale-[var(--modal-scale)] motion-reduce:active:scale-100";

/**
 * Hero synopsis under film/TV title. Long overviews truncate; hover blurs and
 * invites a tap to read the full description (review-carousel pattern).
 */
export function ListingDetailHeroSynopsis({
	title,
	overview,
	className,
}: {
	title: string;
	overview: string | null | undefined;
	className?: string;
}) {
	const synopsis = resolveListingDetailHeroSynopsis(overview);
	const [sheetOpen, setSheetOpen] = useState(false);
	const scrollRef = useRef<HTMLDivElement>(null);
	const scrollFadesKey = synopsis
		? `${title}:${synopsis.full.length}`
		: "closed";
	const { showHeaderFade, showFooterFade } = useSheetScrollFades(
		scrollRef,
		sheetOpen,
		scrollFadesKey,
	);

	if (!synopsis) return null;

	if (!synopsis.isTruncated) {
		return (
			<p className={cn("mt-4", SYNOPSIS_TEXT_CLASS, className)}>
				{synopsis.full}
			</p>
		);
	}

	const handleOpen = () => {
		setSheetOpen(true);
	};

	return (
		<>
			{/* zone-hover: blur + CTA on any hover inside the hero synopsis block. */}
			<div
				className={cn(
					"relative mt-4 w-full",
					SYNOPSIS_MAX_WIDTH_CLASS,
					className,
				)}
			>
				<ReviewSlideCursorCtaButton
					label="View more"
					className={cn(
						"t-review-slide t-review-slide--truncated t-review-slide--zone-hover group/synopsis w-full select-none border-none bg-transparent p-0 text-center",
						SYNOPSIS_PRESS_CLASS,
						"[-webkit-tap-highlight-color:transparent]",
					)}
					aria-haspopup="dialog"
					aria-label={`Read full description for ${title}`}
					onClick={handleOpen}
				>
					<div className="t-review-slide__post w-full">
						<p
							data-review-body=""
							className={cn(
								SYNOPSIS_TEXT_CLASS,
								SYNOPSIS_LINE_CLAMP_CLASS,
								"outline-none",
							)}
						>
							{synopsis.full}
						</p>
					</div>
				</ReviewSlideCursorCtaButton>
			</div>

			<DetailVaulSheet
				open={sheetOpen}
				onOpenChange={setSheetOpen}
				title={`${title} — description`}
				description={`Full plot summary for ${title}.`}
			>
				{/* Match create-list / quote-suggest sheet chrome — scrollport + edge scrims. */}
				<div className="relative isolate flex min-h-0 w-full flex-1 flex-col">
					<DetailDrawerScrollBody scrollRef={scrollRef}>
						<div className="mx-auto w-full max-w-xl pt-2 pb-10">
							<header className="mx-auto mb-8 max-w-md text-center">
								<h2 className="text-balance font-semibold text-foreground text-xl sm:text-2xl">
									Description
								</h2>
								<p className="mt-2 text-balance font-sans font-semibold text-base text-foreground leading-snug sm:text-lg">
									{title}
								</p>
							</header>

							<p className="mx-auto max-w-md text-pretty text-center font-editorial text-base text-foreground/90 leading-relaxed sm:text-lg">
								{synopsis.full}
							</p>

							<footer className="mt-10 flex justify-center px-1">
								<DetailMotionButtonWrap>
									<Button
										type="button"
										variant="default"
										size="pill"
										className={cn(SHEET_PRIMARY_PILL_CLASS, "min-w-34")}
										onClick={() => setSheetOpen(false)}
									>
										Done
									</Button>
								</DetailMotionButtonWrap>
							</footer>
						</div>
					</DetailDrawerScrollBody>
					<SheetScrollScrims
						showHeaderFade={showHeaderFade}
						showFooterFade={showFooterFade}
						footerTone="default"
					/>
				</div>
			</DetailVaulSheet>
		</>
	);
}
