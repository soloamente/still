"use client";

import { cn } from "@still/ui/lib/utils";
import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

/**
 * Boolean preference pill rail on `bg-background` panels —
 * `bg-card` track, sliding `bg-background` pill (settings page).
 */
export function MePreferenceToggle({
	id,
	checked,
	onChange,
	title,
	description,
	onLabel = "On",
	offLabel = "Off",
}: {
	/** Stable id for `layoutId` (unique per row on the page). */
	id: string;
	checked: boolean;
	onChange: (next: boolean) => void;
	title: string;
	description: ReactNode;
	onLabel?: string;
	offLabel?: string;
}) {
	const reduceMotion = useReducedMotion();
	const pillTransition = reduceMotion
		? { duration: 0 }
		: {
				type: "tween" as const,
				duration: 0.22,
				ease: [0.165, 0.84, 0.44, 1] as const,
			};

	const chip = (active: boolean) =>
		cn(
			"relative inline-flex min-h-10 shrink-0 items-center justify-center rounded-full px-5 py-2.5 text-center font-medium text-sm transition-colors duration-200 ease-out motion-reduce:transition-none",
			"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
			active
				? "text-foreground"
				: "text-muted-foreground [@media(hover:hover)]:hover:text-foreground/90",
		);

	const pillLayoutId = `me-preference-pill-${id}`;

	return (
		<div className="space-y-3">
			<div className="space-y-1">
				<p className="font-medium text-foreground text-sm">{title}</p>
				<p className="max-w-prose text-muted-foreground text-sm leading-relaxed">
					{description}
				</p>
			</div>
			<fieldset className="m-0 flex w-fit min-w-0 max-w-full flex-wrap gap-1 rounded-full border-0 bg-card p-1 sm:flex-nowrap">
				<legend className="sr-only">{title}</legend>
				<button
					type="button"
					className={chip(!checked)}
					aria-pressed={!checked}
					onClick={() => onChange(false)}
				>
					{!checked ? (
						<motion.span
							layoutId={pillLayoutId}
							className="absolute inset-0 z-0 rounded-full bg-background"
							transition={pillTransition}
						/>
					) : null}
					<span className="relative z-10">{offLabel}</span>
				</button>
				<button
					type="button"
					className={chip(checked)}
					aria-pressed={checked}
					onClick={() => onChange(true)}
				>
					{checked ? (
						<motion.span
							layoutId={pillLayoutId}
							className="absolute inset-0 z-0 rounded-full bg-background"
							transition={pillTransition}
						/>
					) : null}
					<span className="relative z-10">{onLabel}</span>
				</button>
			</fieldset>
		</div>
	);
}
