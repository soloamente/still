/**
 * How many in-window logs a viewer is NOT allowed to see.
 *
 * @param totalInWindow qualifying logs the leaderboard ranking counts
 * @param visibleToViewer logs returned after applying visibility rules
 */
export function clampHiddenCount(
	totalInWindow: number,
	visibleToViewer: number,
): number {
	return Math.max(0, totalInWindow - visibleToViewer);
}
