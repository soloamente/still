"use client";

import { type RefObject, useCallback, useEffect, useState } from "react";

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
		setShowHeaderFade(el.scrollTop > 8);
		const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
		setShowFooterFade(distanceFromBottom > 8);
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
		syncScrollFades();
		el.addEventListener("scroll", syncScrollFades, { passive: true });
		return () => el.removeEventListener("scroll", syncScrollFades);
	}, [enabled, contentKey, syncScrollFades, scrollRef]);

	return { showHeaderFade, showFooterFade, syncScrollFades };
}
