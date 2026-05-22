"use client";

import {
	ShimmerBone,
	ShimmerWrap,
} from "@still/ui/components/skeleton-shimmer";
import { cn } from "@still/ui/lib/utils";
import type { HTMLMotionProps } from "motion/react";

type SkeletonProps = HTMLMotionProps<"div"> & {
	shimmerDuration?: number;
};

/**
 * Still skeleton — gradient shimmer on `bg-muted` ladder tokens (not flat pulse).
 */
function Skeleton({ className, shimmerDuration, ...props }: SkeletonProps) {
	return (
		<ShimmerBone
			data-slot="skeleton"
			className={cn("rounded-none", className)}
			shimmerDuration={shimmerDuration}
			{...props}
		/>
	);
}

export { ShimmerBone, ShimmerWrap, Skeleton };
