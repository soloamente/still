import { cn } from "@still/ui/lib/utils";

import { formatLogRatingDisplay, logRatingToDisplay } from "@/lib/log-rating";

/**
 * Compact 0.0–10.0 score for diary surfaces — normalizes API tenths before display.
 */
export function DiaryLogRatingLabel({
	stored,
	className,
}: {
	stored: number | null | undefined;
	className?: string;
}) {
	const display = logRatingToDisplay(stored);
	if (display == null) return null;

	return (
		<span
			role="img"
			className={cn(
				"shrink-0 font-medium text-foreground text-xs tabular-nums leading-none",
				className,
			)}
			aria-label={`Rated ${formatLogRatingDisplay(display)} out of 10`}
		>
			{formatLogRatingDisplay(display)}
			<span className="font-normal text-muted-foreground">/10</span>
		</span>
	);
}
