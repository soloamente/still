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
	id: "2026-07-02-patron-feedback",
	fullReleaseHref: "/changelog",
	slides: [
		{
			title: "Send feedback from your account menu",
			description:
				"Report a bug, share an idea, or tell us what could be better — without leaving the page you're on. Open the account menu and tap Send feedback.",
		},
		{
			title: "Follow replies in My feedback",
			description:
				"Every submission lives in My feedback. When the Sense team responds, you'll get a notification and can read the full thread in one place.",
		},
	],
};

/** Returns the active release when it has at least one slide. */
export function getActiveWhatsNewRelease(): WhatsNewRelease | null {
	if (CURRENT_WHATS_NEW_RELEASE.slides.length === 0) return null;
	return CURRENT_WHATS_NEW_RELEASE;
}
