/**
 * What's New release manifest — bump `id` when shipping new dialog copy.
 * Empty `slides` disables the dialog for that deploy.
 * Full history lives in `product-changelog.ts` (`/changelog`).
 */

export type WhatsNewSlideMedia =
	| {
			kind: "video";
			src: string;
			/** Accessible name for the muted looping teaser. */
			ariaLabel: string;
	  }
	| {
			kind: "image";
			src: string;
			alt: string;
	  };

export type WhatsNewSlide = {
	title: string;
	/** Primary body — used when `bodyParagraphs` is omitted. */
	description: string;
	/** Optional stacked paragraphs (support-campaign style). Overrides `description` when set. */
	bodyParagraphs?: readonly string[];
	/** Inset card under the body — same pattern as the Discord Pro campaign. */
	detailCard?: {
		title: string;
		body: string;
	};
	/**
	 * Patron credit under the body — links to `/profile/{handle}`.
	 * Use for feature requests / bug reports that shipped in this step.
	 */
	thanks?: {
		handle: string;
		/** Clause after the @handle, e.g. "for suggesting this." */
		for: string;
	};
	/**
	 * Right-column (desktop) / top (mobile) media for this step.
	 * Omit to keep copy-only; prefer per-step media when available.
	 */
	media?: WhatsNewSlideMedia;
};

export type WhatsNewRelease = {
	/** Stable release key — persisted per patron when they dismiss the dialog. */
	id: string;
	/** Full changelog / release notes — slide CTA always links here. */
	fullReleaseHref: string;
	slides: WhatsNewSlide[];
};

/** Shared teaser while feature-specific clips land. */
const WHATS_NEW_DEFAULT_VIDEO: WhatsNewSlideMedia = {
	kind: "video",
	src: "/campaigns/patch-0.3.3-video-cozy.mp4",
	ariaLabel: "Sense product preview",
};

/**
 * Active release — every step uses the support-campaign split layout
 * (copy left / video right). Bump `id` so patrons who only saw Discord re-open.
 */
export const CURRENT_WHATS_NEW_RELEASE: WhatsNewRelease = {
	id: "2026-08-20-translate-fixes-v4",
	fullReleaseHref: "/changelog",
	slides: [
		{
			title: "Translate reviews",
			description:
				"Open a full review and tap Translate near the top of the reader. Sense detects the original language and shows a translation in your preferred language — film and show mentions stay intact.",
			thanks: {
				handle: "jdc",
				for: "for suggesting translate reviews.",
			},
			media: WHATS_NEW_DEFAULT_VIDEO,
		},
		{
			title: "Bug fixes throughout",
			description:
				"This patch focuses on reliability — smoother auth on mobile, sturdier catalogue and detail chrome, and fewer glitches when logging, browsing, and reading reviews.",
			thanks: {
				handle: "jdc",
				for: "for helping surface several of these fixes.",
			},
			media: WHATS_NEW_DEFAULT_VIDEO,
		},
		{
			title: "Small polish everywhere",
			description:
				"Empty posters and cast photos get a softer placeholder, and a handful of lobby and settings details got quieter visual cleanup.",
			media: WHATS_NEW_DEFAULT_VIDEO,
		},
		{
			title: "Discord activity for Pro",
			description:
				"Listening and Playing on profiles needs a dedicated presence server. We're funding it with paid plans so the feature can stay reliable for everyone who unlocks it.",
			bodyParagraphs: [
				"Listening and Playing on profiles needs a dedicated presence server. We're funding it with paid plans so the feature can stay reliable for everyone who unlocks it.",
				"When enough Pro members are in, Discord activity turns on for Attuned and above — not only early supporters. Live progress is on Pricing.",
			],
			detailCard: {
				title: "What you unlock",
				body: "Connect Discord once, then Listening, Playing, and Streaming can show on your profile and account menu. Privacy follows your existing presence settings. Production stays off until the server is funded.",
			},
			media: WHATS_NEW_DEFAULT_VIDEO,
		},
	],
};

/** Returns the active release when it has at least one slide. */
export function getActiveWhatsNewRelease(): WhatsNewRelease | null {
	if (CURRENT_WHATS_NEW_RELEASE.slides.length === 0) return null;
	return CURRENT_WHATS_NEW_RELEASE;
}
