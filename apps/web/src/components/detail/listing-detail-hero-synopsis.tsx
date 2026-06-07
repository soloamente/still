"use client";

import { cn } from "@still/ui/lib/utils";
import { useState } from "react";

import { DetailDrawerScrollBody } from "@/components/movie/detail-drawer-scroll-body";
import { DetailVaulSheet } from "@/components/movie/detail-vaul-sheet";
import { resolveListingDetailHeroSynopsis } from "@/lib/listing-detail-hero-synopsis";

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
				<button
					type="button"
					className={cn(
						"t-review-slide t-review-slide--truncated t-review-slide--zone-hover group/synopsis w-full cursor-pointer select-none border-none bg-transparent p-0 text-center",
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

					<div aria-hidden className="t-review-slide__cta">
						<span className="t-review-slide__cta-label">View more</span>
					</div>
				</button>
			</div>

			<DetailVaulSheet
				open={sheetOpen}
				onOpenChange={setSheetOpen}
				title={`${title} — description`}
				description={`Full plot summary for ${title}.`}
			>
				<DetailDrawerScrollBody>
					<div className="mx-auto w-full max-w-md pb-8 text-center">
						<h2 className="text-balance font-sans font-semibold text-foreground text-xl leading-snug tracking-tight sm:text-2xl">
							{title}
						</h2>
						<p className="mt-4 text-pretty font-editorial text-base text-foreground/90 leading-relaxed sm:text-lg">
							{synopsis.full}
						</p>
					</div>
				</DetailDrawerScrollBody>
			</DetailVaulSheet>
		</>
	);
}
