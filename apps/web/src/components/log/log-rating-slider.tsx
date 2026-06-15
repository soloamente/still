"use client";

import { cn } from "@still/ui/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTheme } from "next-themes";
import {
	type PointerEvent as ReactPointerEvent,
	useCallback,
	useEffect,
	useId,
	useLayoutEffect,
	useRef,
	useState,
} from "react";

import { DetailMotionButton } from "@/components/movie/detail-motion-pressable";
import { DEFAULT_APP_THEME_CLASS, resolveAppTheme } from "@/lib/app-themes";
import {
	clampLogRatingDisplay,
	formatLogRatingDisplay,
} from "@/lib/log-rating";

/** transitions.dev card-resize tokens on width/left — off while dragging for 0.1 precision. */
const TRACK_FILL_MOTION_CLASS = "log-rating-slider__fill-motion";

function ratingFromClientX(rect: DOMRect, clientX: number): number {
	if (rect.width <= 0) return 0;
	const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
	return clampLogRatingDisplay(ratio * 10);
}

/** Per-character spans for transitions.dev number pop-in (last two chars stagger). */
function splitRatingLabelDigits(label: string) {
	const chars = label.split("");
	return chars.map((char, index) => ({
		char,
		stagger:
			index === chars.length - 2
				? ("1" as const)
				: index === chars.length - 1
					? ("2" as const)
					: undefined,
	}));
}

function readDigitPopInDurationMs(group: HTMLElement): number {
	const slider = group.closest(".log-rating-slider");
	const tokenSource = slider ?? document.documentElement;
	const styles = getComputedStyle(tokenSource);
	const dur =
		Number.parseFloat(styles.getPropertyValue("--digit-dur").trim()) || 320;
	const stagger =
		Number.parseFloat(styles.getPropertyValue("--digit-stagger").trim()) || 45;
	return dur + stagger * 2 + 32;
}

function readTextSwapDurationMs(el: HTMLElement): number {
	const slider = el.closest(".log-rating-slider") ?? document.documentElement;
	const styles = getComputedStyle(slider);
	const parsed = Number.parseFloat(
		styles.getPropertyValue("--text-swap-dur").trim(),
	);
	return Number.isFinite(parsed) ? parsed : 150;
}

/** transitions.dev text-states-swap — Rate ↔ live score on compact zero-state tiles. */
function runTextStateSwap(el: HTMLElement, next: string) {
	const dur = readTextSwapDurationMs(el);
	el.classList.add("is-exit");
	window.setTimeout(() => {
		el.textContent = next;
		el.classList.remove("is-exit");
		el.classList.add("is-enter-start");
		void el.offsetHeight;
		el.classList.remove("is-enter-start");
	}, dur);
}

/**
 * Compact taste tile readout while value is still 0 — placeholder at rest,
 * text-swap into live score on drag, plain updates while dragging.
 */
function CompactZeroScoreReadout({
	placeholder,
	value,
	isDragging,
	className,
}: {
	placeholder: string;
	value: number;
	isDragging: boolean;
	className?: string;
}) {
	const ref = useRef<HTMLSpanElement>(null);
	const prevDraggingRef = useRef(false);
	const mountedRef = useRef(false);

	useLayoutEffect(() => {
		const el = ref.current;
		if (!el) return;

		if (!mountedRef.current) {
			mountedRef.current = true;
			prevDraggingRef.current = isDragging;
			return;
		}

		if (isDragging && !prevDraggingRef.current) {
			runTextStateSwap(el, formatLogRatingDisplay(value));
		} else if (!isDragging && prevDraggingRef.current) {
			runTextStateSwap(el, placeholder);
		}

		prevDraggingRef.current = isDragging;
	}, [isDragging, placeholder, value]);

	useLayoutEffect(() => {
		if (!isDragging) return;
		const el = ref.current;
		if (!el) return;
		el.textContent = formatLogRatingDisplay(value);
	}, [isDragging, value]);

	return (
		<span
			ref={ref}
			className={cn(
				"t-text-swap inline-block tabular-nums tracking-tight",
				isDragging
					? "font-semibold text-sm"
					: "font-medium text-muted-foreground text-xs",
				className,
			)}
		>
			{isDragging ? formatLogRatingDisplay(value) : placeholder}
		</span>
	);
}

/**
 * Live score readout in the track tail — digit pop-in on discrete updates
 * (chevrons, keyboard, drag release). Plain text while dragging avoids
 * re-triggering the animation on every 0.1 step.
 */
function LogRatingScoreDigits({
	value,
	isDragging,
	className,
	animateDigits = true,
	placeholderWhenZero,
}: {
	value: number;
	isDragging: boolean;
	className?: string;
	animateDigits?: boolean;
	/** Shown when value is 0 and not dragging (compact onboarding tiles). */
	placeholderWhenZero?: string;
}) {
	const label = formatLogRatingDisplay(value);
	const groupRef = useRef<HTMLSpanElement>(null);
	const prevLabelRef = useRef<string | null>(null);
	const wasDraggingRef = useRef(false);
	const animTimerRef = useRef<number | null>(null);

	const playDigitPopIn = useCallback(() => {
		if (!animateDigits) return;
		const group = groupRef.current;
		if (!group) return;

		if (animTimerRef.current != null) {
			window.clearTimeout(animTimerRef.current);
		}

		// transitions.dev: remove class → reflow → re-add class (sync, no rAF batching).
		group.classList.remove("is-animating");
		void group.offsetWidth;
		group.classList.add("is-animating");

		animTimerRef.current = window.setTimeout(() => {
			group.classList.remove("is-animating");
			animTimerRef.current = null;
		}, readDigitPopInDurationMs(group));
	}, [animateDigits]);

	useLayoutEffect(() => {
		if (!animateDigits) return;
		const group = groupRef.current;
		if (!group) return;

		if (isDragging) {
			wasDraggingRef.current = true;
			prevLabelRef.current = label;
			group.classList.remove("is-animating");
			return;
		}

		const justReleasedDrag = wasDraggingRef.current;
		wasDraggingRef.current = false;

		// First paint: digits without entrance motion (compact first commit plays pop-in).
		if (prevLabelRef.current === null) {
			prevLabelRef.current = label;
			if (value > 0 && placeholderWhenZero) {
				playDigitPopIn();
			}
			return;
		}

		const labelChanged = prevLabelRef.current !== label;
		if (!labelChanged && !justReleasedDrag) return;

		prevLabelRef.current = label;
		playDigitPopIn();
	}, [
		animateDigits,
		isDragging,
		label,
		placeholderWhenZero,
		playDigitPopIn,
		value,
	]);

	useEffect(() => {
		return () => {
			if (animTimerRef.current != null) {
				window.clearTimeout(animTimerRef.current);
			}
		};
	}, []);

	if (placeholderWhenZero && value <= 0 && !isDragging) {
		return (
			<CompactZeroScoreReadout
				className={className}
				isDragging={isDragging}
				placeholder={placeholderWhenZero}
				value={value}
			/>
		);
	}

	const digits = splitRatingLabelDigits(label);

	return (
		<span
			ref={groupRef}
			className={cn(
				"inline-flex items-baseline font-semibold text-2xl tabular-nums tracking-tight",
				animateDigits && !isDragging && "t-digit-group",
				className,
			)}
		>
			{isDragging || !animateDigits
				? label
				: digits.map((digit, index) => (
						<span
							// biome-ignore lint/suspicious/noArrayIndexKey: fixed slots per label length; orchestration toggles parent class.
							key={index}
							className="t-digit"
							data-stagger={digit.stagger}
						>
							{digit.char}
						</span>
					))}
		</span>
	);
}

/**
 * Horizontal 0–10 rating control: one draggable track; community average is a static
 * fill from 0→avg (does not move). The accent number in the tail is the user score and
 * updates as the thumb moves.
 * Chevron buttons step by **1.0**; drag / track tap sets **0.1** precision.
 * **`compact`** — track-only row for narrow surfaces (e.g. onboarding taste tiles).
 */
export function LogRatingSlider({
	value,
	onChange,
	/** TMDb or Sense community average on 0–10 — static fill + label inside the same track as the thumb. */
	averageRating,
	className,
	variant = "default",
}: {
	value: number;
	onChange: (next: number) => void;
	averageRating?: number | null;
	className?: string;
	variant?: "default" | "compact";
}) {
	const { resolvedTheme } = useTheme();
	const appTheme = resolveAppTheme(resolvedTheme ?? DEFAULT_APP_THEME_CLASS);
	const trackRef = useRef<HTMLDivElement>(null);
	const avatarGroupRef = useRef<HTMLDivElement>(null);
	const labelId = useId();
	const [isDragging, setIsDragging] = useState(false);
	/** Live pointer value while dragging — defers 0 commits so parent state stays stable. */
	const [dragValue, setDragValue] = useState<number | null>(null);
	const isDraggingRef = useRef(false);
	const dragValueRef = useRef<number | null>(null);
	const dragRectRef = useRef<DOMRect | null>(null);

	const displayValue = isDragging && dragValue != null ? dragValue : value;

	/** transitions.dev avatar-group-hover — comb lift across chevron | track | chevron. */
	const setAvatarShifts = useCallback(
		(activeIdx: number | null, phase: "in" | "out") => {
			const root = avatarGroupRef.current;
			if (!root) return;

			const styles = getComputedStyle(root);
			const readNum = (name: string, fallback: number) => {
				const parsed = Number.parseFloat(styles.getPropertyValue(name).trim());
				return Number.isFinite(parsed) ? parsed : fallback;
			};
			const readEase = (name: string, fallback: string) =>
				styles.getPropertyValue(name).trim() || fallback;

			const lift = readNum("--avatar-lift", -3);
			const falloff = readNum("--avatar-falloff", 0.5);
			const scale = readNum("--avatar-scale", 1.03);
			const timing =
				phase === "out"
					? readEase("--avatar-ease-out", "cubic-bezier(0.34, 3.85, 0.64, 1)")
					: readEase("--avatar-ease-in", "cubic-bezier(0.22, 1, 0.36, 1)");

			root.querySelectorAll<HTMLElement>(".t-avatar").forEach((el, index) => {
				el.style.transitionTimingFunction = timing;
				if (activeIdx == null) {
					el.style.setProperty("--shift", "0px");
					el.style.setProperty("--scale-active", "1");
					return;
				}
				const distance = Math.abs(index - activeIdx);
				el.style.setProperty(
					"--shift",
					`${(lift * falloff ** distance).toFixed(3)}px`,
				);
				el.style.setProperty(
					"--scale-active",
					index === activeIdx ? String(scale) : "1",
				);
			});
		},
		[],
	);

	const fillPct = `${(displayValue / 10) * 100}%`;
	const avgPct =
		averageRating != null && Number.isFinite(averageRating)
			? `${(clampLogRatingDisplay(averageRating) / 10) * 100}%`
			: null;

	const commitDragValue = useCallback(
		(next: number) => {
			dragValueRef.current = next;
			setDragValue(next);
			// Hold rating in parent while scrubbing through zero — clear only on release.
			if (next > 0) {
				onChange(next);
			}
		},
		[onChange],
	);

	const setFromPointer = useCallback(
		(clientX: number) => {
			const el = trackRef.current;
			if (!el) return;
			const rect = dragRectRef.current ?? el.getBoundingClientRect();
			commitDragValue(ratingFromClientX(rect, clientX));
		},
		[commitDragValue],
	);

	const finishDrag = useCallback(
		(pointerId: number) => {
			if (!isDraggingRef.current) return;
			const el = trackRef.current;
			const finalValue = dragValueRef.current ?? value;
			isDraggingRef.current = false;
			dragValueRef.current = null;
			setIsDragging(false);
			setDragValue(null);
			dragRectRef.current = null;
			if (finalValue <= 0) {
				onChange(0);
			} else {
				onChange(finalValue);
			}
			if (el?.hasPointerCapture(pointerId)) {
				el.releasePointerCapture(pointerId);
			}
		},
		[onChange, value],
	);

	function onTrackPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
		if (e.button !== 0) return;
		e.preventDefault();
		const el = trackRef.current;
		if (!el) return;
		dragRectRef.current = el.getBoundingClientRect();
		isDraggingRef.current = true;
		setIsDragging(true);
		el.setPointerCapture(e.pointerId);
		setFromPointer(e.clientX);
	}

	function onTrackPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
		if (!isDraggingRef.current) return;
		setFromPointer(e.clientX);
	}

	function onTrackPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
		finishDrag(e.pointerId);
	}

	function onTrackPointerCancel(e: ReactPointerEvent<HTMLDivElement>) {
		finishDrag(e.pointerId);
	}

	function stepBy(delta: number) {
		onChange(clampLogRatingDisplay(displayValue + delta));
	}

	const stepBtnClass =
		"log-rating-slider__step inline-flex size-12 shrink-0 items-center justify-center rounded-2xl text-muted-foreground transition-[color,box-shadow] duration-200 ease-out disabled:cursor-not-allowed disabled:opacity-35 [@media(hover:hover)]:hover:text-foreground motion-reduce:transition-none";

	const fillMotion = isDragging ? undefined : TRACK_FILL_MOTION_CLASS;

	const trackNode = (
		<div
			className={cn(
				"relative flex min-w-0 flex-1 flex-col",
				variant === "default" && "t-avatar",
			)}
		>
			<div
				ref={trackRef}
				role="slider"
				tabIndex={0}
				aria-labelledby={labelId}
				aria-valuemin={0}
				aria-valuemax={10}
				aria-valuenow={displayValue}
				aria-valuetext={`${formatLogRatingDisplay(displayValue)} out of 10`}
				className={cn(
					"log-rating-slider__track relative isolate w-full cursor-grab touch-none select-none overflow-hidden [-webkit-tap-highlight-color:transparent] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
					variant === "compact"
						? "h-10 min-h-10 rounded-xl focus-visible:ring-offset-2 focus-visible:ring-offset-background"
						: "h-14 rounded-2xl focus-visible:ring-offset-2 focus-visible:ring-offset-card",
					isDragging && "cursor-grabbing",
				)}
				onPointerDown={onTrackPointerDown}
				onPointerMove={onTrackPointerMove}
				onPointerUp={onTrackPointerUp}
				onPointerCancel={onTrackPointerCancel}
				onMouseEnter={
					variant === "default" ? () => setAvatarShifts(1, "in") : undefined
				}
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
				{avgPct ? (
					<span
						className={cn(
							"log-rating-slider__avg pointer-events-none absolute inset-y-0 left-0 z-1",
							fillMotion,
						)}
						style={{ width: avgPct }}
						aria-hidden
					/>
				) : null}
				<span
					className={cn(
						"log-rating-slider__tail pointer-events-none absolute inset-y-0 right-0 z-1",
						fillMotion,
					)}
					style={{ left: fillPct }}
					aria-hidden
				/>
				<span
					className={cn(
						"log-rating-slider__fill pointer-events-none absolute inset-y-0 left-0 z-2",
						fillMotion,
					)}
					style={{ width: fillPct }}
					aria-hidden
				/>
				<span
					className={cn(
						"log-rating-slider__thumb pointer-events-none absolute z-4 rounded-full",
						variant === "compact"
							? "top-1.5 bottom-1.5 w-1"
							: "top-1.5 bottom-1.5 w-[3px]",
						fillMotion,
					)}
					style={{
						left: fillPct,
						transform: "translateX(-50%)",
					}}
					aria-hidden
				/>
			</div>
			<span
				className={cn(
					"pointer-events-none absolute inset-y-0 z-10 flex items-center",
					variant === "compact" ? "right-2.5" : "right-4",
				)}
				aria-hidden
			>
				<LogRatingScoreDigits
					value={displayValue}
					isDragging={isDragging}
					placeholderWhenZero={variant === "compact" ? "Rate" : undefined}
					className={cn(
						"log-rating-slider__score",
						variant === "compact" &&
							"font-semibold text-sm tabular-nums tracking-tight",
					)}
				/>
			</span>
		</div>
	);

	// Keep grabbing cursor if the pointer leaves the track mid-drag.
	useEffect(() => {
		if (!isDragging) return;
		const previous = document.body.style.cursor;
		document.body.style.cursor = "grabbing";
		return () => {
			document.body.style.cursor = previous;
		};
	}, [isDragging]);

	// Bouncy comb reset when the pointer leaves the chevron | track row.
	useEffect(() => {
		const root = avatarGroupRef.current;
		if (!root) return;
		const onLeave = () => setAvatarShifts(null, "out");
		root.addEventListener("mouseleave", onLeave);
		return () => root.removeEventListener("mouseleave", onLeave);
	}, [setAvatarShifts]);

	if (variant === "compact") {
		return (
			<div
				className={cn("log-rating-slider w-full touch-manipulation", className)}
				data-theme={appTheme}
				data-variant="compact"
			>
				{trackNode}
				<p id={labelId} className="sr-only">
					Your rating: {formatLogRatingDisplay(displayValue)} out of 10
				</p>
			</div>
		);
	}

	return (
		<div
			className={cn(
				"log-rating-slider mx-auto w-full max-w-sm space-y-2",
				className,
			)}
			data-theme={appTheme}
		>
			<div
				ref={avatarGroupRef}
				className="t-avatar-group flex touch-manipulation gap-2.5"
			>
				<div className="t-avatar flex h-14 shrink-0 items-center">
					<DetailMotionButton
						className={stepBtnClass}
						aria-label="Decrease rating by 1"
						disabled={displayValue <= 0}
						onMouseEnter={() => setAvatarShifts(0, "in")}
						onClick={() => stepBy(-1)}
					>
						<ChevronLeft className="size-5 -translate-x-px" aria-hidden />
					</DetailMotionButton>
				</div>

				{/* Track column — score sits outside overflow-hidden so digit pop-in is not clipped. */}
				{trackNode}

				<div className="t-avatar flex h-14 shrink-0 items-center">
					<DetailMotionButton
						className={stepBtnClass}
						aria-label="Increase rating by 1"
						disabled={displayValue >= 10}
						onMouseEnter={() => setAvatarShifts(2, "in")}
						onClick={() => stepBy(1)}
					>
						<ChevronRight className="size-5 translate-x-px" aria-hidden />
					</DetailMotionButton>
				</div>
			</div>

			<p id={labelId} className="sr-only">
				Your rating: {formatLogRatingDisplay(displayValue)} out of 10
				{averageRating != null
					? `; average from other viewers ${formatLogRatingDisplay(averageRating)}`
					: ""}
			</p>
		</div>
	);
}
