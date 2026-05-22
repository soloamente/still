"use client";

import { cn } from "@still/ui/lib/utils";
import { type HTMLMotionProps, motion, useReducedMotion } from "motion/react";
import type { CSSProperties, ReactNode } from "react";

/** Default sweep cycle — matches Motion+ skeleton demo cadence. */
export const SKELETON_SHIMMER_DURATION_S = 1.5;

const shimmerGradientStyle: CSSProperties = {
	backgroundImage:
		"linear-gradient(90deg, var(--skeleton-shimmer-base) 25%, var(--skeleton-shimmer-highlight) 50%, var(--skeleton-shimmer-base) 75%)",
	backgroundSize: "200% 100%",
};

const shimmerMotion = {
	backgroundPosition: ["-200% 0", "200% 0"],
};

const shimmerTransition = (duration: number) => ({
	duration,
	ease: "easeInOut" as const,
	repeat: Number.POSITIVE_INFINITY,
});

type ShimmerBoneProps = HTMLMotionProps<"div"> & {
	shimmerDuration?: number;
};

/**
 * Rectangular shimmer placeholder — replaces flat `animate-pulse` blocks on the
 * dark Still canvas (`bg-card` / `bg-background` shells).
 */
export function ShimmerBone({
	className,
	shimmerDuration = SKELETON_SHIMMER_DURATION_S,
	style,
	...props
}: ShimmerBoneProps) {
	const reducedMotion = useReducedMotion();

	if (reducedMotion) {
		return (
			<div
				className={cn("bg-muted", className)}
				style={style as CSSProperties | undefined}
				aria-hidden
			/>
		);
	}

	return (
		<motion.div
			className={cn("shrink-0 overflow-hidden", className)}
			style={{ ...shimmerGradientStyle, ...style }}
			animate={shimmerMotion}
			transition={shimmerTransition(shimmerDuration)}
			aria-hidden
			{...props}
		/>
	);
}

type ShimmerWrapProps = {
	className?: string;
	style?: CSSProperties;
	shimmerDuration?: number;
	children: ReactNode;
};

/**
 * Text-line shimmer: children set intrinsic size but stay invisible so copy
 * width matches the eventual loaded layout (Motion+ demo `Shimmer` pattern).
 */
export function ShimmerWrap({
	className,
	style,
	shimmerDuration = SKELETON_SHIMMER_DURATION_S,
	children,
}: ShimmerWrapProps) {
	const reducedMotion = useReducedMotion();

	if (reducedMotion) {
		return (
			<div
				className={cn("overflow-hidden bg-muted", className)}
				style={style}
				aria-hidden
			>
				<div className="invisible">{children}</div>
			</div>
		);
	}

	return (
		<motion.div
			className={cn("overflow-hidden", className)}
			style={{ ...shimmerGradientStyle, ...style }}
			animate={shimmerMotion}
			transition={shimmerTransition(shimmerDuration)}
			aria-hidden
		>
			<div className="invisible">{children}</div>
		</motion.div>
	);
}

/** View-transition wipe metadata for skeleton card reveals (CSS in globals). */
export const skeletonCardWipeTransition = {
	"--wipe": ["100%", "-100%"],
	transition: { duration: 0.6, ease: "easeInOut" as const },
} as const;
