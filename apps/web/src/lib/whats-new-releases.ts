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
	id: "2026-06-06-detail-editorial-community",
	fullReleaseHref: "/changelog",
	slides: [
		{
			title: "What's new in Sense",
			description:
				"Tag other films and shows inside reviews, pick a hero still for your post, and cleaner detail navigation — plus Community and review likes that stay in sync.",
		},
		{
			title: "Tag titles in your review",
			description:
				"Type @ while writing to search and mention another film or show. Readers tap the title to open it — finished reviews show a clean link, not an @ handle.",
		},
		{
			title: "A still for your review",
			description:
				"Authors can set a still image as the review thumbnail. Pick from the rail below your draft; readers see your frame when they open the post.",
		},
		{
			title: "Reader polish",
			description:
				"Comment replies thread under the parent in the review drawer. Liking a review there updates the count on the film detail carousel right away.",
		},
		{
			title: "Detail artwork pills",
			description:
				"Poster and background rails on film and TV detail use minimal step indicators — tap a pill to jump, or swipe the rail as before.",
		},
	],
};

/** Returns the active release when it has at least one slide. */
export function getActiveWhatsNewRelease(): WhatsNewRelease | null {
	if (CURRENT_WHATS_NEW_RELEASE.slides.length === 0) return null;
	return CURRENT_WHATS_NEW_RELEASE;
}
