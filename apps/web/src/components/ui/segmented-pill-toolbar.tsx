"use client";

import { cn } from "@still/ui/lib/utils";
import { motion, useReducedMotion } from "motion/react";
import {
	Fragment,
	type ReactNode,
	useCallback,
	useLayoutEffect,
	useRef,
	useState,
} from "react";

export type SegmentedPillOption<T extends string> = {
	id: T;
	label: ReactNode;
	title?: string;
	/** Vertical rule before this chip (e.g. profile ledger → social). */
	separatorBefore?: boolean;
	/** Per-option disable (e.g. empty search categories). */
	disabled?: boolean;
};

type SegmentIndicator = {
	left: number;
	top: number;
	width: number;
	height: number;
};

/**
 * Sliding `bg-card` pill on a `rounded-full bg-background` track.
 * Measured indicator (not shared `layoutId`) so the slide survives
 * `overflow-hidden` tracks and sibling poster `AnimatePresence` — same approach
 * as the film/person detail segment toolbar.
 */
export function SegmentedPillToolbar<T extends string>({
	layoutId,
	"aria-label": ariaLabel,
	value,
	onChange,
	options,
	className,
	indicatorClassName,
	optionClassName,
	compact = false,
	disabled = false,
	onOptionPointerEnter,
}: {
	/** Stable id for this rail — used as the indicator's React key. */
	layoutId: string;
	"aria-label": string;
	value: T;
	onChange: (next: T) => void;
	options: readonly SegmentedPillOption<T>[];
	/** Extra track classes — `bg-background` is always applied on the shell. */
	className?: string;
	/** Sliding active segment — defaults to `bg-card`. */
	indicatorClassName?: string;
	/** Extra classes on each segment button. */
	optionClassName?: string;
	/** Tighter chips when many segments (e.g. five watching statuses). */
	compact?: boolean;
	disabled?: boolean;
	/** Prefetch / hover hints per segment (home catalogue). */
	onOptionPointerEnter?: (id: T) => void;
}) {
	const reduceMotion = useReducedMotion();
	const pillTransition = reduceMotion
		? { duration: 0 }
		: {
				type: "tween" as const,
				duration: 0.22,
				ease: [0.165, 0.84, 0.44, 1] as const,
			};

	const trackRef = useRef<HTMLDivElement>(null);
	const [indicator, setIndicator] = useState<SegmentIndicator | null>(null);
	const optionIds = options.map((opt) => opt.id).join("\0");

	const measureActiveSegment = useCallback(() => {
		const track = trackRef.current;
		if (!track) return;
		const active = track.querySelector<HTMLElement>(
			`[data-segment-id="${CSS.escape(String(value))}"]`,
		);
		if (!active) return;
		const next: SegmentIndicator = {
			left: active.offsetLeft - track.scrollLeft,
			top: active.offsetTop - track.scrollTop,
			width: active.offsetWidth,
			height: active.offsetHeight,
		};
		setIndicator((prev) => {
			if (
				prev &&
				prev.left === next.left &&
				prev.top === next.top &&
				prev.width === next.width &&
				prev.height === next.height
			) {
				return prev;
			}
			return next;
		});
	}, [value]);

	useLayoutEffect(() => {
		measureActiveSegment();
	}, [measureActiveSegment]);

	useLayoutEffect(() => {
		// Re-bind observers when the segment id list changes (home Movies↔TV options).
		void optionIds;
		const track = trackRef.current;
		if (!track) return;
		const observer = new ResizeObserver(() => {
			measureActiveSegment();
		});
		observer.observe(track);
		for (const child of track.querySelectorAll("[data-segment-id]")) {
			observer.observe(child);
		}
		track.addEventListener("scroll", measureActiveSegment, { passive: true });
		return () => {
			observer.disconnect();
			track.removeEventListener("scroll", measureActiveSegment);
		};
	}, [measureActiveSegment, optionIds]);

	const chipClass = (active: boolean) =>
		cn(
			"relative z-10 inline-flex min-h-10 items-center justify-center rounded-full text-center font-medium text-sm transition-colors duration-200 ease-out motion-reduce:transition-none",
			compact ? "px-3 py-2 sm:px-3.5" : "px-5 py-2.5",
			active
				? "text-foreground"
				: "text-muted-foreground [@media(hover:hover)]:hover:text-foreground/90",
			disabled && "pointer-events-none opacity-50",
			optionClassName,
		);

	const pillFaceClass = indicatorClassName ?? "bg-card";

	return (
		<div
			ref={trackRef}
			className={cn(
				"relative flex max-w-full flex-wrap justify-center gap-1 overflow-hidden rounded-full bg-background p-1 sm:flex-nowrap",
				className,
			)}
			role="toolbar"
			aria-label={ariaLabel}
		>
			{indicator ? (
				<motion.span
					key={layoutId}
					aria-hidden
					className={cn(
						"pointer-events-none absolute top-0 left-0 z-0 rounded-full",
						pillFaceClass,
					)}
					initial={false}
					animate={{
						x: indicator.left,
						y: indicator.top,
						width: indicator.width,
						height: indicator.height,
					}}
					transition={pillTransition}
				/>
			) : null}
			{options.map((opt) => {
				const active = value === opt.id;
				const optionDisabled = disabled || Boolean(opt.disabled);
				return (
					<Fragment key={opt.id}>
						{opt.separatorBefore ? (
							<div
								aria-hidden
								className="relative z-10 mx-0.5 h-6 w-px shrink-0 self-center rounded-full bg-border/70"
							/>
						) : null}
						<button
							type="button"
							disabled={optionDisabled}
							aria-pressed={active}
							aria-disabled={optionDisabled || undefined}
							data-segment-id={opt.id}
							title={opt.title}
							className={cn(
								chipClass(active),
								opt.disabled &&
									!disabled &&
									"pointer-events-none cursor-default opacity-40",
							)}
							onClick={() => {
								if (optionDisabled) return;
								if (opt.id === value) return;
								onChange(opt.id);
							}}
							onPointerEnter={() => {
								if (optionDisabled) return;
								onOptionPointerEnter?.(opt.id);
							}}
						>
							<span className="relative z-10">{opt.label}</span>
						</button>
					</Fragment>
				);
			})}
		</div>
	);
}
