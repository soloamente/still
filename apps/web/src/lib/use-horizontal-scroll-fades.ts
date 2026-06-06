"use client";

import { type RefObject, useCallback, useEffect, useState } from "react";

const SCROLL_EDGE_THRESHOLD_PX = 8;

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
	const [showEndFade, setShowEndFade] = useState(true);

	const syncScrollFades = useCallback(() => {
		const el = scrollRef.current;
		if (!el) return;
		const scrollable =
			el.scrollWidth - el.clientWidth > SCROLL_EDGE_THRESHOLD_PX;
		setShowStartFade(scrollable && el.scrollLeft > SCROLL_EDGE_THRESHOLD_PX);
		const distanceFromEnd = el.scrollWidth - el.scrollLeft - el.clientWidth;
		setShowEndFade(scrollable && distanceFromEnd > SCROLL_EDGE_THRESHOLD_PX);
	}, [scrollRef]);

	useEffect(() => {
		if (!enabled) {
			setShowStartFade(false);
			setShowEndFade(true);
			return;
		}
		const el = scrollRef.current;
		if (!el) return;
		void contentKey;

		const runSync = () => {
			syncScrollFades();
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

		el.addEventListener("scroll", runSync, { passive: true });
		return () => {
			cancelAnimationFrame(raf1);
			resizeObserver.disconnect();
			el.removeEventListener("scroll", runSync);
		};
	}, [enabled, contentKey, syncScrollFades, scrollRef]);

	return { showStartFade, showEndFade, syncScrollFades };
}
