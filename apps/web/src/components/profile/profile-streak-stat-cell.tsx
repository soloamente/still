"use client";

import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@still/ui/components/popover";
import {
	Tooltip,
	TooltipArrow,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@still/ui/components/tooltip";
import IconStreakFlameFilled from "@still/ui/icons/streak-flame-filled";
import { cn } from "@still/ui/lib/utils";
import { useState } from "react";

import { ProfileActivitySignature } from "@/components/profile/profile-activity-signature";
import { PROFILE_HEADER_PILL_PRESS_CLASS } from "@/components/profile/profile-stat-cell";
import {
	markProfileStreakHintSeen,
	readProfileStreakHintSeen,
} from "@/lib/profile-streak-hint-seen";
import { useProfileWatchStreak } from "@/lib/use-profile-watch-streak";
import { useWatchStreak } from "@/lib/use-watch-streak";

/** Shared pill shell — matches `ProfileStatCell` variant="pill". */
const STREAK_PILL_CLASS =
	"inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-background px-3 text-sm font-medium text-foreground tabular-nums";

type ProfileStreakStatCellProps = {
	handle: string;
	isMe: boolean;
};

/**
 * Profile header streak pill — tap opens the 52-week diary rhythm heatmap.
 * Shown on own profile and when visiting other patrons.
 */
export function ProfileStreakStatCell({
	handle,
	isMe,
}: ProfileStreakStatCellProps) {
	return isMe ? (
		<OwnProfileStreakStatCell handle={handle} />
	) : (
		<VisitorProfileStreakStatCell handle={handle} />
	);
}

function ProfileStreakStatCellView({
	handle,
	count,
	loading,
}: {
	handle: string;
	count: number;
	loading: boolean;
}) {
	const [popoverOpen, setPopoverOpen] = useState(false);
	// Sync read on mount — avoids uncontrolled→controlled flip after useEffect.
	const [hintPinnedOpen, setHintPinnedOpen] = useState(
		() => !readProfileStreakHintSeen(),
	);
	const [hoverOpen, setHoverOpen] = useState(false);

	const dismissHint = () => {
		setHintPinnedOpen(false);
		setHoverOpen(false);
		markProfileStreakHintSeen();
	};

	const handlePopoverOpenChange = (next: boolean) => {
		setPopoverOpen(next);
		if (next) dismissHint();
	};

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

	const streakLabel =
		count === 1 ? "1 day streak" : `${count.toLocaleString()} day streak`;

	// Pinned hint forces open; after dismiss, hover drives open state.
	const tooltipOpen = hintPinnedOpen ? !popoverOpen : hoverOpen;

	return (
		<TooltipProvider delay={hintPinnedOpen ? 0 : 280} closeDelay={80}>
			<Popover
				open={popoverOpen}
				onOpenChange={handlePopoverOpenChange}
				modal={false}
			>
				{/* Discoverability hint — pinned open once; hover-only after dismiss. */}
				<Tooltip
					open={tooltipOpen}
					onOpenChange={(next) => {
						if (hintPinnedOpen) {
							if (!next) dismissHint();
							return;
						}
						setHoverOpen(next);
					}}
					disabled={popoverOpen}
				>
					<TooltipTrigger
						render={
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
						}
					/>
					<TooltipContent
						side="top"
						align="end"
						className="max-w-none whitespace-nowrap"
					>
						Now the diary rhythm is here — click to see
						<TooltipArrow />
					</TooltipContent>
				</Tooltip>
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
					{popoverOpen ? (
						<ProfileActivitySignature
							className="mx-0"
							handle={handle}
							variant="embedded"
						/>
					) : null}
				</PopoverContent>
			</Popover>
		</TooltipProvider>
	);
}

function OwnProfileStreakStatCell({ handle }: { handle: string }) {
	const { streak, loading } = useWatchStreak();
	return (
		<ProfileStreakStatCellView
			handle={handle}
			count={streak?.currentStreak ?? 0}
			loading={loading}
		/>
	);
}

function VisitorProfileStreakStatCell({ handle }: { handle: string }) {
	const { currentStreak, loading } = useProfileWatchStreak(handle);
	return (
		<ProfileStreakStatCellView
			handle={handle}
			count={currentStreak}
			loading={loading}
		/>
	);
}
