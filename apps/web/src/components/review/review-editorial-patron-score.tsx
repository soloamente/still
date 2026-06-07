import IconPatronScoreLeafLeft from "@still/ui/icons/patron-score-leaf-left";
import IconPatronScoreLeafRight from "@still/ui/icons/patron-score-leaf-right";

import { formatStoredLogRatingDisplay } from "@/lib/log-rating";

/** Patron score laurels — movie detail review rail + review reader drawer. */
export function ReviewEditorialPatronScore({ rating }: { rating: number }) {
	const scoreLabel = formatStoredLogRatingDisplay(rating);

	return (
		<div className="flex items-center justify-center gap-2 sm:gap-2.5">
			<span className="sr-only">Rated {scoreLabel} out of 10</span>
			<IconPatronScoreLeafLeft
				className="h-8 w-auto shrink-0 text-foreground/55 sm:h-9"
				aria-hidden
			/>
			<span className="font-sans font-semibold text-foreground text-lg tabular-nums tracking-tight sm:text-xl">
				{scoreLabel}
			</span>
			<IconPatronScoreLeafRight
				className="h-8 w-auto shrink-0 text-foreground/55 sm:h-9"
				aria-hidden
			/>
		</div>
	);
}
