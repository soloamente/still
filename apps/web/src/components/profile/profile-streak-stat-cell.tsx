"use client";

import { Flame } from "lucide-react";

import { useWatchStreak } from "@/lib/use-watch-streak";

/**
 * Compact streak number for the profile stats grid — own profile only.
 * Uses the same hook as ProfileWatchStreak but renders a single number + label cell.
 */
export function ProfileStreakStatCell() {
	const { streak, loading } = useWatchStreak();

	if (loading) {
		return (
			<div className="flex flex-col items-center gap-0.5">
				<div className="h-5 w-8 animate-pulse rounded bg-muted/40" />
				<span className="text-[10px] text-muted-foreground">streak</span>
			</div>
		);
	}

	if (!streak) return null;

	return (
		<div className="flex flex-col items-center gap-0.5">
			<span className="flex items-center gap-1 font-semibold text-foreground text-sm tabular-nums">
				<Flame className="size-3 shrink-0 text-muted-foreground" aria-hidden />
				{streak.currentStreak}
			</span>
			<span className="text-[10px] text-muted-foreground">streak</span>
		</div>
	);
}
