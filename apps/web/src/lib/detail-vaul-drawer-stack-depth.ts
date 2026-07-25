import {
	MOVIE_DETAIL_DRAWER_SURFACE_ATTR,
	VAUL_DRAWER_DEPTH_BORDER_RADIUS_PX,
	VAUL_DRAWER_DEPTH_EASE,
	VAUL_DRAWER_DEPTH_SCALE_OFFSET_PX,
	VAUL_DRAWER_DEPTH_TRANSITION_S,
	VAUL_DRAWER_DEPTH_TRANSLATE_PX,
	VAUL_DRAWER_SHEET_RESTING_BORDER_RADIUS,
} from "@/lib/detail-vaul-drawer";

/** Marks a parent drawer receiving stack depth while a sheet above is open. */
export const STILL_DRAWER_STACK_DEPTH_ATTR = "data-still-drawer-stack-depth";

const OPEN_DRAWER_SELECTOR = `[data-vaul-drawer][${MOVIE_DETAIL_DRAWER_SURFACE_ATTR}]`;

const RELEASE_CLEANUP_MS =
	Math.ceil(VAUL_DRAWER_DEPTH_TRANSITION_S * 1000) + 32;

/** Pending post-transition cleanups — cancelled when depth is re-applied. */
const releaseCleanupTimers = new WeakMap<HTMLElement, number>();

function nestedDrawerStackScale(): number {
	return (
		(window.innerWidth - VAUL_DRAWER_DEPTH_SCALE_OFFSET_PX) / window.innerWidth
	);
}

function cancelReleaseCleanup(element: HTMLElement): void {
	const timer = releaseCleanupTimers.get(element);
	if (timer == null) return;
	window.clearTimeout(timer);
	releaseCleanupTimers.delete(element);
}

function scheduleReleaseCleanup(element: HTMLElement): void {
	cancelReleaseCleanup(element);
	const timer = window.setTimeout(() => {
		releaseCleanupTimers.delete(element);
		if (!element.hasAttribute(STILL_DRAWER_STACK_DEPTH_ATTR)) return;
		element.removeAttribute(STILL_DRAWER_STACK_DEPTH_ATTR);
		clearDrawerRadiusInlineStyles(element);
		element.style.removeProperty("transform-origin");
		element.style.removeProperty("transition-property");
		element.style.removeProperty("transition-duration");
		element.style.removeProperty("transition-timing-function");
	}, RELEASE_CLEANUP_MS);
	releaseCleanupTimers.set(element, timer);
}

/** Parent / lower sheets in a stack — match Vaul page `shouldScaleBackground` depth. */
export function applyDrawerStackDepth(element: HTMLElement): void {
	cancelReleaseCleanup(element);
	const scale = nestedDrawerStackScale();
	element.setAttribute(STILL_DRAWER_STACK_DEPTH_ATTR, "");
	element.style.transformOrigin = "top";
	element.style.transitionProperty = "transform, border-radius";
	element.style.transitionDuration = `${VAUL_DRAWER_DEPTH_TRANSITION_S}s`;
	element.style.transitionTimingFunction = VAUL_DRAWER_DEPTH_EASE;
	element.style.borderRadius = `${VAUL_DRAWER_DEPTH_BORDER_RADIUS_PX}px`;
	element.style.transform = `scale(${scale}) translate3d(0, calc(env(safe-area-inset-top) + ${VAUL_DRAWER_DEPTH_TRANSLATE_PX}px), 0)`;
}

function clearDrawerRadiusInlineStyles(element: HTMLElement): void {
	element.style.removeProperty("border-radius");
	element.style.removeProperty("border-top-left-radius");
	element.style.removeProperty("border-top-right-radius");
	element.style.removeProperty("border-bottom-left-radius");
	element.style.removeProperty("border-bottom-right-radius");
}

/**
 * Animate a stacked parent sheet back to full scale — keep transitions intact until
 * the easing finishes (clearing early caused a delayed snap when Vaul reset transform).
 */
export function releaseDrawerStackDepth(element: HTMLElement): void {
	if (!element.hasAttribute(STILL_DRAWER_STACK_DEPTH_ATTR)) return;
	cancelReleaseCleanup(element);
	element.style.transformOrigin = "top";
	element.style.transitionProperty = "transform, border-radius";
	element.style.transitionDuration = `${VAUL_DRAWER_DEPTH_TRANSITION_S}s`;
	element.style.transitionTimingFunction = VAUL_DRAWER_DEPTH_EASE;
	element.style.borderRadius = VAUL_DRAWER_SHEET_RESTING_BORDER_RADIUS;
	element.style.transform = "scale(1) translate3d(0, 0, 0)";
	scheduleReleaseCleanup(element);
}

/** Immediate teardown — tests / forced reset only. */
export function clearDrawerStackDepth(element: HTMLElement): void {
	cancelReleaseCleanup(element);
	if (!element.hasAttribute(STILL_DRAWER_STACK_DEPTH_ATTR)) return;
	element.removeAttribute(STILL_DRAWER_STACK_DEPTH_ATTR);
	clearDrawerRadiusInlineStyles(element);
	element.style.removeProperty("transform-origin");
	element.style.removeProperty("transition-property");
	element.style.removeProperty("transition-duration");
	element.style.removeProperty("transition-timing-function");
	element.style.removeProperty("transform");
}

function listOpenDetailDrawers(): HTMLElement[] {
	return [
		...document.querySelectorAll<HTMLElement>(OPEN_DRAWER_SELECTOR),
	].filter((drawer) => drawer.getAttribute("data-state") === "open");
}

/** Animate every stacked parent sheet back — used when the top sheet closes. */
export function releaseMarkedDrawerStackDepth(): void {
	for (const drawer of document.querySelectorAll<HTMLElement>(
		`[${STILL_DRAWER_STACK_DEPTH_ATTR}]`,
	)) {
		releaseDrawerStackDepth(drawer);
	}
}

/** Scale every open drawer under the topmost sheet (nested or second root). */
export function syncDrawerStackParentDepth(): void {
	const drawers = listOpenDetailDrawers();
	if (drawers.length < 2) {
		for (const drawer of drawers) {
			releaseDrawerStackDepth(drawer);
		}
		return;
	}

	for (let index = 0; index < drawers.length; index++) {
		const drawer = drawers[index];
		if (!drawer) continue;
		const isTopmost = index === drawers.length - 1;
		if (isTopmost) {
			clearDrawerStackDepth(drawer);
			continue;
		}
		applyDrawerStackDepth(drawer);
	}
}

export function clearAllDrawerStackParentDepth(): void {
	for (const drawer of listOpenDetailDrawers()) {
		clearDrawerStackDepth(drawer);
	}
}
