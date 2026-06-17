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
	id: "2026-06-17-detail-social-live",
	fullReleaseHref: "/changelog",
	slides: [
		{
			title: "See how a title lands with patrons",
			description:
				"Film and show pages now show Watched, Lists, Favorited, and Watchlist chips under the community score. Tap any chip to browse who logged it, which lists include it, or who saved it.",
		},
		{
			title: "Who else is on this page",
			description:
				"When other patrons are viewing the same film or show, you'll see their avatars in the corner. Tap for the full list — and choose in Settings who can see you when you're browsing a title.",
		},
		{
			title: "Updates without refreshing",
			description:
				"Notifications, ranked list order, and review likes now stay in sync as things happen. Bottom sheets like Cast & crew also scroll properly on your phone again.",
		},
	],
};

/** Returns the active release when it has at least one slide. */
export function getActiveWhatsNewRelease(): WhatsNewRelease | null {
	if (CURRENT_WHATS_NEW_RELEASE.slides.length === 0) return null;
	return CURRENT_WHATS_NEW_RELEASE;
}
