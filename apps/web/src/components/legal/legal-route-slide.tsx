"use client";

import { cn } from "@still/ui/lib/utils";
import {
	AnimatePresence,
	motion,
	useReducedMotion,
	type Variants,
} from "motion/react";
import { type ReactNode, useRef } from "react";

import {
	type LegalSurfaceId,
	legalSurfaceSlideDirection,
} from "@/lib/legal-surface";

/** Match transitions.dev page side-by-side tokens in globals.css. */
const PAGE_EASE = [0.22, 1, 0.36, 1] as const;
const SLIDE_PX = 8;
const SLIDE_SEC = 0.2;
const BLUR_PX = 3;

const legalSlideVariants: Variants = {
	enter: (dir: "forward" | "back") => ({
		x: dir === "forward" ? SLIDE_PX : -SLIDE_PX,
		opacity: 0,
		filter: `blur(${BLUR_PX}px)`,
	}),
	center: {
		x: 0,
		opacity: 1,
		filter: "blur(0px)",
		transition: { duration: SLIDE_SEC, ease: PAGE_EASE },
	},
	exit: (dir: "forward" | "back") => ({
		x: dir === "forward" ? -SLIDE_PX : SLIDE_PX,
		opacity: 0,
		filter: `blur(${BLUR_PX}px)`,
		// Pull out of flow so document height follows the incoming page.
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		transition: { duration: SLIDE_SEC, ease: PAGE_EASE },
	}),
};

/**
 * Peer switch between Privacy · Terms · Cookies · Trust.
 * transitions.dev page-slide language (translateX + opacity + blur) via motion/react —
 * same pattern as AuthRouteSlide (CSS absolute dual-layer collapses long legal docs).
 */
export function LegalRouteSlide({
	surfaceId,
	children,
}: {
	surfaceId: LegalSurfaceId;
	children: ReactNode;
}) {
	const reduceMotion = useReducedMotion();
	const prevIdRef = useRef(surfaceId);
	const directionRef = useRef<"forward" | "back">("forward");

	if (surfaceId !== prevIdRef.current) {
		directionRef.current = legalSurfaceSlideDirection(
			prevIdRef.current,
			surfaceId,
		);
		prevIdRef.current = surfaceId;
	}
	const direction = directionRef.current;

	if (reduceMotion) {
		return <div className="relative w-full">{children}</div>;
	}

	return (
		<div
			className={cn("t-page-slide relative w-full overflow-hidden")}
			data-direction={direction}
			data-legal-slide=""
		>
			<AnimatePresence custom={direction} initial={false} mode="sync">
				<motion.div
					key={surfaceId}
					animate="center"
					className="t-page relative w-full"
					custom={direction}
					exit="exit"
					initial="enter"
					variants={legalSlideVariants}
				>
					{children}
				</motion.div>
			</AnimatePresence>
		</div>
	);
}
