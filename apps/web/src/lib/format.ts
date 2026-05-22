/**
 * Small date helpers. We deliberately don't pull in date-fns just to do
 * the two formats we need; a 20-line helper is plenty.
 */

export function formatDistanceToNowStrict(date: Date): string {
	const diffMs = Date.now() - date.getTime();
	if (diffMs < 0) return "in the future";
	const s = Math.floor(diffMs / 1000);
	if (s < 60) return `${s}s`;
	const m = Math.floor(s / 60);
	if (m < 60) return `${m}m`;
	const h = Math.floor(m / 60);
	if (h < 24) return `${h}h`;
	const d = Math.floor(h / 24);
	if (d < 30) return `${d}d`;
	const mo = Math.floor(d / 30);
	if (mo < 12) return `${mo}mo`;
	const y = Math.floor(d / 365);
	return `${y}y`;
}

/** Relative time with trailing “ago” — avoids “in the future ago” on skewed timestamps. */
export function formatTimeAgoLabel(value: Date | string): string {
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) return "Recently";
	if (date.getTime() > Date.now()) return "Just now";
	return `${formatDistanceToNowStrict(date)} ago`;
}

export function formatDate(
	date: Date,
	opts: Intl.DateTimeFormatOptions = {},
): string {
	return new Intl.DateTimeFormat("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
		...opts,
	}).format(date);
}

export function formatRuntime(
	minutes: number | null | undefined,
): string | null {
	if (!minutes) return null;
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	if (h === 0) return `${m}m`;
	if (m === 0) return `${h}h`;
	return `${h}h ${m}m`;
}
