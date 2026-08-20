"use client";

import { cn } from "@still/ui/lib/utils";
import { useEffect, useState } from "react";

import {
	computeDiscordActivityProgress,
	formatDiscordActivityElapsedLabel,
} from "@/lib/discord-activity-display";
import type { ProfileDiscordActivity } from "@/lib/fetch-profile-discord-activity-client";

type DiscordActivityProgressBarProps = {
	progress: NonNullable<ProfileDiscordActivity["progress"]>;
	className?: string;
	/** Tailwind fill when no inline cover accent is available. */
	fillClassName?: string;
	/** Cover-derived accent — wins over `fillClassName` when set. */
	fillColor?: string | null;
};

/**
 * Live elapsed progress for Discord listening / rich presence timestamps.
 * Updates once per second; respects reduced motion by skipping transition.
 */
export function DiscordActivityProgressBar({
	progress,
	className,
	fillClassName = "bg-foreground/55",
	fillColor = null,
}: DiscordActivityProgressBarProps) {
	const [nowMs, setNowMs] = useState(() => Date.now());

	useEffect(() => {
		const timer = window.setInterval(() => {
			setNowMs(Date.now());
		}, 1_000);
		return () => window.clearInterval(timer);
	}, []);

	const computed = computeDiscordActivityProgress(progress, nowMs);
	if (!computed) return null;

	const { ratio, elapsedMs } = computed;

	return (
		<div className={cn("flex min-w-0 items-center gap-2.5", className)}>
			<div
				className="relative h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-foreground/10"
				role="progressbar"
				aria-valuemin={0}
				aria-valuemax={100}
				aria-valuenow={Math.round(ratio * 100)}
				aria-label="Track progress"
			>
				<div
					className={cn(
						"h-full rounded-full transition-[width] duration-1000 ease-linear motion-reduce:transition-none",
						fillColor ? null : fillClassName,
					)}
					style={{
						width: `${ratio * 100}%`,
						...(fillColor ? { backgroundColor: fillColor } : {}),
					}}
				/>
			</div>
			<span className="shrink-0 font-medium text-muted-foreground text-xs tabular-nums">
				{formatDiscordActivityElapsedLabel(elapsedMs)}
			</span>
		</div>
	);
}
