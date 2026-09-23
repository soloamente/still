/** Damped swing — each pass smaller than the last, like a struck bell. */
export const BELL_RING_KEYFRAMES: Keyframe[] = [
	{ transform: "rotate(0deg)" },
	{ transform: "rotate(-17deg)", offset: 0.11 },
	{ transform: "rotate(14deg)", offset: 0.27 },
	{ transform: "rotate(-9deg)", offset: 0.44 },
	{ transform: "rotate(6deg)", offset: 0.61 },
	{ transform: "rotate(-3deg)", offset: 0.78 },
	{ transform: "rotate(0deg)" },
];

export const BELL_RING_OPTIONS: KeyframeAnimationOptions = {
	duration: 820,
	easing: "ease-out",
};

/** Crown pivot — hang the glyph from its top when swinging. */
export const BELL_RING_ORIGIN_CLASS = "origin-[50%_16%]";

/** Fire the WAAPI swing on a bell icon wrapper. No-ops when Element.animate is missing. */
export function ringBellElement(el: Element | null | undefined): void {
	if (!el || typeof el.animate !== "function") return;
	el.animate(BELL_RING_KEYFRAMES, BELL_RING_OPTIONS);
}
