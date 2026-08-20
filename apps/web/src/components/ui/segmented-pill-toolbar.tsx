"use client";

import { cn } from "@still/ui/lib/utils";
import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

export type SegmentedPillOption<T extends string> = {
	id: T;
	label: ReactNode;
	title?: string;
	/** Vertical rule before this chip (e.g. profile ledger → social). */
	separatorBefore?: boolean;
	/** Per-option disable (e.g. empty search categories). */
	disabled?: boolean;
};

/**
 * Sliding `bg-card` pill on a `rounded-full bg-background` track.
 * Shared `layoutId` motion pill — no liquid-gooey on chip rails.
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
	/** Shared motion layout id for the sliding active pill. */
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

	const chipClass = (active: boolean) =>
		cn(
			"relative inline-flex min-h-10 items-center justify-center rounded-full text-center font-medium text-sm transition-colors duration-200 ease-out motion-reduce:transition-none",
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
			className={cn(
				"relative flex max-w-full flex-wrap justify-center gap-1 overflow-hidden rounded-full bg-background p-1 sm:flex-nowrap",
				className,
			)}
			role="toolbar"
			aria-label={ariaLabel}
		>
			{options.map((opt) => {
				const active = value === opt.id;
				const optionDisabled = disabled || Boolean(opt.disabled);
				return (
					<span key={opt.id} className="contents">
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
							title={opt.title}
							className={cn(
								chipClass(active),
								opt.disabled &&
									!disabled &&
									"pointer-events-none cursor-default opacity-40",
							)}
							onClick={() => {
								if (optionDisabled) return;
								onChange(opt.id);
							}}
							onPointerEnter={() => {
								if (optionDisabled) return;
								onOptionPointerEnter?.(opt.id);
							}}
						>
							{active ? (
								<motion.span
									layoutId={layoutId}
									className={cn(
										"absolute inset-0 z-0 rounded-full",
										pillFaceClass,
									)}
									transition={pillTransition}
								/>
							) : null}
							<span className="relative z-10">{opt.label}</span>
						</button>
					</span>
				);
			})}
		</div>
	);
}
