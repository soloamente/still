import { WATCHLIST_ROW_LOGO_SIZE_PX } from "@/lib/watchlist-provider-pill-stack-geometry";

/** Arc height scales with vertical travel — capped for short hops. */
function flyArcLiftPx(from: DOMRect, to: DOMRect, arcLiftScale = 1): number {
	const vertical = Math.abs(from.top - to.top);
	const base = Math.min(72, Math.max(28, vertical * 0.55 + 24));
	return base * arcLiftScale;
}

/** Quadratic Bézier sample at `t` (0–1) — one eased progress drives the whole path. */
export function watchlistProviderFlySample(
	from: DOMRect,
	to: DOMRect,
	t: number,
	options?: { arcLiftScale?: number },
): { x: number; y: number; scale: number } {
	const lift = flyArcLiftPx(from, to, options?.arcLiftScale ?? 1);
	const scaleEnd = to.width / from.width;
	const midScale = (1 + scaleEnd) / 2;

	const fromCx = from.left + from.width / 2;
	const fromCy = from.top + from.height / 2;
	const toCx = to.left + to.width / 2;
	const toCy = to.top + to.height / 2;
	const midCx = (fromCx + toCx) / 2;
	const midCy = Math.min(fromCy, toCy) - lift;

	const u = 1 - t;
	const cx = u * u * fromCx + 2 * u * t * midCx + t * t * toCx;
	const cy = u * u * fromCy + 2 * u * t * midCy + t * t * toCy;
	const scale = u * u * 1 + 2 * u * t * midScale + t * t * scaleEnd;

	const size = WATCHLIST_ROW_LOGO_SIZE_PX;
	return {
		x: cx - (size * scale) / 2,
		y: cy - (size * scale) / 2,
		scale,
	};
}

export const WATCHLIST_PROVIDER_FLY_DURATION_S = 0.48;
export const WATCHLIST_PROVIDER_FLY_EASE = [0.22, 1, 0.36, 1] as const;

export type WatchlistFlyPathEasing = {
	type: "easing";
	duration: number;
	ease: [number, number, number, number];
};

/** Motion `animate(0→1)` options from the watchlist fly path easing spec. */
export function watchlistFlyPathProgress(path: WatchlistFlyPathEasing): {
	duration: number;
	ease: [number, number, number, number];
} {
	return { duration: path.duration, ease: path.ease };
}
