"use client";

import { cn } from "@still/ui/lib/utils";
import { motion, useReducedMotion } from "motion/react";

/** Contextual icon swap — matches `make-interfaces-feel-better` (opacity + scale + blur, bounce 0). */
const MARK_VISIBLE = { opacity: 1, scale: 1, filter: "blur(0px)" };
const MARK_HIDDEN = { opacity: 0, scale: 0.25, filter: "blur(4px)" };
const MARK_SPRING = {
	type: "spring" as const,
	duration: 0.3,
	bounce: 0,
};

/** Sense stroke check — slightly soft corners, not the stock Lucide glyph. */
function SenseCheckStroke({ className }: { className?: string }) {
	return (
		<svg
			viewBox="0 0 12 10"
			className={cn("size-2.5 shrink-0", className)}
			aria-hidden
		>
			<title>Checked</title>
			<path
				d="M1 5.15 4.4 8.45 11 1.85"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

/**
 * Round confirmation mark for settings dialogs — `bg-card` / `bg-foreground` on
 * `bg-background` rows, with a custom animated check (not the square shadcn box).
 */
export function RoundAnimatedCheckmark({
	checked,
	className,
}: {
	checked: boolean;
	className?: string;
}) {
	const reduceMotion = useReducedMotion();
	const markTransition = reduceMotion ? { duration: 0 } : MARK_SPRING;

	return (
		<span
			aria-hidden
			className={cn(
				"relative mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full transition-colors duration-200 ease-out motion-reduce:transition-none",
				checked
					? "bg-foreground text-background"
					: "bg-card text-transparent ring-1 ring-foreground/15",
				className,
			)}
		>
			<motion.span
				className="pointer-events-none flex items-center justify-center"
				initial={false}
				animate={checked ? MARK_VISIBLE : MARK_HIDDEN}
				transition={markTransition}
			>
				<SenseCheckStroke />
			</motion.span>
		</span>
	);
}
