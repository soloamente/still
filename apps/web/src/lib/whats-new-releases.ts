/**
 * What's New release manifest — bump `id` when shipping new dialog copy.
 * Empty `slides` disables the dialog for that deploy.
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
	id: "2026-06-05-experience-polish",
	fullReleaseHref: "/news",
	slides: [
		{
			title: "What's new in Sense",
			description:
				"Settings now live in a sidebar, profile stats are clearer, and you can opt into smooth scroll when your machine can handle it.",
		},
		{
			title: "Smooth scroll, your call",
			description:
				"Experience → Smooth scroll adds gentle wheel inertia. It's off by default so browsing stays snappy on slower devices.",
		},
		{
			title: "Profile polish",
			description:
				"Films and shows split in your header stats, tab chips stay put when catalogues load, and your own profile actions are simpler.",
		},
	],
};

/** Returns the active release when it has at least one slide. */
export function getActiveWhatsNewRelease(): WhatsNewRelease | null {
	if (CURRENT_WHATS_NEW_RELEASE.slides.length === 0) return null;
	return CURRENT_WHATS_NEW_RELEASE;
}
