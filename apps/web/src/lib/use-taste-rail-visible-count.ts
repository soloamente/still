"use client";

import { useEffect, useRef, useState } from "react";

import {
	TASTE_RAIL_MIN_VISIBLE,
	tasteRailVisibleCount,
} from "@/lib/home-taste-matched-rail-layout";

/** Measures the taste rail track and returns how many posters fit on one row. */
export function useTasteRailVisibleCount() {
	const trackRef = useRef<HTMLDivElement>(null);
	const [visibleCount, setVisibleCount] = useState(TASTE_RAIL_MIN_VISIBLE);

	useEffect(() => {
		const el = trackRef.current;
		if (!el) return;

		const measure = () => {
			setVisibleCount(tasteRailVisibleCount(el.clientWidth));
		};

		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(el);
		return () => observer.disconnect();
	}, []);

	return { trackRef, visibleCount };
}
