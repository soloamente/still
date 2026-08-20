"use client";

import { cn } from "@still/ui/lib/utils";
import {
	type ReactNode,
	type PointerEvent as ReactPointerEvent,
	useCallback,
	useId,
	useRef,
	useState,
} from "react";
import { DETAIL_CANVAS_ON_CARD_HOVER_CLASS } from "@/lib/detail-action-motion";

/** Visible thumb diameter (`size-4`). */
const THUMB_PX = 16;
/** Keep the thumb inset from track ends so it stays grabable. */
const EDGE_PAD_PX = 10;
/** Pull the thumb further left of the fill tip so it sits on the filled side. */
const THUMB_BEHIND_FILL_PX = 12;

function valueToUnit(value: number, min: number, max: number): number {
	if (max <= min) return 0;
	return Math.min(1, Math.max(0, (value - min) / (max - min)));
}

function unitToValue(unit: number, min: number, max: number): number {
	return min + Math.min(1, Math.max(0, unit)) * (max - min);
}

/**
 * Thumb left edge — left of the fill tip, clamped so ends keep `EDGE_PAD_PX`.
 * Fill itself ignores this inset and uses the full track width.
 */
function thumbLeftCss(unit: number): string {
	const fillTip = `${unit * 100}%`;
	const ideal = `calc(${fillTip} - ${THUMB_PX + THUMB_BEHIND_FILL_PX}px)`;
	const maxLeft = `calc(100% - ${EDGE_PAD_PX + THUMB_PX}px)`;
	return `max(${EDGE_PAD_PX}px, min(${ideal}, ${maxLeft}))`;
}

export type SenseTrackSliderProps = {
	value: number;
	min: number;
	max: number;
	/** Step for ± buttons and arrow keys. */
	step?: number;
	onChange: (value: number) => void;
	/** Accessible name for the slider. */
	label: string;
	/** When false, only the track shows (full width — poster cards). Default true. */
	showStepButtons?: boolean;
	decreaseLabel?: string;
	increaseLabel?: string;
	decreaseIcon?: ReactNode;
	increaseIcon?: ReactNode;
	/** Optional live value string for `aria-valuetext`. */
	valueText?: string;
	className?: string;
	/** Focus ring offset surface — card dialogs vs canvas. */
	ringOffsetClassName?: string;
};

/**
 * Shared Sense track — optional ± pills, full-width fill, inset thumb left of the tip.
 * Used by crop zoom and onboarding taste ratings.
 */
export function SenseTrackSlider({
	value,
	min,
	max,
	step = 0.05,
	onChange,
	label,
	showStepButtons = true,
	decreaseLabel = "Decrease",
	increaseLabel = "Increase",
	decreaseIcon,
	increaseIcon,
	valueText,
	className,
	ringOffsetClassName = "focus-visible:ring-offset-card",
}: SenseTrackSliderProps) {
	const labelId = useId();
	const trackRef = useRef<HTMLDivElement>(null);
	const [isDragging, setIsDragging] = useState(false);
	const isDraggingRef = useRef(false);
	const dragRectRef = useRef<DOMRect | null>(null);

	const unit = valueToUnit(value, min, max);
	const thumbLeft = thumbLeftCss(unit);
	const fillWidth = `${unit * 100}%`;
	const canDecrease = value > min + 0.001;
	const canIncrease = value < max - 0.001;

	const setFromClientX = useCallback(
		(clientX: number) => {
			const el = trackRef.current;
			if (!el) return;
			const rect = dragRectRef.current ?? el.getBoundingClientRect();
			const nextUnit = (clientX - rect.left) / Math.max(1, rect.width);
			onChange(unitToValue(nextUnit, min, max));
		},
		[max, min, onChange],
	);

	const finishDrag = useCallback((pointerId: number) => {
		if (!isDraggingRef.current) return;
		const el = trackRef.current;
		isDraggingRef.current = false;
		setIsDragging(false);
		dragRectRef.current = null;
		if (el?.hasPointerCapture(pointerId)) {
			el.releasePointerCapture(pointerId);
		}
	}, []);

	function onTrackPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
		if (e.button !== 0) return;
		e.preventDefault();
		const el = trackRef.current;
		if (!el) return;
		dragRectRef.current = el.getBoundingClientRect();
		isDraggingRef.current = true;
		setIsDragging(true);
		el.setPointerCapture(e.pointerId);
		setFromClientX(e.clientX);
	}

	function stepBy(delta: number) {
		const next = Math.min(max, Math.max(min, value + delta));
		// Keep one decimal for rating-like ranges when step is 0.1 / 0.5.
		onChange(Math.round(next * 100) / 100);
	}

	const stepBtnClass = cn(
		"inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-background text-muted-foreground transition-[color,background-color,transform] duration-200 ease-out",
		"active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-35 motion-reduce:transition-none motion-reduce:active:scale-100",
		DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
		"[@media(hover:hover)]:hover:text-foreground",
	);

	return (
		<div className={cn("flex items-center gap-2.5", className)}>
			<span id={labelId} className="sr-only">
				{label}
			</span>
			{showStepButtons ? (
				<button
					type="button"
					className={stepBtnClass}
					aria-label={decreaseLabel}
					disabled={!canDecrease}
					onClick={() => stepBy(-step)}
				>
					{decreaseIcon}
				</button>
			) : null}

			<div
				ref={trackRef}
				role="slider"
				tabIndex={0}
				aria-labelledby={labelId}
				aria-valuemin={min}
				aria-valuemax={max}
				aria-valuenow={Number(value.toFixed(2))}
				aria-valuetext={valueText}
				className={cn(
					"relative isolate h-10 min-h-10 min-w-0 flex-1 cursor-grab touch-none select-none overflow-hidden rounded-full bg-background",
					"[-webkit-tap-highlight-color:transparent] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
					ringOffsetClassName,
					isDragging && "cursor-grabbing",
				)}
				onPointerDown={onTrackPointerDown}
				onPointerMove={(e) => {
					if (!isDraggingRef.current) return;
					setFromClientX(e.clientX);
				}}
				onPointerUp={(e) => finishDrag(e.pointerId)}
				onPointerCancel={(e) => finishDrag(e.pointerId)}
				onKeyDown={(e) => {
					if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
						e.preventDefault();
						stepBy(-step);
					}
					if (e.key === "ArrowRight" || e.key === "ArrowUp") {
						e.preventDefault();
						stepBy(step);
					}
					if (e.key === "Home") {
						e.preventDefault();
						onChange(min);
					}
					if (e.key === "End") {
						e.preventDefault();
						onChange(max);
					}
				}}
			>
				<span
					className={cn(
						"pointer-events-none absolute inset-y-0 left-0 z-1 rounded-full bg-foreground/18",
						!isDragging && "sense-track-slider__fill-motion",
					)}
					style={{ width: fillWidth }}
					aria-hidden
				/>
				<span
					className={cn(
						"pointer-events-none absolute top-1/2 z-2 size-4 -translate-y-1/2 rounded-full bg-foreground shadow-sm",
						!isDragging && "sense-track-slider__thumb-motion",
					)}
					style={{ left: thumbLeft }}
					aria-hidden
				/>
			</div>

			{showStepButtons ? (
				<button
					type="button"
					className={stepBtnClass}
					aria-label={increaseLabel}
					disabled={!canIncrease}
					onClick={() => stepBy(step)}
				>
					{increaseIcon}
				</button>
			) : null}
		</div>
	);
}
