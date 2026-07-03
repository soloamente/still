/**
 * Preserve horizontal scroll position when older week columns are prepended left.
 */
export function computeScrollLeftAfterPrepend({
	scrollLeft,
	prevScrollWidth,
	nextScrollWidth,
}: {
	scrollLeft: number;
	prevScrollWidth: number;
	nextScrollWidth: number;
}): number {
	return scrollLeft + (nextScrollWidth - prevScrollWidth);
}
