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
	id: "2026-06-10-letterboxd-streak",
	fullReleaseHref: "/changelog",
	slides: [
		{
			title: "What's new in Sense",
			description:
				"Letterboxd imports match more titles, and your diary streak stays in sync with the activity heatmap after a bulk import.",
		},
		{
			title: "Better Letterboxd matching",
			description:
				"Diary and watched CSV rows resolve more reliably — even when Letterboxd’s year differs from TMDb’s theatrical release date.",
		},
		{
			title: "Watched-only titles",
			description:
				"Upload watched.csv from your Letterboxd export to backfill films you marked watched without a diary line — skipped when you already have a log.",
		},
		{
			title: "Streak after import",
			description:
				"Your profile streak rebuilds from imported diary dates instead of staying on an old manual count. Refresh your profile to pick up the fix.",
		},
	],
};

/** Returns the active release when it has at least one slide. */
export function getActiveWhatsNewRelease(): WhatsNewRelease | null {
	if (CURRENT_WHATS_NEW_RELEASE.slides.length === 0) return null;
	return CURRENT_WHATS_NEW_RELEASE;
}
