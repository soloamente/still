/** Compact relative time ("5m", "3h", "2d", "2w") for feed bylines. */
export function formatTimeAgo(
	value: string | Date,
	now: number = Date.now(),
): string {
	const ms =
		value instanceof Date ? value.getTime() : new Date(value).getTime();
	if (Number.isNaN(ms)) return "just now";
	const diff = now - ms;
	if (diff < 45_000) return "just now";
	const mins = Math.floor(diff / 60_000);
	if (mins < 60) return `${mins}m`;
	const hours = Math.floor(diff / 3_600_000);
	if (hours < 24) return `${hours}h`;
	const days = Math.floor(diff / 86_400_000);
	if (days < 7) return `${days}d`;
	const weeks = Math.floor(days / 7);
	if (weeks < 52) return `${weeks}w`;
	return `${Math.floor(days / 365)}y`;
}
