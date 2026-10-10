/**
 * Scroll-spy helper for `MovieDetailSectionNav` (film About + legal pages).
 */

export type SectionNavBounds = {
	id: string;
	/** Document Y of the section top. */
	top: number;
	/** Document Y of the section bottom. */
	bottom: number;
};

export type SectionNavActivation = "header" | "center";

/**
 * Pick the active section id from scroll position.
 * - `header`: last section whose top crossed a line under the sticky chrome (film detail).
 * - `center`: section that contains a near-center probe (legal pages with short sections).
 * Near the document bottom, always prefer the last section (it may never cross the probe).
 */
export function resolveSectionNavActiveId(
	sections: SectionNavBounds[],
	input: {
		scrollY: number;
		viewportHeight: number;
		documentHeight: number;
		activation?: SectionNavActivation;
		/** Used when `activation` is `header` (px from viewport top). */
		headerProbePx?: number;
	},
): string | null {
	if (sections.length === 0) return null;

	const {
		scrollY,
		viewportHeight,
		documentHeight,
		activation = "header",
		headerProbePx = 120,
	} = input;
	const last = sections[sections.length - 1];
	if (!last) return null;

	const maxScroll = Math.max(0, documentHeight - viewportHeight);
	// Last section often never reaches the probe — pin it when we are at (or past) the end.
	if (maxScroll > 0 && scrollY >= maxScroll - 32) {
		return last.id;
	}

	const probeY =
		activation === "center"
			? scrollY + viewportHeight * 0.45
			: scrollY + headerProbePx;

	const first = sections[0];
	if (!first) return null;
	if (probeY < first.top) {
		return first.id;
	}

	for (let index = 0; index < sections.length; index++) {
		const section = sections[index];
		if (!section) continue;
		const nextTop = sections[index + 1]?.top ?? Number.POSITIVE_INFINITY;
		if (section.top <= probeY && probeY < nextTop) {
			return section.id;
		}
	}

	return last.id;
}

/** True when a section still intersects the band we care about after a click-scroll. */
export function sectionIntersectsActivationBand(
	bounds: Pick<SectionNavBounds, "top" | "bottom">,
	input: {
		scrollY: number;
		viewportHeight: number;
		activation: SectionNavActivation;
	},
): boolean {
	const { scrollY, viewportHeight, activation } = input;
	const viewTop = scrollY;
	const viewBottom = scrollY + viewportHeight;

	if (activation === "center") {
		// Keep the clicked target if any part sits in the middle 70% of the viewport.
		const bandTop = scrollY + viewportHeight * 0.15;
		const bandBottom = scrollY + viewportHeight * 0.85;
		return bounds.bottom > bandTop && bounds.top < bandBottom;
	}

	// Header mode: section top near the chrome, or any overlap with the upper viewport.
	return bounds.bottom > viewTop + 40 && bounds.top < viewBottom;
}
