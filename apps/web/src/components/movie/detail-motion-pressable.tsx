"use client";

import { cn } from "@still/ui/lib/utils";

import { AnimatePresence, motion } from "motion/react";

import Link from "next/link";

import type { ComponentProps, ReactNode } from "react";

import {
	DETAIL_MOTION_PRESSABLE_CLASS,
	DETAIL_MOTION_SWAP_CLASS,
	type DetailActionMotionVariant,
	useDetailActionMotion,
} from "@/lib/detail-action-motion";

const MotionLink = motion.create(Link);

type MotionLinkProps = ComponentProps<typeof MotionLink>;

type MotionButtonProps = ComponentProps<typeof motion.button>;

/**

 * Next.js `Link` with the same spring hover/tap as hero detail actions (watchlist, Add to list).

 */

export function DetailMotionLink({
	className,

	children,

	motionVariant = "hero",

	...props
}: MotionLinkProps & {
	/** `chrome` = sticky detail header / rail (tap-only, subtler scale). */
	motionVariant?: DetailActionMotionVariant;
}) {
	const motionProps = useDetailActionMotion(motionVariant);

	return (
		<MotionLink
			className={cn(DETAIL_MOTION_PRESSABLE_CLASS, className)}
			style={motionProps.style}
			whileHover={motionProps.hover}
			whileTap={motionProps.tap}
			transition={motionProps.buttonTransition}
			{...props}
		>
			{children}
		</MotionLink>
	);
}

/**

 * Native `<button>` with hero-row press feedback — use for share, section rail, etc.

 */

export function DetailMotionButton({
	className,

	children,

	iconSwapKey,

	motionVariant = "hero",

	...props
}: MotionButtonProps & {
	/** When set, children swap with blur crossfade (e.g. Share → Copied). */

	iconSwapKey?: string;

	/** `chrome` = sticky detail header / rail (tap-only, subtler scale). */
	motionVariant?: DetailActionMotionVariant;
}) {
	const motionProps = useDetailActionMotion(motionVariant);

	const body =
		iconSwapKey != null ? (
			<AnimatePresence mode="popLayout" initial={false}>
				<motion.span
					key={iconSwapKey}
					className={cn(
						"inline-flex items-center gap-2",

						DETAIL_MOTION_SWAP_CLASS,
					)}
					layout="position"
					initial={motionProps.swapInitial}
					animate={motionProps.swapAnimate}
					exit={motionProps.swapExit}
					transition={motionProps.swapTransition}
				>
					{children}
				</motion.span>
			</AnimatePresence>
		) : (
			children
		);

	return (
		<motion.button
			type="button"
			className={cn(DETAIL_MOTION_PRESSABLE_CLASS, className)}
			style={motionProps.style}
			whileHover={motionProps.hover}
			whileTap={motionProps.tap}
			transition={motionProps.buttonTransition}
			{...props}
		>
			{body}
		</motion.button>
	);
}

/** Wraps shadcn `Button` children so footer CTAs (Save, Skip) get the same press scale. */

export function DetailMotionButtonWrap({
	className,

	children,
}: {
	className?: string;

	children: ReactNode;
}) {
	const motionProps = useDetailActionMotion();

	return (
		<motion.span
			className={cn("inline-flex", DETAIL_MOTION_PRESSABLE_CLASS, className)}
			style={motionProps.style}
			whileHover={motionProps.hover}
			whileTap={motionProps.tap}
			transition={motionProps.buttonTransition}
		>
			{children}
		</motion.span>
	);
}
