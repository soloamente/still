/** Filter pill stacked circle — matches Tailwind `size-7` + `-ml-2` overlap. */
export const WATCHLIST_PILL_LOGO_SIZE_PX = 28;
export const WATCHLIST_PILL_LOGO_OVERLAP_PX = 8;

/** Row platform pill logo — matches Tailwind `size-9`. */
export const WATCHLIST_ROW_LOGO_SIZE_PX = 36;

/**
 * Estimate the landing circle rect for a stacked logo in the filter pill slot
 * (before the pill mounts, or when extending the stack).
 */
/** Slot is `empty:hidden` before the first provider — fall back to the trailing cluster. */
export function watchlistProviderFilterAnchorRect(): DOMRect {
	const slot = document.getElementById("watchlist-provider-pill-slot");
	if (!slot) return new DOMRect(0, 0, 0, 0);
	const slotRect = slot.getBoundingClientRect();
	if (slotRect.width > 4 && slotRect.height > 4) return slotRect;
	const parent = slot.parentElement;
	if (parent) {
		const parentRect = parent.getBoundingClientRect();
		return new DOMRect(
			parentRect.left,
			parentRect.top,
			WATCHLIST_PILL_LOGO_SIZE_PX,
			parentRect.height,
		);
	}
	return slotRect;
}

export function watchlistPillStackCircleRect(
	slotRect: DOMRect,
	stackIndex: number,
): DOMRect {
	const insetLeft = 6;
	const left =
		slotRect.left +
		insetLeft +
		stackIndex * (WATCHLIST_PILL_LOGO_SIZE_PX - WATCHLIST_PILL_LOGO_OVERLAP_PX);
	const top =
		slotRect.top + (slotRect.height - WATCHLIST_PILL_LOGO_SIZE_PX) / 2;
	return new DOMRect(
		left,
		top,
		WATCHLIST_PILL_LOGO_SIZE_PX,
		WATCHLIST_PILL_LOGO_SIZE_PX,
	);
}

/** Landing rect for the next stacked logo (row → pill flight). */
export function watchlistNextPillLogoLandingRect(stackIndex: number): DOMRect {
	const slot = document.getElementById("watchlist-provider-pill-slot");
	if (!slot) return new DOMRect(0, 0, 0, 0);
	const pillButton = slot.querySelector("button");
	if (pillButton && stackIndex > 0) {
		const triggerRect = pillButton.getBoundingClientRect();
		return watchlistPillStackCircleRect(triggerRect, stackIndex);
	}
	return watchlistPillStackCircleRect(
		watchlistProviderFilterAnchorRect(),
		stackIndex,
	);
}
