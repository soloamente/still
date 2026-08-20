/**
 * Parse a CSS duration custom property (`200ms`, `.2s`, `0.2s`) into milliseconds.
 * `Number.parseInt(".2s")` is NaN — browsers often serialize `200ms` as `.2s`.
 */
export function parseCssDurationMs(raw: string, fallbackMs = 200): number {
	const trimmed = raw.trim();
	if (!trimmed) return fallbackMs;
	const match = /^(-?[\d.]+)(ms|s)?$/i.exec(trimmed);
	if (!match) return fallbackMs;
	const value = Number.parseFloat(match[1] ?? "");
	if (!Number.isFinite(value)) return fallbackMs;
	const unit = (match[2] ?? "ms").toLowerCase();
	const ms = unit === "s" ? value * 1000 : value;
	return ms > 0 ? ms : fallbackMs;
}

/** Max of `--page-slide-dur` / `--page-fade-dur` for page-slide orchestration timeouts. */
export function readPageSlideMs(fallbackMs = 200): number {
	if (typeof document === "undefined") return fallbackMs;
	const root = document.documentElement;
	const cs = getComputedStyle(root);
	const slideMs = parseCssDurationMs(
		cs.getPropertyValue("--page-slide-dur"),
		fallbackMs,
	);
	const fadeMs = parseCssDurationMs(
		cs.getPropertyValue("--page-fade-dur"),
		fallbackMs,
	);
	return Math.max(slideMs, fadeMs);
}
