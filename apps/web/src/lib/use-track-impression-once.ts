"use client";

import { useEffect, useRef } from "react";

import {
	type SenseClientProductEventKind,
	trackSenseProductEvent,
} from "@/lib/sense-product-analytics";

/**
 * Fire a product impression once per mount, the first time `enabled` is true.
 * Properties are read at that moment (later changes don't re-fire).
 */
export function useTrackImpressionOnce(
	kind: SenseClientProductEventKind,
	properties: Record<string, unknown> = {},
	enabled = true,
): void {
	const firedRef = useRef(false);
	const propertiesRef = useRef(properties);
	propertiesRef.current = properties;

	useEffect(() => {
		if (!enabled || firedRef.current) return;
		firedRef.current = true;
		trackSenseProductEvent(kind, propertiesRef.current);
	}, [enabled, kind]);
}
