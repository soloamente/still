"use client";

import {
	type RefObject,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";

const SCROLL_EDGE_THRESHOLD_PX = 8;

/**
 * Top + bottom scroll scrims for sheet/drawer bodies on `bg-card` — mirrors review
 * composer footer fade; header fade appears once the user scrolls down.
 */
export function useSheetScrollFades(
	scrollRef: RefObject<HTMLDivElement | null>,
	enabled: boolean,
	contentKey = "",
) {
	const [showHeaderFade, setShowHeaderFade] = useState(false);
	const [showFooterFade, setShowFooterFade] = useState(true);
	const fadeStateRef = useRef({ header: false, footer: true });

	const syncScrollFades = useCallback(() => {
		const el = scrollRef.current;
		if (!el) return;

		const nextHeader = el.scrollTop > SCROLL_EDGE_THRESHOLD_PX;
		const scrollable =
			el.scrollHeight - el.clientHeight > SCROLL_EDGE_THRESHOLD_PX;
		const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
		// Show bottom scrim whenever content extends below the fold, even at scrollTop 0.
		const nextFooter =
			scrollable && distanceFromBottom > SCROLL_EDGE_THRESHOLD_PX;

		if (fadeStateRef.current.header !== nextHeader) {
			fadeStateRef.current.header = nextHeader;
			setShowHeaderFade(nextHeader);
		}
		if (fadeStateRef.current.footer !== nextFooter) {
			fadeStateRef.current.footer = nextFooter;
			setShowFooterFade(nextFooter);
		}
	}, [scrollRef]);

	useEffect(() => {
		if (!enabled) {
			fadeStateRef.current = { header: false, footer: true };
			setShowHeaderFade(false);
			setShowFooterFade(true);
			return;
		}
		const el = scrollRef.current;
		if (!el) return;
		// Re-measure scrims when drawer body content changes (filmography, cast list, etc.).
		void contentKey;

		let scrollRaf: number | null = null;
		let resizeRaf: number | null = null;

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
			if (resizeRaf !== null) return;
			resizeRaf = requestAnimationFrame(() => {
				resizeRaf = null;
				runSync();
			});
		});
		resizeObserver.observe(el);
		for (const child of el.children) {
			resizeObserver.observe(child);
		}

		el.addEventListener("load", runSync, true);
		el.addEventListener("scroll", handleScroll, { passive: true });
		return () => {
			if (scrollRaf !== null) cancelAnimationFrame(scrollRaf);
			if (resizeRaf !== null) cancelAnimationFrame(resizeRaf);
			cancelAnimationFrame(raf1);
			resizeObserver.disconnect();
			el.removeEventListener("load", runSync, true);
			el.removeEventListener("scroll", handleScroll);
		};
	}, [enabled, contentKey, syncScrollFades, scrollRef]);

	return { showHeaderFade, showFooterFade, syncScrollFades };
}
