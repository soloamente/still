"use client";

import { cn } from "@still/ui/lib/utils";

type ReviewAudioSpectrumProps = {
	/** Normalized bar heights (0–1). */
	peaks: number[];
	/** Playback or record progress (0–1) — drives the scrub line. */
	progress: number;
	/** Show the vertical playhead while reproducing. */
	showPlayhead?: boolean;
	/** Flat stage strip on the recorder card vs compact inline chip. */
	variant?: "inline" | "stage";
	className?: string;
	"aria-hidden"?: boolean;
};

/** Spectrum bars with an optional playback playhead — no extra chrome on stage variant. */
export function ReviewAudioSpectrum({
	peaks,
	progress,
	showPlayhead = false,
	variant = "inline",
	className,
	"aria-hidden": ariaHidden,
}: ReviewAudioSpectrumProps) {
	const clampedProgress = Math.min(1, Math.max(0, progress));
	const playheadLeft = `${(clampedProgress * 100).toFixed(2)}%`;
	const isStage = variant === "stage";

	return (
		<div
			className={cn(
				"relative flex w-full items-end gap-px sm:gap-0.5",
				isStage
					? "h-20 sm:h-24"
					: "h-10 overflow-hidden rounded-xl bg-card px-1.5 py-2",
				className,
			)}
			aria-hidden={ariaHidden}
		>
			{peaks.map((peak, index) => {
				const barKey = `review-audio-spectrum-bar-${index}`;
				return (
					<div
						key={barKey}
						className={cn(
							"min-w-0 flex-1 rounded-full bg-foreground/20 transition-[height] duration-150 ease-out motion-reduce:transition-none",
							isStage && "bg-foreground/25",
						)}
						style={{
							height: `${Math.round(Math.min(1, Math.max(isStage ? 0.06 : 0.08, peak)) * 100)}%`,
						}}
					/>
				);
			})}
			{showPlayhead ? (
				<div
					className="pointer-events-none absolute inset-y-0 w-px bg-foreground/75 motion-reduce:transition-none"
					style={{
						left: playheadLeft,
						transition: "left 120ms linear",
					}}
				/>
			) : null}
		</div>
	);
}
