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
	const ratio = (clientX - rect.left) / rect.width;
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

/**
 * Live score readout in the track tail — digit pop-in on discrete updates
 * (chevrons, keyboard, drag release). Plain text while dragging avoids
 * re-triggering the animation on every 0.1 step.
 */
function LogRatingScoreDigits({
	value,
	isDragging,
	className,
}: {
	value: number;
	isDragging: boolean;
	className?: string;
}) {
	const label = formatLogRatingDisplay(value);
	const groupRef = useRef<HTMLSpanElement>(null);
	const prevLabelRef = useRef<string | null>(null);
	const wasDraggingRef = useRef(false);
	const animTimerRef = useRef<number | null>(null);

	const playDigitPopIn = useCallback(() => {
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
	}, []);

	useLayoutEffect(() => {
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

		// First paint: digits without entrance motion.
		if (prevLabelRef.current === null) {
			prevLabelRef.current = label;
			return;
		}

		const labelChanged = prevLabelRef.current !== label;
		if (!labelChanged && !justReleasedDrag) return;

		prevLabelRef.current = label;
		playDigitPopIn();
	}, [isDragging, label, playDigitPopIn]);

	useEffect(() => {
		return () => {
			if (animTimerRef.current != null) {
				window.clearTimeout(animTimerRef.current);
			}
		};
	}, []);

	const digits = splitRatingLabelDigits(label);

	return (
		<span
			ref={groupRef}
			className={cn(
				"inline-flex items-baseline font-semibold text-2xl tabular-nums tracking-tight",
				!isDragging && "t-digit-group",
				className,
			)}
		>
			{isDragging
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
 */
export function LogRatingSlider({
	value,
	onChange,
	/** TMDb or Sense community average on 0–10 — static fill + label inside the same track as the thumb. */
	averageRating,
	className,
}: {
	value: number;
	onChange: (next: number) => void;
	averageRating?: number | null;
	className?: string;
}) {
	const { resolvedTheme } = useTheme();
	const appTheme = resolveAppTheme(resolvedTheme ?? DEFAULT_APP_THEME_CLASS);
	const trackRef = useRef<HTMLDivElement>(null);
	const avatarGroupRef = useRef<HTMLDivElement>(null);
	const labelId = useId();
	const [isDragging, setIsDragging] = useState(false);

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
		setIsDragging(true);
		el.setPointerCapture(e.pointerId);
		setFromPointer(e.clientX);

		const onMove = (ev: PointerEvent) => setFromPointer(ev.clientX);
		const onUp = () => {
			setIsDragging(false);
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
		"log-rating-slider__step inline-flex size-12 shrink-0 items-center justify-center rounded-2xl text-muted-foreground transition-[color,box-shadow] duration-200 ease-out disabled:cursor-not-allowed disabled:opacity-35 [@media(hover:hover)]:hover:text-foreground motion-reduce:transition-none";

	const fillMotion = isDragging ? undefined : TRACK_FILL_MOTION_CLASS;

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
						disabled={value <= 0}
						onMouseEnter={() => setAvatarShifts(0, "in")}
						onClick={() => stepBy(-1)}
					>
						<ChevronLeft className="size-5 -translate-x-px" aria-hidden />
					</DetailMotionButton>
				</div>

				{/* Track column — score sits outside overflow-hidden so digit pop-in is not clipped. */}
				<div className="t-avatar relative flex min-w-0 flex-1 flex-col">
					<div
						ref={trackRef}
						role="slider"
						tabIndex={0}
						aria-labelledby={labelId}
						aria-valuemin={0}
						aria-valuemax={10}
						aria-valuenow={value}
						aria-valuetext={`${formatLogRatingDisplay(value)} out of 10`}
						className={cn(
							"log-rating-slider__track relative isolate h-14 w-full cursor-grab touch-none select-none overflow-hidden rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
							isDragging && "cursor-grabbing",
						)}
						onPointerDown={onTrackPointerDown}
						onMouseEnter={() => setAvatarShifts(1, "in")}
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
						 * then user fill 0→thumb so the rated stripe always meets the accent thumb.
						 * Average does not move — only the thumb does.
						 */}
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
								"log-rating-slider__thumb pointer-events-none absolute top-1.5 bottom-1.5 z-4 w-[3px] rounded-full",
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
						className="pointer-events-none absolute inset-y-0 right-4 z-10 flex items-center"
						aria-hidden
					>
						<LogRatingScoreDigits
							value={value}
							isDragging={isDragging}
							className="log-rating-slider__score"
						/>
					</span>
				</div>

				<div className="t-avatar flex h-14 shrink-0 items-center">
					<DetailMotionButton
						className={stepBtnClass}
						aria-label="Increase rating by 1"
						disabled={value >= 10}
						onMouseEnter={() => setAvatarShifts(2, "in")}
						onClick={() => stepBy(1)}
					>
						<ChevronRight className="size-5 translate-x-px" aria-hidden />
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
