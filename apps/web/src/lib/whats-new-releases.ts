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
				"Editorial review and stills rails on film & TV detail, a sharper diary rating slider, and Community loads the first time you open it — no more endless skeleton.",
		},
		{
			title: "Reviews, center stage",
			description:
				"On film and TV About tabs, patron reviews scroll in a wide editorial carousel — quote, score, and byline centered. Hover to open the full review.",
		},
		{
			title: "Background stills",
			description:
				"TMDb backdrops get their own cinematic rail on detail pages. Download a still when you want a wallpaper or reference frame.",
		},
		{
			title: "Community, first try",
			description:
				"Landing on /home Community no longer hangs on the loading skeleton. Switching from Movies or TV first is no longer required.",
		},
		{
			title: "Rating slider refresh",
			description:
				"Quick Log and review composer share a rebuilt 0–10 slider with clearer fill, chevron nudges, and a live score ticker.",
		},
	],
};

/** Returns the active release when it has at least one slide. */
export function getActiveWhatsNewRelease(): WhatsNewRelease | null {
	if (CURRENT_WHATS_NEW_RELEASE.slides.length === 0) return null;
	return CURRENT_WHATS_NEW_RELEASE;
}
