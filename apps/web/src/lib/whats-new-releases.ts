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
	id: "2026-06-11-taste-mobile",
	fullReleaseHref: "/changelog",
	slides: [
		{
			title: "What's new in Sense",
			description:
				"For you suggestions follow your ratings more closely, and film detail, home, and profile feel sharper on your phone.",
		},
		{
			title: "Picks tuned to your taste",
			description:
				"The Movies For you rail weighs what you scored highly, spreads across genres and eras, and learns when you tap Not interested.",
		},
		{
			title: "From patrons like you",
			description:
				"Titles highly rated by people you follow — or patrons with overlapping taste — can surface when you have not logged them yet.",
		},
		{
			title: "Film detail on mobile",
			description:
				"Back and Share stay icon-only in the header, reviews and stills load centered with lighter edge fades, and Cast & Crew shows fewer, larger portraits.",
		},
		{
			title: "Browse & profile polish",
			description:
				"Home sort and venue filters fit on one row, the bottom tab bar is compact, and long profile names truncate cleanly in the sticky header.",
		},
	],
};

/** Returns the active release when it has at least one slide. */
export function getActiveWhatsNewRelease(): WhatsNewRelease | null {
	if (CURRENT_WHATS_NEW_RELEASE.slides.length === 0) return null;
	return CURRENT_WHATS_NEW_RELEASE;
}
