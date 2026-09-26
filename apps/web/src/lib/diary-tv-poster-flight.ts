/**
 * Diary TV poster clone: freeze the in-flight transform when the cell is gone,
 * then fade opacity. The normal 0.45s trip is unchanged.
 */

/** Live clone values sampled from the flight `motion.div` `onUpdate`. */
export interface DiaryTvPosterFlightLive {
	x: number;
	y: number;
	scale: number;
	rotateY: number;
	borderRadius: number;
}

export interface DiaryTvPosterFlightFadePose extends DiaryTvPosterFlightLive {
	opacity: number;
	moveDuration: number;
}

/** Motion `onUpdate` may hand back a number or a unit string. */
export function motionNumeric(value: unknown, fallback: number): number {
	if (typeof value === "number" && Number.isFinite(value)) return value;
	if (typeof value === "string") {
		const parsed = Number.parseFloat(value);
		if (Number.isFinite(parsed)) return parsed;
	}
	return fallback;
}

/** Read the clone's current animated values. Missing keys keep `fallback`. */
export function readLiveFlightSample(
	latest: Record<string, unknown>,
	fallback: DiaryTvPosterFlightLive,
): DiaryTvPosterFlightLive {
	return {
		x: motionNumeric(latest.x, fallback.x),
		y: motionNumeric(latest.y, fallback.y),
		scale: motionNumeric(latest.scale, fallback.scale),
		rotateY: motionNumeric(latest.rotateY, fallback.rotateY),
		borderRadius: motionNumeric(latest.borderRadius, fallback.borderRadius),
	};
}

/**
 * Keep the clone where it is (live sample, or the current targets if none
 * exists yet). Do not retarget the missing cell. `moveDuration` 0 freezes
 * x/y/scale/rotateY/radius; opacity is left for the 0.2s fade.
 */
export function freezePosterFlightForFade<
	T extends DiaryTvPosterFlightFadePose,
>(current: T, live: DiaryTvPosterFlightLive | null): T {
	return {
		...current,
		x: live?.x ?? current.x,
		y: live?.y ?? current.y,
		scale: live?.scale ?? current.scale,
		rotateY: live?.rotateY ?? current.rotateY,
		borderRadius: live?.borderRadius ?? current.borderRadius,
		opacity: 0,
		moveDuration: 0,
	};
}

/** A null, detached, or zero-size cell cannot take the flight home. */
export function cellCanReceivePoster(node: HTMLElement | null): boolean {
	if (!node?.isConnected) return false;
	const { width, height } = node.getBoundingClientRect();
	return width > 0 && height > 0;
}
