"use client";

import { useEffect, useRef } from "react";

import { trackSenseProductEvent } from "@/lib/sense-product-analytics";

/**
 * Fires `journal.read` once per article mount — public SEO pages stay outside `(app)`.
 */
export function JournalReadTracker({
	postId,
	slug,
}: {
	postId: string;
	slug: string;
}) {
	const trackedRef = useRef(false);

	useEffect(() => {
		if (trackedRef.current) return;
		trackedRef.current = true;
		trackSenseProductEvent("journal.read", { postId, slug });
	}, [postId, slug]);

	return null;
}
