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
