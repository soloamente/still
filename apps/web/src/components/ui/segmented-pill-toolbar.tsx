"use client";

import { cn } from "@still/ui/lib/utils";
import { motion, useReducedMotion } from "motion/react";
import { useCallback, useLayoutEffect, useRef, useState } from "react";

type SegmentIndicator = {
	left: number;
	width: number;
};

/**
 * Home `/home` catalogue sort toolbar — `rounded-full bg-background p-1` track with a
 * sliding `bg-card` pill. Uses measured segment bounds (not shared `layoutId`) so the
 * indicator stays inside the track when sibling content reflows (e.g. review composer).
 */
export function SegmentedPillToolbar<T extends string>({
	layoutId: _layoutId,
	"aria-label": ariaLabel,
	value,
	onChange,
	options,
	className,
	compact = false,
	disabled = false,
}: {
	/** Kept for call-site stability; sliding pill no longer uses shared layout ids. */
	layoutId: string;
	"aria-label": string;
	value: T;
	onChange: (next: T) => void;
	options: readonly { id: T; label: string; title?: string }[];
	className?: string;
	/** Tighter chips when many segments (e.g. five watching statuses). */
	compact?: boolean;
	disabled?: boolean;
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

	const measureActiveSegment = useCallback(() => {
		const track = trackRef.current;
		if (!track) return;
		const active = track.querySelector<HTMLElement>(
			`[data-segment-id="${CSS.escape(String(value))}"]`,
		);
		if (!active) return;
		setIndicator({
			left: active.offsetLeft,
			width: active.offsetWidth,
		});
	}, [value]);

	useLayoutEffect(() => {
		measureActiveSegment();
	}, [measureActiveSegment]);

	useLayoutEffect(() => {
		const track = trackRef.current;
		if (!track) return;
		const observer = new ResizeObserver(() => {
			measureActiveSegment();
		});
		observer.observe(track);
		return () => observer.disconnect();
	}, [measureActiveSegment]);

	const chipClass = (active: boolean) =>
		cn(
			"relative z-10 inline-flex min-h-10 items-center justify-center rounded-full text-center font-medium text-sm transition-colors duration-200 ease-out motion-reduce:transition-none",
			compact ? "px-3 py-2 sm:px-3.5" : "px-5 py-2.5",
			active
				? "text-foreground"
				: "text-muted-foreground [@media(hover:hover)]:hover:text-foreground/90",
			disabled && "pointer-events-none opacity-50",
		);

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
					aria-hidden
					className="pointer-events-none absolute top-1 bottom-1 z-0 rounded-full bg-card"
					initial={false}
					animate={{
						left: indicator.left,
						width: indicator.width,
					}}
					transition={pillTransition}
				/>
			) : null}
			{options.map((opt) => {
				const active = value === opt.id;
				return (
					<button
						key={opt.id}
						type="button"
						data-segment-id={opt.id}
						disabled={disabled}
						aria-pressed={active}
						title={opt.title}
						className={chipClass(active)}
						onClick={() => onChange(opt.id)}
					>
						{opt.label}
					</button>
				);
			})}
		</div>
	);
}
