"use client";

import { cn } from "@still/ui/lib/utils";
import { useLenis } from "lenis/react";
import { ChevronUp } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useState } from "react";

import {
	DETAIL_MOTION_PRESSABLE_CLASS,
	useDetailActionMotion,
} from "@/lib/detail-action-motion";

/** Reveal after this much vertical scroll (window / Lenis). */
const SHOW_AFTER_SCROLL_PX = 480;

/** Collapsed circle — icon well only (`w-11`). */
const PILL_COLLAPSED_PX = 44;
/** Label + tight gap + fixed trailing icon well. */
const PILL_EXPANDED_PX = 132;

/** Trailing icon slot — always visible; label expands to its left on hover. */
const ICON_WELL_PX = 44;

/** Width spring — animate width only; icon stays pinned in the trailing well. */
const pillWidthTransition = {
	type: "spring" as const,
	stiffness: 420,
	damping: 34,
	mass: 0.85,
};

const pillLabelTransition = {
	duration: 0.16,
	ease: [0.165, 0.84, 0.44, 1] as const,
};

const scrollTopPillVariants = {
	idle: { width: PILL_COLLAPSED_PX },
	hover: { width: PILL_EXPANDED_PX },
};

const scrollTopLabelVariants = {
	idle: { opacity: 0, x: 6 },
	hover: { opacity: 1, x: 0 },
};

/**
 * Floating back-to-top for authenticated app routes — sits above the bottom nav inset.
 * Uses Lenis `scrollTo` when available; falls back to native smooth scroll.
 */
export function AppScrollToTop() {
	const reduceMotion = useReducedMotion();
	const motionProps = useDetailActionMotion();
	const lenis = useLenis();
	const [visible, setVisible] = useState(false);

	const syncVisibility = useCallback((scrollY: number) => {
		const next = scrollY > SHOW_AFTER_SCROLL_PX;
		setVisible((prev) => (prev === next ? prev : next));
	}, []);

	useLenis((instance) => {
		syncVisibility(instance.scroll);
	});

	useEffect(() => {
		const onScroll = () => syncVisibility(window.scrollY);
		onScroll();
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => window.removeEventListener("scroll", onScroll);
	}, [syncVisibility]);

	const scrollToTop = useCallback(() => {
		if (lenis) {
			lenis.scrollTo(0, {
				immediate: Boolean(reduceMotion),
				duration: reduceMotion ? 0 : 0.9,
			});
			return;
		}
		window.scrollTo({
			top: 0,
			behavior: reduceMotion ? "auto" : "smooth",
		});
	}, [lenis, reduceMotion]);

	const fixedChromeClass = cn(
		"pointer-events-none fixed right-3 z-40 sm:right-11",
		"bottom-[max(2.25rem,calc(0.75rem+env(safe-area-inset-bottom)))]",
	);

	return (
		<AnimatePresence>
			{visible ? (
				<motion.div
					className={fixedChromeClass}
					initial={reduceMotion ? false : { opacity: 0, y: 10 }}
					animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
					exit={reduceMotion ? undefined : { opacity: 0, y: 8 }}
					transition={
						reduceMotion
							? { duration: 0 }
							: { duration: 0.2, ease: [0.165, 0.84, 0.44, 1] }
					}
				>
					<motion.button
						type="button"
						aria-label="Back to top"
						variants={scrollTopPillVariants}
						initial="idle"
						animate="idle"
						whileHover={reduceMotion ? undefined : "hover"}
						whileFocus={reduceMotion ? undefined : "hover"}
						whileTap={reduceMotion ? undefined : motionProps.tap}
						className={cn(
							"pointer-events-auto relative h-11 min-h-11 min-w-11 overflow-hidden rounded-full bg-background text-foreground shadow-[0_10px_36px_rgba(6,6,10,0.42)]",
							"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
							DETAIL_MOTION_PRESSABLE_CLASS,
						)}
						style={motionProps.style}
						transition={reduceMotion ? { duration: 0 } : pillWidthTransition}
						onClick={scrollToTop}
					>
						<motion.span
							variants={scrollTopLabelVariants}
							transition={reduceMotion ? { duration: 0 } : pillLabelTransition}
							className="absolute inset-y-0 left-0 flex items-center overflow-hidden whitespace-nowrap pl-3.5 font-medium text-sm"
							style={{ right: ICON_WELL_PX }}
							aria-hidden
						>
							Back to top
						</motion.span>
						<span
							className="absolute inset-y-0 right-0 z-10 flex items-center justify-center"
							style={{ width: ICON_WELL_PX }}
						>
							<ChevronUp className="size-5 shrink-0 opacity-90" aria-hidden />
						</span>
					</motion.button>
				</motion.div>
			) : null}
		</AnimatePresence>
	);
}
