"use client";

import { useLenis } from "lenis/react";
import { useEffect, useLayoutEffect, useRef } from "react";

import type { MovieDetailView } from "@/lib/movie-detail-view";
import { scrollDocumentToTop } from "@/lib/scroll-document-to-top";

/**
 * Film/TV detail scroll policy — always start at the top on forward entry and tab
 * switches; temporarily disable browser scroll restoration while mounted so stale
 * detail offsets cannot replay after paint.
 */
export function useListingDetailScrollReset(args: {
	listingId: number;
	view: MovieDetailView;
}): void {
	const lenis = useLenis();
	const previousRestorationRef = useRef<ScrollRestoration | null>(null);
	const resetKeyRef = useRef<string | null>(null);

	const resetKey = `${args.listingId}:${args.view}`;

	// Block the browser from restoring a prior detail scroll offset on this route.
	useLayoutEffect(() => {
		if (typeof window === "undefined") return;
		previousRestorationRef.current = window.history.scrollRestoration;
		window.history.scrollRestoration = "manual";
		return () => {
			if (previousRestorationRef.current != null) {
				window.history.scrollRestoration = previousRestorationRef.current;
			}
		};
	}, []);

	useLayoutEffect(() => {
		if (resetKeyRef.current === resetKey) return;
		resetKeyRef.current = resetKey;
		scrollDocumentToTop({ lenis, behavior: "instant" });
	}, [lenis, resetKey]);

	// One rAF retry catches late browser restoration races after commit.
	useEffect(() => {
		if (typeof window === "undefined") return;
		const id = requestAnimationFrame(() => {
			if (window.scrollY > 0) {
				scrollDocumentToTop({ lenis, behavior: "instant" });
			}
		});
		return () => cancelAnimationFrame(id);
	}, [lenis, resetKey]);
}
