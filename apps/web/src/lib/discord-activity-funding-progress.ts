/** Clamp public Discord funding counts for bar width and labels. */
export function clampFundingProgress(
	current: number,
	target: number,
): { ratio: number; labelCurrent: number; labelTarget: number } {
	const labelCurrent = current;
	const labelTarget = target;

	if (target <= 0) {
		return { ratio: 0, labelCurrent, labelTarget };
	}

	const ratio = Math.min(Math.max(current / target, 0), 1);
	return { ratio, labelCurrent, labelTarget };
}
