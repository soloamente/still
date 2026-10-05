"use client";

import { cn } from "@still/ui/lib/utils";
import { animate, useReducedMotion } from "motion/react";
import { useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";

import { useWatchlistProviderFlyMotion } from "@/components/watchlist/watchlist-provider-fly-context";
import {
	type WatchlistFlyPathEasing,
	watchlistFlyPathProgress,
	watchlistProviderFlySample,
} from "@/lib/watchlist-provider-fly-path";
import { WATCHLIST_PROVIDER_PILL_MOTION } from "@/lib/watchlist-provider-pill-motion";
import { WATCHLIST_ROW_LOGO_SIZE_PX } from "@/lib/watchlist-provider-pill-stack-geometry";

/** Fixed-position logo flyer from the provider rail into the filter pill. */
export function WatchlistProviderFlyLayer() {
	const reduceMotion = useReducedMotion();
	const motion = WATCHLIST_PROVIDER_PILL_MOTION;
	const { activeFly, completeFly, markFlyTargetMeasured } =
		useWatchlistProviderFlyMotion();
	const ghostRef = useRef<HTMLDivElement>(null);
	const flightKeyRef = useRef<number | null>(null);

	useLayoutEffect(() => {
		if (activeFly == null || activeFly.toMeasured) return;
		const landed = document.querySelector(
			`[data-watchlist-pill-logo="${activeFly.providerId}"]`,
		);
		const to =
			landed instanceof HTMLElement
				? landed.getBoundingClientRect()
				: activeFly.to;
		markFlyTargetMeasured(activeFly.providerId, to);
	}, [activeFly, markFlyTargetMeasured]);

	useLayoutEffect(() => {
		if (activeFly == null || !activeFly.toMeasured) return;
		if (reduceMotion) {
			completeFly(activeFly.providerId, { syncNavigateImmediately: true });
			return;
		}

		const el = ghostRef.current;
		if (el == null) return;

		const { from, to, providerId } = activeFly;
		flightKeyRef.current = providerId;

		const flyOptions = { arcLiftScale: motion.fly.arcLiftScale };
		const pathProgress = watchlistFlyPathProgress(
			motion.fly.path as WatchlistFlyPathEasing,
		);
		const sample0 = watchlistProviderFlySample(from, to, 0, flyOptions);
		el.style.transform = `translate3d(${sample0.x}px, ${sample0.y}px, 0) scale(${sample0.scale})`;

		const controls = animate(0, 1, {
			duration: pathProgress.duration,
			ease: pathProgress.ease,
			onUpdate: (t) => {
				const sample = watchlistProviderFlySample(from, to, t, flyOptions);
				el.style.transform = `translate3d(${sample.x}px, ${sample.y}px, 0) scale(${sample.scale})`;
			},
			onComplete: () => {
				if (flightKeyRef.current === providerId) {
					completeFly(providerId);
				}
			},
		});

		return () => controls.stop();
	}, [
		activeFly,
		completeFly,
		motion.fly.arcLiftScale,
		motion.fly.path,
		reduceMotion,
	]);

	if (activeFly == null || !activeFly.toMeasured) {
		return null;
	}

	const { src, name, fallbackLabel } = activeFly;

	const layer = (
		<div
			ref={ghostRef}
			className={cn(
				"pointer-events-none fixed top-0 left-0 z-[220] overflow-hidden rounded-full bg-card ring-2 ring-background will-change-transform",
			)}
			style={{
				width: WATCHLIST_ROW_LOGO_SIZE_PX,
				height: WATCHLIST_ROW_LOGO_SIZE_PX,
				transformOrigin: "top left",
			}}
		>
			{src ? (
				// biome-ignore lint/performance/noImgElement: ephemeral fly ghost
				<img
					src={src}
					alt=""
					className="size-full object-cover"
					decoding="async"
					draggable={false}
				/>
			) : (
				<span className="flex size-full items-center justify-center font-medium text-foreground text-xs">
					{(fallbackLabel ?? name.slice(0, 2)).toUpperCase()}
				</span>
			)}
		</div>
	);

	return createPortal(layer, document.body);
}
