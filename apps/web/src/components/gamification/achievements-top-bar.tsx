"use client";

import IconShareIn from "@still/ui/icons/share-in";
import { cn } from "@still/ui/lib/utils";

import { DetailMotionLink } from "@/components/movie/detail-motion-pressable";
import { useMovieDetailReturn } from "@/components/movie/use-movie-detail-return";

/**
 * Achievements sticky header — same three-column shell as `ProfileTopBar`
 * (back pill, centered title, balanced gutters).
 */
export function AchievementsTopBar() {
	const back = useMovieDetailReturn();

	const pill = cn(
		"inline-flex min-h-10 items-center gap-2 rounded-full px-4 py-2 font-medium text-sm transition-colors duration-200 ease-out",
		"bg-card text-foreground [@media(hover:hover)]:hover:bg-muted/35",
		"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
	);

	return (
		<header className="sticky top-0 z-30 w-full overflow-visible bg-background">
			<div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2 px-2.5 py-2 sm:px-3">
				<div className="flex min-w-0 justify-start">
					<DetailMotionLink
						href={back.href}
						className={cn(pill, "max-w-full pl-3")}
					>
						<IconShareIn size="20px" className="shrink-0 opacity-90" />
						<span className="truncate">{back.label}</span>
					</DetailMotionLink>
				</div>
				<p className="max-w-[min(100%,12rem)] truncate text-center font-medium text-foreground text-sm sm:max-w-xs">
					Achievements
				</p>
				<div className="min-w-0" aria-hidden />
			</div>
		</header>
	);
}
