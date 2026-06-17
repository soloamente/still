import IconHeartFilled from "@still/ui/icons/heart-filled";
import { cn } from "@still/ui/lib/utils";
import Link from "next/link";
import type { ReactNode } from "react";

import { PatronPortraitWithMetalTier } from "@/components/profile/patron-portrait-with-metal-tier";
import type { DiaryMetalTier } from "@/lib/diary-metal-tier";
import { formatStoredLogRatingDisplay } from "@/lib/log-rating";
import { inferAnimatedFromProfileUrl } from "@/lib/profile-media";

export type MovieDetailFollowingRating = {
	userId: string;
	handle: string;
	displayName: string;
	image: string | null;
	avatarIsAnimated: boolean;
	diaryMetalTier: DiaryMetalTier | null;
	rating: number | null;
	liked: boolean;
	watchedAt: string;
};

/**
 * Compact “From people you follow” row on film detail (brainstorm option A).
 * Shows avatar + score/favorite + @handle per patron; overflow as “+N more”.
 */
export function MovieDetailFollowingRatings({
	entries,
	moreCount,
	className,
}: {
	entries: MovieDetailFollowingRating[];
	moreCount: number;
	className?: string;
}) {
	if (entries.length === 0) return null;

	return (
		<section
			className={cn("mx-auto w-full max-w-xl px-2", className)}
			aria-label="Ratings from people you follow"
		>
			<MovieDetailSubsectionLabel>
				From people you follow
			</MovieDetailSubsectionLabel>
			<ul className="flex flex-wrap justify-center gap-x-4 gap-y-6 sm:gap-x-5">
				{entries.map((entry) => (
					<li key={entry.userId}>
						<FollowingRatingChip entry={entry} />
					</li>
				))}
				{moreCount > 0 ? (
					<li
						className="flex w-18 flex-col items-center gap-1.5 text-center sm:w-19"
						aria-label={`${moreCount} more followed patrons rated this title`}
					>
						<span className="flex size-11 items-center justify-center rounded-full bg-muted/50 font-medium text-foreground/80 text-sm tabular-nums">
							+{moreCount}
						</span>
						<span className="font-medium text-[11px] text-muted-foreground">
							more
						</span>
					</li>
				) : null}
			</ul>
		</section>
	);
}

function FollowingRatingChip({ entry }: { entry: MovieDetailFollowingRating }) {
	const scoreLabel = formatStoredLogRatingDisplay(entry.rating);
	const showFavorite = entry.liked && scoreLabel == null;

	return (
		<Link
			href={`/profile/${entry.handle}`}
			className={cn(
				"group flex w-18 flex-col items-center gap-1.5 rounded-xl text-center outline-none focus-visible:ring-2 focus-visible:ring-desert-orange/55 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:w-19",
				"transition-[transform,background-color] duration-(--aker-duration) ease-(--aker-ease)",
			)}
		>
			<span className="relative isolate size-11 overflow-visible rounded-full bg-muted active:scale-[0.96] motion-reduce:active:scale-100 [@media(hover:hover)]:group-hover:bg-foreground/10">
				<PatronPortraitWithMetalTier
					handle={entry.handle}
					avatarUrl={entry.image}
					name={entry.displayName}
					width={44}
					height={44}
					className="size-full rounded-full"
					isAnimated={inferAnimatedFromProfileUrl(
						entry.image,
						entry.avatarIsAnimated,
					)}
					diaryMetalTier={entry.diaryMetalTier}
				/>
			</span>
			<span className="font-semibold text-foreground text-sm tabular-nums leading-none">
				{scoreLabel != null ? (
					<>
						<span aria-hidden>★ </span>
						{scoreLabel}
					</>
				) : showFavorite ? (
					<span className="inline-flex items-center gap-0.5 text-desert-orange">
						<IconHeartFilled size="14px" aria-hidden />
						<span className="sr-only">Favorite</span>
						<span aria-hidden className="text-foreground text-xs">
							liked
						</span>
					</span>
				) : (
					<span className="text-muted-foreground text-xs">logged</span>
				)}
			</span>
			<span className="max-w-full truncate font-medium text-[11px] text-muted-foreground">
				{entry.handle}
			</span>
		</Link>
	);
}

function MovieDetailSubsectionLabel({ children }: { children: ReactNode }) {
	return (
		<p className="mb-5 text-center font-medium text-[10px] text-muted-foreground uppercase tracking-[0.2em]">
			{children}
		</p>
	);
}
