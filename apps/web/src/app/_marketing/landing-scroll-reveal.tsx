"use client";

import { cn } from "@still/ui/lib/utils";
import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

/** Fade-up when the block enters the viewport — used under section headings and cards. */
export function LandingScrollReveal({
	children,
	className,
	delay = 0,
}: {
	children: ReactNode;
	className?: string;
	delay?: number;
}) {
	const reduceMotion = useReducedMotion();

	if (reduceMotion) {
		return <div className={cn(className)}>{children}</div>;
	}

	return (
		<motion.div
			className={cn(className)}
			initial={{ opacity: 0, y: 20 }}
			whileInView={{ opacity: 1, y: 0 }}
			viewport={{ once: true, amount: 0.35, margin: "0px 0px -8% 0px" }}
			transition={{
				duration: 0.45,
				delay,
				ease: [0.22, 1, 0.36, 1],
			}}
		>
			{children}
		</motion.div>
	);
}
