"use client";

import { cn } from "@still/ui/lib/utils";
import { Flame } from "lucide-react";

import { DetailMotionButton } from "@/components/movie/detail-motion-pressable";
import {
	DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
	DETAIL_MOTION_PRESSABLE_CLASS,
} from "@/lib/detail-action-motion";
import { useWatchStreak } from "@/lib/use-watch-streak";
import {
	watchStreakLabel,
	watchStreakStatusLine,
} from "@/lib/watch-streak-display";

export type { WatchStreakSnapshot } from "@/lib/watch-streak-types";

const shieldPillClassName = cn(
	"inline-flex shrink-0 items-center justify-center rounded-full bg-background px-3 py-1.5 font-semibold text-foreground text-xs",
	DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
	DETAIL_MOTION_PRESSABLE_CLASS,
);

/**
 * Compact diary streak chip on the signed-in patron profile — one pill, shields inline when calm.
 */
export function ProfileWatchStreak() {
	const { streak, loading, freezeBusy, freeze } = useWatchStreak();

	if (loading) {
		return (
			<div
				className="mt-3 flex justify-center"
				role="status"
				aria-live="polite"
			>
				<span className="sr-only">Loading streak</span>
				<div
					className="h-8 w-40 animate-pulse rounded-full bg-muted/35"
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

	return (
		<div className="mt-3 flex flex-wrap items-center justify-center gap-2">
			<div
				className={cn(
					"inline-flex max-w-full flex-wrap items-center justify-center gap-x-2 gap-y-0.5 rounded-full bg-background px-3 py-1.5 text-sm",
					streak.status === "at_risk" && "text-foreground",
				)}
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
				<span className="font-semibold text-foreground tabular-nums">
					{label}
				</span>
				{statusLine ? (
					<>
						<span aria-hidden className="text-muted-foreground/40">
							·
						</span>
						<span className="text-muted-foreground text-xs">{statusLine}</span>
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
			{streak.status === "at_risk" && streak.shieldsRemaining > 0 ? (
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
		</div>
	);
}
