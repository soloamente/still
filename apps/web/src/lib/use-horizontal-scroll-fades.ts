"use client";

import {
	type RefObject,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";

const SCROLL_EDGE_THRESHOLD_PX = 8;

/** Shared overflow-x rail classes — native scroll only (matches streaming provider picker). */
export const HORIZONTAL_OVERFLOW_RAIL_CLASSNAME =
	"scrollbar-none flex flex-nowrap gap-2 overflow-x-auto overscroll-x-contain pb-1 [-ms-overflow-style:none] [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden";

/**
 * Left + right scroll scrims for horizontal chip rails — fades hide when content
 * does not overflow or when the user has scrolled to that edge.
 */
export function useHorizontalScrollFades(
	scrollRef: RefObject<HTMLDivElement | null>,
	enabled: boolean,
	contentKey = "",
) {
	const [showStartFade, setShowStartFade] = useState(false);
	const [showEndFade, setShowEndFade] = useState(false);
	const fadeStateRef = useRef({ start: false, end: false });

	const syncScrollFades = useCallback(() => {
		const el = scrollRef.current;
		if (!el) return;
		const scrollable =
			el.scrollWidth - el.clientWidth > SCROLL_EDGE_THRESHOLD_PX;
		const nextStart = scrollable && el.scrollLeft > SCROLL_EDGE_THRESHOLD_PX;
		const distanceFromEnd = el.scrollWidth - el.scrollLeft - el.clientWidth;
		const nextEnd = scrollable && distanceFromEnd > SCROLL_EDGE_THRESHOLD_PX;

		if (fadeStateRef.current.start !== nextStart) {
			fadeStateRef.current.start = nextStart;
			setShowStartFade(nextStart);
		}
		if (fadeStateRef.current.end !== nextEnd) {
			fadeStateRef.current.end = nextEnd;
			setShowEndFade(nextEnd);
		}
	}, [scrollRef]);

	useEffect(() => {
		if (!enabled) {
			fadeStateRef.current = { start: false, end: false };
			setShowStartFade(false);
			setShowEndFade(false);
			return;
		}
		const el = scrollRef.current;
		if (!el) return;
		void contentKey;

		let scrollRaf: number | null = null;

		const runSync = () => {
			syncScrollFades();
		};

		// Coalesce scroll-driven fade updates to one frame — avoids React work every wheel tick.
		const handleScroll = () => {
			if (scrollRaf !== null) return;
			scrollRaf = requestAnimationFrame(() => {
				scrollRaf = null;
				runSync();
			});
		};

		runSync();
		const raf1 = requestAnimationFrame(() => {
			runSync();
			requestAnimationFrame(runSync);
		});

		const resizeObserver = new ResizeObserver(() => {
			runSync();
		});
		resizeObserver.observe(el);
		for (const child of el.children) {
			resizeObserver.observe(child);
		}

		// Poster thumbs load async — resync edge fades once decode/layout settles.
		el.addEventListener("load", runSync, true);
		el.addEventListener("scroll", handleScroll, { passive: true });
		return () => {
			if (scrollRaf !== null) cancelAnimationFrame(scrollRaf);
			cancelAnimationFrame(raf1);
			resizeObserver.disconnect();
			el.removeEventListener("load", runSync, true);
			el.removeEventListener("scroll", handleScroll);
		};
	}, [enabled, contentKey, syncScrollFades, scrollRef]);

	return { showStartFade, showEndFade, syncScrollFades };
}

const POSTER_EDGE_FADE_WIDTH_PX = 64;
const POSTER_EDGE_MIN_OPACITY = 0.15;

/** Ramp poster opacity when clipped by the rail viewport — no overlay scrims. */
function computePosterEdgeOpacityFactor(
	containerRect: DOMRect,
	childRect: DOMRect,
	fadeWidthPx: number,
	minOpacity: number,
): number {
	let edgeFactor = 1;
	if (childRect.right > containerRect.right) {
		edgeFactor = Math.min(
			edgeFactor,
			1 - (childRect.right - containerRect.right) / fadeWidthPx,
		);
	}
	if (childRect.left < containerRect.left) {
		edgeFactor = Math.min(
			edgeFactor,
			1 - (containerRect.left - childRect.left) / fadeWidthPx,
		);
	}
	return Math.max(minOpacity, Math.min(1, edgeFactor));
}

/**
 * Writes `--edge-opacity` on each scroll-rail child so posters fade at clipped edges
 * instead of using a horizontal gradient/blur overlay.
 */
export function useHorizontalRailPosterEdgeOpacity(
	scrollRef: RefObject<HTMLDivElement | null>,
	enabled: boolean,
	contentKey = "",
	options?: { fadeWidthPx?: number; minOpacity?: number },
) {
	const syncPosterEdgeOpacity = useCallback(() => {
		const el = scrollRef.current;
		if (!el || !enabled) return;

		const fadeWidthPx = options?.fadeWidthPx ?? POSTER_EDGE_FADE_WIDTH_PX;
		const minOpacity = options?.minOpacity ?? POSTER_EDGE_MIN_OPACITY;
		const containerRect = el.getBoundingClientRect();

		for (const child of el.children) {
			if (!(child instanceof HTMLElement)) continue;
			const edgeFactor = computePosterEdgeOpacityFactor(
				containerRect,
				child.getBoundingClientRect(),
				fadeWidthPx,
				minOpacity,
			);
			child.style.setProperty("--edge-opacity", String(edgeFactor));
		}
	}, [enabled, options?.fadeWidthPx, options?.minOpacity, scrollRef]);

	useEffect(() => {
		const el = scrollRef.current;
		if (!enabled || !el) {
			return;
		}
		void contentKey;

		let scrollRaf: number | null = null;

		const runSync = () => {
			syncPosterEdgeOpacity();
		};

		const handleScroll = () => {
			if (scrollRaf !== null) return;
			scrollRaf = requestAnimationFrame(() => {
				scrollRaf = null;
				runSync();
			});
		};

		runSync();
		const raf1 = requestAnimationFrame(() => {
			runSync();
			requestAnimationFrame(runSync);
		});

		const resizeObserver = new ResizeObserver(runSync);
		resizeObserver.observe(el);
		for (const child of el.children) {
			resizeObserver.observe(child);
		}

		el.addEventListener("load", runSync, true);
		el.addEventListener("scroll", handleScroll, { passive: true });

		return () => {
			if (scrollRaf !== null) cancelAnimationFrame(scrollRaf);
			cancelAnimationFrame(raf1);
			resizeObserver.disconnect();
			el.removeEventListener("load", runSync, true);
			el.removeEventListener("scroll", handleScroll);
			for (const child of el.children) {
				if (child instanceof HTMLElement) {
					child.style.removeProperty("--edge-opacity");
				}
			}
		};
	}, [contentKey, enabled, scrollRef, syncPosterEdgeOpacity]);
}
