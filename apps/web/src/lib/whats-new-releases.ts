/**
 * What's New release manifest — bump `id` when shipping new dialog copy.
 * Empty `slides` disables the dialog for that deploy.
 * Full history lives in `product-changelog.ts` (`/changelog`).
 */

export type WhatsNewSlide = {
	title: string;
	description: string;
	image?: {
		src: string;
		alt: string;
	};
};

export type WhatsNewRelease = {
	/** Stable release key — persisted per patron when they dismiss the dialog. */
	id: string;
	/** Full changelog / release notes — slide CTA always links here. */
	fullReleaseHref: string;
	slides: WhatsNewSlide[];
};

/** Active release shown to signed-in patrons. Edit slides + bump `id` on each ship. */
export const CURRENT_WHATS_NEW_RELEASE: WhatsNewRelease = {
	id: "2026-06-09-home-reviews-detail",
	fullReleaseHref: "/changelog",
	slides: [
		{
			title: "What's new in Sense",
			description:
				"Cleaner at-home browsing, review stills in the composer, and film detail rails you can drag or step through with chevrons and dots.",
		},
		{
			title: "At home means at home",
			description:
				"The Movies home At home filter no longer mixes in titles that are only playing in cinemas — streaming picks respect digital releases in your catalogue region.",
		},
		{
			title: "Review still before you publish",
			description:
				"Choose a backdrop still while writing your review, not only after it goes live. The composer loads the same still rail as the reader.",
		},
		{
			title: "Drag the detail rails",
			description:
				"On film About, grab the backgrounds or reviews carousel to scroll horizontally. Side arrows, step dots, and taps on peeking slides help you move without only swiping.",
		},
		{
			title: "Sheets & navigation",
			description:
				"Review and quick-log dialogs scroll more smoothly on slower GPUs, with edge fades so lists do not hard-cut. Back from profile or settings returns to your last browse context.",
		},
	],
};

/** Returns the active release when it has at least one slide. */
export function getActiveWhatsNewRelease(): WhatsNewRelease | null {
	if (CURRENT_WHATS_NEW_RELEASE.slides.length === 0) return null;
	return CURRENT_WHATS_NEW_RELEASE;
}
