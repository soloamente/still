"use client";

import { useEffect, useState } from "react";

import {
	sampleMostUsedDarkRgb,
	searchDialogPeopleScrimSampleSrc,
} from "@/lib/search-dialog-people-portrait-scrim";

/** Cache sampled scrim colors by remote URL so rail remounts do not flash. */
const scrimColorByUrl = new Map<string, string | null>();

function cachedScrimColor(imageUrl: string | null | undefined): string | null {
	if (!imageUrl) return null;
	return scrimColorByUrl.has(imageUrl)
		? (scrimColorByUrl.get(imageUrl) ?? null)
		: null;
}

/**
 * Sample via the same-origin `/_next/image` optimizer so canvas can read TMDb
 * pixels. The visible `<img>` stays on the raw CDN URL (no `crossOrigin`).
 */
export function useSearchDialogPeoplePortraitScrimColor(
	imageUrl: string | null | undefined,
): string | null {
	const [color, setColor] = useState<string | null>(() =>
		cachedScrimColor(imageUrl),
	);

	useEffect(() => {
		const url = imageUrl?.trim() || null;
		if (!url) {
			setColor(null);
			return;
		}
		if (scrimColorByUrl.has(url)) {
			setColor(scrimColorByUrl.get(url) ?? null);
			return;
		}

		let cancelled = false;
		const sampleSrc = searchDialogPeopleScrimSampleSrc(url);
		const img = new Image();
		img.decoding = "async";
		img.onload = () => {
			if (cancelled) return;
			const sampled = sampleMostUsedDarkRgb(img);
			scrimColorByUrl.set(url, sampled);
			setColor(sampled);
		};
		img.onerror = () => {
			if (cancelled) return;
			scrimColorByUrl.set(url, null);
			setColor(null);
		};
		// Same-origin optimizer URL — readable by canvas without crossOrigin.
		img.src = sampleSrc;

		return () => {
			cancelled = true;
			img.onload = null;
			img.onerror = null;
			img.src = "";
		};
	}, [imageUrl]);

	return color;
}
