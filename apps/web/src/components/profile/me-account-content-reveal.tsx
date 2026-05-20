"use client";

import { cn } from "@still/ui/lib/utils";
import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

const container = {
	hidden: { opacity: 0 },
	show: {
		opacity: 1,
		transition: { staggerChildren: 0.06, delayChildren: 0.04 },
	},
};

const item = {
	hidden: { opacity: 0, y: 10 },
	show: {
		opacity: 1,
		y: 0,
		transition: { type: "spring" as const, stiffness: 320, damping: 28 },
	},
};

/** Waterfall entrance for account page blocks (MOTION_INTENSITY 6). */
export function MeAccountContentReveal({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	const reduceMotion = useReducedMotion();

	if (reduceMotion) {
		return <div className={className}>{children}</div>;
	}

	return (
		<motion.div
			variants={container}
			initial="hidden"
			animate="show"
			className={cn("space-y-10", className)}
		>
			{children}
		</motion.div>
	);
}

export function MeAccountRevealItem({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	const reduceMotion = useReducedMotion();

	if (reduceMotion) {
		return <div className={className}>{children}</div>;
	}

	return (
		<motion.div variants={item} className={className}>
			{children}
		</motion.div>
	);
}
