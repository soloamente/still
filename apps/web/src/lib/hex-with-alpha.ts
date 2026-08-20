/** `#rrggbb` → `rgba(r,g,b,a)` for inline tints on cover-derived accents. */
export function hexWithAlpha(hex: string, alpha: number): string {
	const normalized = hex.trim().replace("#", "").slice(0, 6);
	if (normalized.length !== 6) return hex;

	const r = Number.parseInt(normalized.slice(0, 2), 16);
	const g = Number.parseInt(normalized.slice(2, 4), 16);
	const b = Number.parseInt(normalized.slice(4, 6), 16);
	const clampedAlpha = Math.max(0, Math.min(1, alpha));

	if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) {
		return hex;
	}

	return `rgba(${r}, ${g}, ${b}, ${clampedAlpha})`;
}
