"use client";

import { cn } from "@still/ui/lib/utils";
import { Flame } from "lucide-react";

import {
	DetailMotionButton,
	DetailMotionLink,
} from "@/components/movie/detail-motion-pressable";
import {
	DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
	DETAIL_MOTION_PRESSABLE_CLASS,
} from "@/lib/detail-action-motion";
import { useWatchStreak } from "@/lib/use-watch-streak";
import {
	watchStreakLabel,
	watchStreakStatusLine,
} from "@/lib/watch-streak-display";

const actionPillClassName = cn(
	"inline-flex shrink-0 items-center justify-center rounded-full bg-card px-3 py-1.5 font-semibold text-foreground text-xs",
	DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
	DETAIL_MOTION_PRESSABLE_CLASS,
);

const shieldPillClassName = cn(
	"inline-flex shrink-0 items-center justify-center rounded-full bg-background px-3 py-1.5 font-semibold text-foreground text-xs",
	DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
	DETAIL_MOTION_PRESSABLE_CLASS,
);

/**
 * Diary streak summary on Achievements — same habit loop as the profile chip, with best run.
 */
export function AchievementsWatchStreakCard() {
	const { streak, loading, freezeBusy, freeze } = useWatchStreak();

	if (loading) {
		return (
			<div className="mx-auto w-full max-w-md" role="status" aria-live="polite">
				<span className="sr-only">Loading streak</span>
				<div
					className="h-20 w-full animate-pulse rounded-2xl bg-muted/30"
					aria-hidden
				/>
			</div>
		);
	}

	if (!streak) return null;

	const hasCount = streak.currentStreak > 0;
	const label = watchStreakLabel(streak.currentStreak);
	const statusLine = watchStreakStatusLine(streak, hasCount);
	const showInlineShields =
		streak.shieldsRemaining > 0 && streak.status !== "at_risk";
	const showDiaryNudge =
		!hasCount || streak.status === "at_risk" || streak.status === "broken";
	const showShieldAction =
		streak.status === "at_risk" && streak.shieldsRemaining > 0;
	const showActions = showShieldAction || showDiaryNudge;

	return (
		<div className="mx-auto w-full max-w-md rounded-2xl bg-background px-5 py-3 text-center">
			<div
				className={cn(
					"flex min-w-0 flex-col items-center",
					showActions && "gap-3 sm:gap-4",
				)}
			>
				<div className="flex min-w-0 flex-col items-center space-y-1 text-center">
					<div
						className="inline-flex max-w-full flex-wrap items-center justify-center gap-x-2 gap-y-0.5"
						role="status"
					>
						<Flame
							className={cn(
								"size-3.5 shrink-0",
								streak.status === "at_risk"
									? "text-foreground"
									: "text-muted-foreground",
							)}
							aria-hidden
						/>
						<span className="font-semibold text-foreground text-sm tabular-nums">
							{label}
						</span>
						{statusLine ? (
							<>
								<span aria-hidden className="text-muted-foreground/40">
									·
								</span>
								<span className="text-muted-foreground text-xs">
									{statusLine}
								</span>
							</>
						) : null}
						{showInlineShields ? (
							<>
								<span aria-hidden className="text-muted-foreground/40">
									·
								</span>
								<span className="text-muted-foreground text-xs tabular-nums">
									{streak.shieldsRemaining} shield
									{streak.shieldsRemaining === 1 ? "" : "s"}
								</span>
							</>
						) : null}
					</div>
					{streak.longestStreak > 0 ? (
						<p className="text-muted-foreground text-xs tabular-nums">
							Best run{" "}
							<span className="font-medium text-foreground">
								{streak.longestStreak} day
								{streak.longestStreak === 1 ? "" : "s"}
							</span>
						</p>
					) : null}
				</div>

				{showActions ? (
					<div className="flex flex-wrap items-center justify-center gap-2">
						{showShieldAction ? (
							<DetailMotionButton
								type="button"
								disabled={freezeBusy}
								className={shieldPillClassName}
								onClick={() => void freeze()}
							>
								{freezeBusy
									? "Activating…"
									: `Use shield (${streak.shieldsRemaining})`}
							</DetailMotionButton>
						) : null}
						{showDiaryNudge ? (
							<DetailMotionLink href="/diary" className={actionPillClassName}>
								Go to diary
							</DetailMotionLink>
						) : null}
					</div>
				) : null}
			</div>
		</div>
	);
}
