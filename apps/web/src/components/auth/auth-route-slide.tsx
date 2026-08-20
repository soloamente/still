"use client";

import { cn } from "@still/ui/lib/utils";
import {
	AnimatePresence,
	motion,
	useReducedMotion,
	type Variants,
} from "motion/react";
import { type ReactNode, useRef } from "react";

import { authRouteSlideDirection } from "@/lib/auth-route-order";

const PAGE_EASE = [0.22, 1, 0.36, 1] as const;
const SLIDE_PX = 72;
const SLIDE_SEC = 0.28;
const STAGGER_SEC = 0.1;

const authSlideVariants: Variants = {
	enter: (dir: "forward" | "back") => ({
		x: dir === "forward" ? SLIDE_PX : -SLIDE_PX,
		opacity: 0,
	}),
	center: {
		x: 0,
		opacity: 1,
		// Enter waits a beat so exit can clear (handoff gap).
		transition: {
			duration: SLIDE_SEC,
			ease: PAGE_EASE,
			delay: STAGGER_SEC,
		},
	},
	exit: (dir: "forward" | "back") => ({
		x: dir === "forward" ? -SLIDE_PX : SLIDE_PX,
		opacity: 0,
		// Pull out of flow so the card height follows the incoming page.
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		transition: {
			duration: SLIDE_SEC,
			ease: PAGE_EASE,
			delay: 0,
		},
	}),
};

/**
 * Auth convert-card body slide (sign-in ↔ sign-up, etc.).
 *
 * transitions.dev page-slide language (translateX + opacity + stagger) via
 * `motion/react`. CSS class choreography reversed the enter from-pose; WAAPI
 * stalled when the document timeline did not advance.
 */
export function AuthRouteSlide({
	routeKey,
	children,
}: {
	routeKey: string;
	children: ReactNode;
}) {
	const reduceMotion = useReducedMotion();
	const prevKeyRef = useRef(routeKey);
	const directionRef = useRef<"forward" | "back">("forward");

	// Resolve direction during render so the first AnimatePresence frame is correct.
	if (routeKey !== prevKeyRef.current) {
		directionRef.current = authRouteSlideDirection(
			prevKeyRef.current,
			routeKey,
		);
		prevKeyRef.current = routeKey;
	}
	const direction = directionRef.current;

	if (reduceMotion) {
		return <div className="relative w-full">{children}</div>;
	}

	return (
		<div
			className={cn("t-page-slide relative w-full overflow-hidden")}
			data-auth-slide=""
			data-direction={direction}
		>
			{/* sync = exit and enter overlap so stagger reads as a handoff */}
			<AnimatePresence custom={direction} initial={false} mode="sync">
				<motion.div
					key={routeKey}
					animate="center"
					className="t-page relative w-full"
					custom={direction}
					exit="exit"
					initial="enter"
					variants={authSlideVariants}
				>
					{children}
				</motion.div>
			</AnimatePresence>
		</div>
	);
}
