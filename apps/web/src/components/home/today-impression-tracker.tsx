"use client";

import type { SenseClientProductEventKind } from "@/lib/sense-product-analytics";
import { useTrackImpressionOnce } from "@/lib/use-track-impression-once";

/** Renders nothing — lets server-rendered Today pieces record a once-per-mount impression. */
export function TodayImpressionTracker({
	kind,
	properties,
}: {
	kind: SenseClientProductEventKind;
	properties?: Record<string, unknown>;
}) {
	useTrackImpressionOnce(kind, properties);
	return null;
}
