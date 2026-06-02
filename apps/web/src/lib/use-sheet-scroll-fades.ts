"use client";

import { type RefObject, useCallback, useEffect, useState } from "react";

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

	const syncScrollFades = useCallback(() => {
		const el = scrollRef.current;
		if (!el) return;
		setShowHeaderFade(el.scrollTop > SCROLL_EDGE_THRESHOLD_PX);
		const scrollable =
			el.scrollHeight - el.clientHeight > SCROLL_EDGE_THRESHOLD_PX;
		const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
		// Show bottom scrim whenever content extends below the fold, even at scrollTop 0.
		setShowFooterFade(
			scrollable && distanceFromBottom > SCROLL_EDGE_THRESHOLD_PX,
		);
	}, [scrollRef]);

	useEffect(() => {
		if (!enabled) {
			setShowHeaderFade(false);
			setShowFooterFade(true);
			return;
		}
		const el = scrollRef.current;
		if (!el) return;
		// Re-measure scrims when drawer body content changes (filmography, cast list, etc.).
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

	return { showHeaderFade, showFooterFade, syncScrollFades };
}
