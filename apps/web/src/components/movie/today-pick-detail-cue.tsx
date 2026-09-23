"use client";

import { useEffect, useState } from "react";

import {
	readTodayPickContinuity,
	todayPickDetailCue,
} from "@/lib/today-pick-continuity";

/**
 * Small **Today’s pick** label + Home's reason line on the pick's title page.
 * Reads session storage after mount (SSR renders nothing — no hydration mismatch).
 */
export function TodayPickDetailCue({
	mediaKind,
	tmdbId,
}: {
	mediaKind: "movie" | "tv";
	tmdbId: number;
}) {
	const [reason, setReason] = useState<string | null>(null);

	useEffect(() => {
		setReason(
			todayPickDetailCue(readTodayPickContinuity(), mediaKind, tmdbId)
				?.reason ?? null,
		);
	}, [mediaKind, tmdbId]);

	if (!reason) return null;
	return (
		<p className="mt-3 text-balance text-muted-foreground text-sm">
			<span className="font-semibold text-foreground">Today’s pick</span>
			<span aria-hidden> · </span>
			<span className="sr-only">, </span>
			{reason}
		</p>
	);
}
