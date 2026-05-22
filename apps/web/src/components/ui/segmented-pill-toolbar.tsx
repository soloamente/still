"use client";

import { cn } from "@still/ui/lib/utils";
import { LayoutGroup, motion, useReducedMotion } from "motion/react";

/**
 * Home `/home` catalogue sort toolbar — `rounded-full bg-background p-1` track with a
 * sliding `bg-card` pill (`layoutId`). Use for TV status + progress mode on detail pages.
 */
export function SegmentedPillToolbar<T extends string>({
	layoutId,
	"aria-label": ariaLabel,
	value,
	onChange,
	options,
	className,
	compact = false,
	disabled = false,
}: {
	layoutId: string;
	"aria-label": string;
	value: T;
	onChange: (next: T) => void;
	options: readonly { id: T; label: string }[];
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

	const chipClass = (active: boolean) =>
		cn(
			"relative inline-flex min-h-10 items-center justify-center rounded-full text-center font-medium text-sm transition-colors duration-200 ease-out motion-reduce:transition-none",
			compact ? "px-3 py-2 sm:px-3.5" : "px-5 py-2.5",
			active
				? "text-foreground"
				: "text-muted-foreground [@media(hover:hover)]:hover:text-foreground/90",
			disabled && "pointer-events-none opacity-50",
		);

	return (
		<LayoutGroup id={`${layoutId}-group`}>
			<div
				className={cn(
					"flex max-w-full flex-wrap justify-center gap-1 rounded-full bg-background p-1 sm:flex-nowrap",
					className,
				)}
				role="toolbar"
				aria-label={ariaLabel}
			>
				{options.map((opt) => {
					const active = value === opt.id;
					return (
						<button
							key={opt.id}
							type="button"
							disabled={disabled}
							aria-pressed={active}
							className={chipClass(active)}
							onClick={() => onChange(opt.id)}
						>
							{active ? (
								<motion.span
									layoutId={layoutId}
									className="absolute inset-0 z-0 rounded-full bg-card"
									transition={pillTransition}
								/>
							) : null}
							<span className="relative z-10">{opt.label}</span>
						</button>
					);
				})}
			</div>
		</LayoutGroup>
	);
}
