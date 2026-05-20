"use client";

import { cn } from "@still/ui/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
	type PointerEvent as ReactPointerEvent,
	useCallback,
	useId,
	useRef,
} from "react";

import { DetailMotionButton } from "@/components/movie/detail-motion-pressable";
import {
	clampLogRatingDisplay,
	formatLogRatingDisplay,
} from "@/lib/log-rating";

/**
 * Log-sheet track colors — explicit values so the bar does not vanish on `bg-card`
 * (theme `muted` is often the same raised ink as `--card`).
 */
const TRACK = {
	shell: "var(--log-rating-track-shell, oklch(0.34 0 0))",
	fill: "var(--log-rating-track-fill, oklch(0.68 0 0))",
	tail: "var(--log-rating-track-tail, oklch(0.28 0 0))",
	avgFill: "var(--log-rating-avg-fill, oklch(0.52 0 0))",
	accent: "var(--log-rating-accent, oklch(0.72 0.14 250))",
} as const;

function ratingFromClientX(rect: DOMRect, clientX: number): number {
	const ratio = (clientX - rect.left) / rect.width;
	return clampLogRatingDisplay(ratio * 10);
}

/**
 * Horizontal 0–10 rating control: one draggable track; community average is a static
 * fill from 0→avg (does not move). The accent number in the tail is the user score and
 * updates as the thumb moves.
 * Chevron buttons step by **1.0**; drag / track tap sets **0.1** precision.
 */
export function LogRatingSlider({
	value,
	onChange,
	/** TMDb or Still community average on 0–10 — static fill + label inside the same track as the thumb. */
	averageRating,
	className,
}: {
	value: number;
	onChange: (next: number) => void;
	averageRating?: number | null;
	className?: string;
}) {
	const trackRef = useRef<HTMLDivElement>(null);
	const labelId = useId();
	const fillPct = `${(value / 10) * 100}%`;
	const avgPct =
		averageRating != null && Number.isFinite(averageRating)
			? `${(clampLogRatingDisplay(averageRating) / 10) * 100}%`
			: null;

	const setFromPointer = useCallback(
		(clientX: number) => {
			const el = trackRef.current;
			if (!el) return;
			const rect = el.getBoundingClientRect();
			onChange(ratingFromClientX(rect, clientX));
		},
		[onChange],
	);

	function onTrackPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
		if (e.button !== 0) return;
		e.preventDefault();
		const el = trackRef.current;
		if (!el) return;
		el.setPointerCapture(e.pointerId);
		setFromPointer(e.clientX);

		const onMove = (ev: PointerEvent) => setFromPointer(ev.clientX);
		const onUp = () => {
			el.releasePointerCapture(e.pointerId);
			window.removeEventListener("pointermove", onMove);
			window.removeEventListener("pointerup", onUp);
			window.removeEventListener("pointercancel", onUp);
		};
		window.addEventListener("pointermove", onMove);
		window.addEventListener("pointerup", onUp);
		window.addEventListener("pointercancel", onUp);
	}

	function stepBy(delta: number) {
		onChange(clampLogRatingDisplay(value + delta));
	}

	const stepBtnClass =
		"inline-flex size-12 shrink-0 items-center justify-center rounded-2xl text-muted-foreground transition-colors duration-200 ease-out [@media(hover:hover)]:hover:text-foreground motion-reduce:transition-none";

	return (
		<div className={cn("mx-auto w-full max-w-sm space-y-2", className)}>
			<div className="flex gap-2">
				<div className="flex h-14 shrink-0 items-center">
					<DetailMotionButton
						className={stepBtnClass}
						style={{ backgroundColor: TRACK.shell }}
						aria-label="Decrease rating by 1"
						onClick={() => stepBy(-1)}
					>
						<ChevronLeft className="size-5" aria-hidden />
					</DetailMotionButton>
				</div>

				<div className="flex min-w-0 flex-1 flex-col">
					<div
						ref={trackRef}
						role="slider"
						tabIndex={0}
						aria-labelledby={labelId}
						aria-valuemin={0}
						aria-valuemax={10}
						aria-valuenow={value}
						aria-valuetext={`${formatLogRatingDisplay(value)} out of 10`}
						className="relative isolate h-14 w-full touch-none select-none overflow-hidden rounded-2xl"
						style={{ backgroundColor: TRACK.shell }}
						onPointerDown={onTrackPointerDown}
						onKeyDown={(e) => {
							if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
								e.preventDefault();
								stepBy(-0.1);
							}
							if (e.key === "ArrowRight" || e.key === "ArrowUp") {
								e.preventDefault();
								stepBy(0.1);
							}
						}}
					>
						{/*
						 * Layering (back → front): shell bg, static average 0→avg, tail from thumb→end,
						 * then user fill 0→thumb so light gray always meets the blue line (design comp).
						 * Average does not move — only the thumb does.
						 */}
						{avgPct ? (
							<span
								className="pointer-events-none absolute inset-y-0 left-0 z-1"
								style={{ width: avgPct, backgroundColor: TRACK.avgFill }}
								aria-hidden
							/>
						) : null}
						<span
							className="pointer-events-none absolute inset-y-0 right-0 z-1"
							style={{ left: fillPct, backgroundColor: TRACK.tail }}
							aria-hidden
						/>
						<span
							className="pointer-events-none absolute inset-y-0 left-0 z-2"
							style={{ width: fillPct, backgroundColor: TRACK.fill }}
							aria-hidden
						/>
						{/* Live user score in the dark tail — updates as the thumb moves */}
						<span
							className="pointer-events-none absolute inset-y-0 right-4 z-3 flex items-center font-semibold text-2xl tabular-nums tracking-tight"
							style={{ color: TRACK.accent }}
							aria-hidden
						>
							{formatLogRatingDisplay(value)}
						</span>
						<span
							className="pointer-events-none absolute top-1.5 bottom-1.5 z-4 w-[3px] rounded-full"
							style={{
								left: fillPct,
								backgroundColor: TRACK.accent,
								transform: "translateX(-50%)",
							}}
							aria-hidden
						/>
					</div>
				</div>

				<div className="flex h-14 shrink-0 items-center">
					<DetailMotionButton
						className={stepBtnClass}
						style={{ backgroundColor: TRACK.shell }}
						aria-label="Increase rating by 1"
						onClick={() => stepBy(1)}
					>
						<ChevronRight className="size-5" aria-hidden />
					</DetailMotionButton>
				</div>
			</div>

			<p id={labelId} className="sr-only">
				Your rating: {formatLogRatingDisplay(value)} out of 10
				{averageRating != null
					? `; average from other viewers ${formatLogRatingDisplay(averageRating)}`
					: ""}
			</p>
		</div>
	);
}
