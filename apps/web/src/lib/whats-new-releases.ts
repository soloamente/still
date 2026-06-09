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
	id: "2026-06-09-share-previews",
	fullReleaseHref: "/changelog",
	slides: [
		{
			title: "What's new in Sense",
			description:
				"Links you share now show a preview image — film stills, taste cards, and list covers with minimal Sense branding.",
		},
		{
			title: "Share a film or show",
			description:
				"Movie and TV detail URLs preview with a backdrop still and a small Sense mark. No cluttered title overlays on the image itself.",
		},
		{
			title: "Profiles & lists",
			description:
				"Public profile links use your taste card. Public lists use the cover art you picked — uploaded or pinned from the catalogue.",
		},
		{
			title: "Compare taste links",
			description:
				"Copying a taste comparison shares a proper preview card, then opens the overlap sheet when someone taps through.",
		},
		{
			title: "Still polishing home & detail",
			description:
				"This release also includes cleaner at-home browsing, review stills in the composer, and drag-friendly carousels on film About.",
		},
	],
};

/** Returns the active release when it has at least one slide. */
export function getActiveWhatsNewRelease(): WhatsNewRelease | null {
	if (CURRENT_WHATS_NEW_RELEASE.slides.length === 0) return null;
	return CURRENT_WHATS_NEW_RELEASE;
}
