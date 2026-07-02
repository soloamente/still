"use client";

import { cn } from "@still/ui/lib/utils";
import type { ReactNode } from "react";

import { DETAIL_CANVAS_ON_CARD_HOVER_CLASS } from "@/lib/detail-action-motion";

/** Shared hover + press for clickable `bg-background` pills on profile `bg-card`. */
export const PROFILE_HEADER_PILL_PRESS_CLASS = cn(
	DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
	"select-none transition-[background-color,color,transform] duration-200 ease-out motion-reduce:transition-none",
	"active:scale-[0.96] motion-reduce:active:scale-100",
);

/** Uniform profile header metric — stacked card or compact inline pill. */
export function ProfileStatCell({
	value,
	label,
	onClick,
	className,
	variant = "card",
	ariaLabel,
}: {
	value: ReactNode;
	/** Omit on icon-only pills (e.g. streak) — use `ariaLabel` for screen readers. */
	label?: string;
	onClick?: () => void;
	className?: string;
	/** `pill` — inline count + label in a rounded-full chip (banner stat row). */
	variant?: "card" | "pill";
	ariaLabel?: string;
}) {
	const showPillLabel = variant === "pill" && Boolean(label?.trim());

	const content =
		variant === "pill" ? (
			showPillLabel ? (
				<>
					<span className="font-semibold text-foreground tabular-nums">
						{value}
					</span>
					<span className="text-muted-foreground">{label}</span>
				</>
			) : (
				<span className="inline-flex items-center gap-1 font-semibold text-foreground text-sm tabular-nums">
					{value}
				</span>
			)
		) : (
			<>
				<span className="font-semibold text-foreground text-sm tabular-nums">
					{value}
				</span>
				<span className="text-[10px] text-muted-foreground">{label}</span>
			</>
		);

	const shellClass = cn(
		variant === "pill"
			? "inline-flex min-h-9 items-center gap-1 rounded-full bg-background px-3 py-1.5 text-sm"
			: "flex min-h-10 min-w-[4.75rem] flex-col items-center justify-center gap-0.5 rounded-xl bg-background px-3 py-2.5",
		className,
	);

	if (onClick) {
		return (
			<button
				type="button"
				onClick={onClick}
				aria-label={ariaLabel}
				className={cn(shellClass, PROFILE_HEADER_PILL_PRESS_CLASS)}
			>
				{content}
			</button>
		);
	}

	return (
		<div className={shellClass}>
			{content}
			{ariaLabel ? <span className="sr-only">{ariaLabel}</span> : null}
		</div>
	);
}
