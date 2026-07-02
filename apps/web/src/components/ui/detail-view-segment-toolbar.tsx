"use client";

import { cn } from "@still/ui/lib/utils";
import { motion, useReducedMotion } from "motion/react";
import {
	type ReactNode,
	useCallback,
	useLayoutEffect,
	useRef,
	useState,
} from "react";

type SegmentIndicator = {
	left: number;
	width: number;
};

/**
 * Film/person detail view tabs — `bg-card` track with a measured `bg-background`
 * sliding pill. Avoids shared `layoutId` (glitches when tab widths differ or the
 * rail scrolls); same approach as {@link SegmentedPillToolbar}.
 */
export function DetailViewSegmentToolbar<T extends string>({
	"aria-label": ariaLabel,
	value,
	tabs,
	className,
	renderTab,
}: {
	"aria-label": string;
	value: T;
	tabs: readonly { id: T; label: string }[];
	className?: string;
	renderTab: (props: {
		id: T;
		label: string;
		active: boolean;
		className: string;
		"data-segment-id": string;
	}) => ReactNode;
}) {
	const reduceMotion = useReducedMotion();
	const pillTransition = reduceMotion
		? { duration: 0 }
		: {
				type: "tween" as const,
				duration: 0.22,
				ease: [0.165, 0.84, 0.44, 1] as const,
			};

	const trackRef = useRef<HTMLElement>(null);
	const [indicator, setIndicator] = useState<SegmentIndicator | null>(null);

	const measureActiveSegment = useCallback(() => {
		const track = trackRef.current;
		if (!track) return;
		const active = track.querySelector<HTMLElement>(
			`[data-segment-id="${CSS.escape(String(value))}"]`,
		);
		if (!active) return;
		setIndicator({
			left: active.offsetLeft - track.scrollLeft,
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
		track.addEventListener("scroll", measureActiveSegment, { passive: true });
		return () => {
			observer.disconnect();
			track.removeEventListener("scroll", measureActiveSegment);
		};
	}, [measureActiveSegment]);

	const chipClass = (active: boolean) =>
		cn(
			"relative z-10 inline-flex min-h-10 shrink-0 items-center justify-center rounded-full px-3 py-2 text-center font-medium text-sm transition-colors duration-200 ease-out motion-reduce:transition-none sm:px-4",
			active
				? "text-foreground"
				: "text-muted-foreground [@media(hover:hover)]:hover:text-foreground/90",
		);

	return (
		<nav
			ref={trackRef}
			aria-label={ariaLabel}
			className={cn(
				"scrollbar-none relative flex max-w-[min(100vw-7.5rem,22rem)] shrink-0 gap-1 overflow-x-auto rounded-full bg-card p-1 [-ms-overflow-style:none] sm:max-w-none [&::-webkit-scrollbar]:hidden",
				className,
			)}
		>
			{indicator ? (
				<motion.span
					aria-hidden
					className="pointer-events-none absolute top-1 bottom-1 z-0 rounded-full bg-background"
					initial={false}
					animate={{
						left: indicator.left,
						width: indicator.width,
					}}
					transition={pillTransition}
				/>
			) : null}
			{tabs.map((tab) => {
				const active = value === tab.id;
				return (
					<span key={tab.id} className="contents">
						{renderTab({
							id: tab.id,
							label: tab.label,
							active,
							className: chipClass(active),
							"data-segment-id": tab.id,
						})}
					</span>
				);
			})}
		</nav>
	);
}
