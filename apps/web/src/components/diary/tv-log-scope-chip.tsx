import { formatTvLogScopeLabel } from "@/lib/tv-log-scope-display";
import type { TvLogScope } from "@/lib/tv-watch-types";

/** Small scope label for TV diary rows (ticket stub or poster overlay). */
export function TvLogScopeChip({
	logScope,
	seasonNumber,
	episodeNumber,
	className,
}: {
	logScope?: TvLogScope | null;
	seasonNumber?: number | null;
	episodeNumber?: number | null;
	className?: string;
}) {
	const label = formatTvLogScopeLabel(logScope, seasonNumber, episodeNumber);
	return (
		<span
			className={
				className ??
				"inline-flex rounded-full bg-white/15 px-2 py-0.5 font-medium text-[10px] text-white/90 tracking-wide"
			}
		>
			{label}
		</span>
	);
}
