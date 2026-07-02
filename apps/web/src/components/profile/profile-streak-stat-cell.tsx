"use client";

import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@still/ui/components/popover";
import IconStreakFlameFilled from "@still/ui/icons/streak-flame-filled";
import { cn } from "@still/ui/lib/utils";
import { useState } from "react";

import { ProfileActivitySignature } from "@/components/profile/profile-activity-signature";
import { PROFILE_HEADER_PILL_PRESS_CLASS } from "@/components/profile/profile-stat-cell";
import { useWatchStreak } from "@/lib/use-watch-streak";

/** Shared pill shell — matches `ProfileStatCell` variant="pill". */
const STREAK_PILL_CLASS =
	"inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-background px-3 text-sm font-medium text-foreground tabular-nums";

/**
 * Own-profile streak count in the header stat rail — tap opens the 52-week diary heatmap.
 */
export function ProfileStreakStatCell({ handle }: { handle: string }) {
	const { streak, loading } = useWatchStreak();
	const [open, setOpen] = useState(false);

	if (loading) {
		return (
			<span
				aria-hidden
				className={cn(STREAK_PILL_CLASS, "animate-pulse text-muted-foreground")}
			>
				<span className="size-[18px] rounded-full bg-muted" />
				<span className="inline-block h-3.5 w-5 rounded bg-muted" />
			</span>
		);
	}

	const count = streak?.currentStreak ?? 0;
	const streakLabel =
		count === 1 ? "1 day streak" : `${count.toLocaleString()} day streak`;

	return (
		<Popover open={open} onOpenChange={setOpen} modal={false}>
			<PopoverTrigger
				render={
					<button
						type="button"
						className={cn(
							STREAK_PILL_CLASS,
							PROFILE_HEADER_PILL_PRESS_CLASS,
							"cursor-pointer",
						)}
						aria-label={`${streakLabel}. Show diary activity`}
					>
						<IconStreakFlameFilled
							aria-hidden
							className="size-[18px] shrink-0 text-foreground"
						/>
						<span aria-hidden>{count.toLocaleString()}</span>
					</button>
				}
			/>
			<PopoverContent
				align="end"
				side="bottom"
				sideOffset={8}
				className="w-[min(calc(100vw-2rem),28rem)] rounded-2xl border-0 bg-background p-4 shadow-mobbin-xl"
			>
				<p className="mb-3 font-medium text-[10px] text-muted-foreground uppercase tracking-[0.12em]">
					Diary rhythm
				</p>
				{/* Mount heatmap only while open — avoids client fetch on initial profile paint. */}
				{open ? (
					<ProfileActivitySignature
						className="mx-0"
						handle={handle}
						variant="embedded"
					/>
				) : null}
			</PopoverContent>
		</Popover>
	);
}
