"use client";

import {
	SKELETON_SHIMMER_DURATION_S,
	skeletonCardWipeTransition,
} from "@still/ui/components/skeleton-shimmer";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { type ReactNode, startTransition, useEffect, useState } from "react";

type SkeletonShimmerRevealProps = {
	/** When true, show `children`; otherwise show `fallback`. */
	loaded: boolean;
	fallback: ReactNode;
	children: ReactNode;
	/** Optional artificial delay before revealing (demo default 2.5s). */
	loadDelay?: number;
	shimmerDuration?: number;
	className?: string;
};

/**
 * Cross-fades skeleton → content. Uses `AnimateView` from motion-plus when the
 * package is installed; otherwise falls back to `AnimatePresence` opacity.
 */
export function SkeletonShimmerReveal({
	loaded,
	fallback,
	children,
	loadDelay = 0,
	shimmerDuration = SKELETON_SHIMMER_DURATION_S,
	className,
}: SkeletonShimmerRevealProps) {
	const reducedMotion = useReducedMotion();
	const [revealed, setRevealed] = useState(loadDelay <= 0 ? loaded : false);

	useEffect(() => {
		if (loadDelay <= 0) {
			setRevealed(loaded);
			return;
		}
		if (!loaded) {
			setRevealed(false);
			return;
		}
		const timer = window.setTimeout(
			() => startTransition(() => setRevealed(true)),
			loadDelay,
		);
		return () => window.clearTimeout(timer);
	}, [loaded, loadDelay]);

	void shimmerDuration;

	if (reducedMotion) {
		return (
			<div className={className} aria-busy={!revealed}>
				{revealed ? children : fallback}
			</div>
		);
	}

	return (
		<div className={className} aria-busy={!revealed}>
			<SkeletonShimmerRevealInner revealed={revealed} fallback={fallback}>
				{children}
			</SkeletonShimmerRevealInner>
		</div>
	);
}

function SkeletonShimmerRevealInner({
	revealed,
	fallback,
	children,
}: {
	revealed: boolean;
	fallback: ReactNode;
	children: ReactNode;
}) {
	const [AnimateView, setAnimateView] = useState<
		typeof import("motion-plus/animate-view").AnimateView | null
	>(null);

	useEffect(() => {
		let cancelled = false;
		import("motion-plus/animate-view")
			.then((mod) => {
				if (!cancelled) setAnimateView(() => mod.AnimateView);
			})
			.catch(() => {
				/* motion-plus optional — Motion+ token required at install time */
			});
		return () => {
			cancelled = true;
		};
	}, []);

	if (AnimateView) {
		return (
			<AnimateView name="skeleton-card" update={skeletonCardWipeTransition}>
				{revealed ? children : fallback}
			</AnimateView>
		);
	}

	return (
		<AnimatePresence mode="popLayout" initial={false}>
			{revealed ? (
				<motion.div
					key="content"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.2, ease: "easeOut" }}
				>
					{children}
				</motion.div>
			) : (
				<motion.div
					key="skeleton"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.15, ease: "easeOut" }}
				>
					{fallback}
				</motion.div>
			)}
		</AnimatePresence>
	);
}
