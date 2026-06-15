"use client";

import { useEffect, useRef } from "react";

import { trackSenseProductEvent } from "@/lib/sense-product-analytics";

/** Fire `wrapped.viewed` once per page mount. */
export function YearInReviewViewTracker({ year }: { year: number }) {
	const sent = useRef(false);

	useEffect(() => {
		if (sent.current) return;
		sent.current = true;
		trackSenseProductEvent("wrapped.viewed", { year });
	}, [year]);

	return null;
}
