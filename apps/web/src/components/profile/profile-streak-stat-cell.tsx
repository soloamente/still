"use client";

import { Flame } from "lucide-react";

import { ProfileStatCell } from "@/components/profile/profile-stat-cell";
import { useWatchStreak } from "@/lib/use-watch-streak";

/** Streak metric for the profile stats row — own profile only. */
export function ProfileStreakStatCell() {
	const { streak, loading } = useWatchStreak();

	if (loading) {
		return (
			<ProfileStatCell
				value={
					<span
						className="inline-block h-5 w-6 animate-pulse rounded bg-muted/40"
						aria-hidden
					/>
				}
				label="Streak"
			/>
		);
	}

	const count = streak?.currentStreak ?? 0;

	return (
		<ProfileStatCell
			value={
				<span className="inline-flex items-center gap-1">
					<Flame
						className="size-3 shrink-0 text-muted-foreground"
						aria-hidden
					/>
					{count}
				</span>
			}
			label="Streak"
		/>
	);
}
