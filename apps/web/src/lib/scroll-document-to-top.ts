import type Lenis from "lenis";

export type ScrollDocumentBehavior = "instant" | "smooth";

/** Instant native scroll — used when Lenis is absent or as a sync fallback. */
export function scrollWindowToTopInstant(): void {
	if (typeof window === "undefined") return;
	window.scrollTo({ top: 0, behavior: "instant" });
}

/**
 * Reset the document scroll position — syncs Lenis when mounted and always
 * updates native scroll so both smooth-scroll and native modes stay aligned.
 */
export function scrollDocumentToTop(options?: {
	lenis?: Lenis | null;
	behavior?: ScrollDocumentBehavior;
}): void {
	const behavior = options?.behavior ?? "instant";
	const lenis = options?.lenis;

	if (lenis) {
		lenis.scrollTo(0, {
			immediate: behavior === "instant",
			duration: behavior === "instant" ? 0 : undefined,
		});
	}

	if (behavior === "instant") {
		scrollWindowToTopInstant();
		return;
	}

	if (typeof window === "undefined") return;
	window.scrollTo({ top: 0, behavior: "smooth" });
}
