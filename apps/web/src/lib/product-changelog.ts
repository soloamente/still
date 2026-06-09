/**
 * In-repo product changelog — patron-facing release notes for `/changelog` and
 * the What's New dialog "See full release" link.
 */

export type ProductChangelogItem = {
	/** Short headline for the bullet (optional). */
	title?: string;
	/** One or two sentences — plain language, no internal codenames. */
	body: string;
};

export type ProductChangelogRelease = {
	/** Stable key — matches What's New `id` when shipped together. */
	id: string;
	/** Patron-facing semver — shown in What's New pill and `/changelog` header. */
	versionLabel: string;
	/** Display date for the release heading. */
	dateLabel: string;
	/** Release title shown on `/changelog`. */
	headline: string;
	/** Optional one-line summary under the headline. */
	summary?: string;
	items: ProductChangelogItem[];
};

/** Newest first — append when shipping; keep prior releases for the full log. */
export const PRODUCT_CHANGELOG_RELEASES: ProductChangelogRelease[] = [
	{
		id: "2026-06-09-home-reviews-detail",
		versionLabel: "0.2.3",
		dateLabel: "June 9, 2026",
		headline: "Home filters, review stills & detail rails",
		summary:
			"At-home browsing stays theatrical-free, you can pick a review still while writing, and film detail carousels are easier to scroll.",
		items: [
			{
				title: "At home vs in cinemas",
				body: "On the Movies home catalogue, the At home filter no longer surfaces titles that are only in cinemas — streaming lists stick to digital releases in your region.",
			},
			{
				title: "Pick a still when you publish",
				body: "The review composer lets you choose a TMDb backdrop still before you publish — same rail as the reader, so your hero image is set on day one.",
			},
			{
				title: "Community list likes",
				body: "Public list tiles on Community show likes once in a top-right pill on the poster — not duplicated in the bottom meta row.",
			},
			{
				title: "Smoother review & log sheets",
				body: "Review and quick-log dialogs scroll more smoothly on devices without GPU acceleration, with soft fades at the top and bottom so content does not clip harshly.",
			},
			{
				title: "Drag & step through stills and reviews",
				body: "On film detail, grab the backgrounds or reviews rail to drag-scroll horizontally. Use the side chevrons, step dots, or tap a peeking slide to jump — reviews get the same controls as stills.",
			},
			{
				title: "Profile & settings navigation",
				body: "Back from a profile or settings page returns you to where you were browsing instead of looping between Profile and Settings. Filmography footers name the patron whose catalogue you finished scrolling.",
			},
		],
	},
	{
		id: "2026-06-08-search-detail-polish",
		versionLabel: "0.2.2",
		dateLabel: "June 8, 2026",
		headline: "Catalogue search & film detail polish",
		summary:
			"Studio searches load the full catalogue, film detail awards and cast look sharper, and a few reliability fixes for streaks and streaming.",
		items: [
			{
				title: "Studio search loads every title",
				body: "Searching a studio on the home catalogue (for example A24) now keeps loading that studio's full film list as you scroll — not just the first page.",
			},
			{
				title: "Search dialog chips",
				body: "Films / TV and browse category chips in ⌘K use the same sliding pill animation as home filters. Browse preview shows Movies, TV Shows, and People — Community was removed from the empty-state rail.",
			},
			{
				title: "Monochrome cast & crew (optional)",
				body: "Settings → Experience → Monochrome cast & crew keeps headshots grayscale until you hover on film and TV detail. Off by default — previews show full color unless you opt in.",
			},
			{
				title: "Awards & festivals layout",
				body: "Partial second rows of festival logos center correctly. Generic award and premiere columns use properly sized filled icons that match the other festival marks.",
			},
			{
				title: "Streaming tab on Cozy",
				body: "The selected streaming provider is visible again on the Cozy theme — the highlight pill uses the canvas surface so it does not vanish against the card background.",
			},
			{
				title: "Diary streak stays accurate",
				body: "Your profile streak stat now stays in sync with the activity heatmap when backdated diary logs or imports would have reset the count incorrectly.",
			},
		],
	},
	{
		id: "2026-06-07-reviews-tagging-reader",
		versionLabel: "0.2.1",
		dateLabel: "June 7, 2026",
		headline: "Review tagging & reader polish",
		summary:
			"Link other films and shows inside reviews, pick a hero still, and smoother Community and detail navigation.",
		items: [
			{
				title: "Tag films & shows in reviews",
				body: "Type @ while writing to search and link another title in your review. Readers see the title as a tap-through link — no @ symbol in the finished post.",
			},
			{
				title: "Hero still on your review",
				body: "When you own the review, pick a TMDb backdrop still for the reader hero. Visitors see your choice; until you pick one, you get a simple placeholder with the still rail below.",
			},
			{
				title: "Threaded replies in the review reader",
				body: "Comment replies indent under the parent with a clear reply line and handle — easier to follow conversations on long reviews.",
			},
			{
				title: "Community Activity on first open",
				body: "Switching to Community → Activity no longer flashes an empty state while the feed is still loading.",
			},
			{
				title: "Review likes stay in sync",
				body: "Liking a review in the reader updates the count on the film detail reviews carousel right away — no refresh needed.",
			},
			{
				title: "Artwork step indicators",
				body: "Poster and background rails on film and TV detail use minimal pill steppers. Tap a pill to jump to that slide; swipe the rail as before.",
			},
		],
	},
	{
		id: "2026-06-06-detail-editorial-community",
		versionLabel: "0.2.0",
		dateLabel: "June 6, 2026",
		headline: "Editorial detail pages & Community fixes",
		summary:
			"Film and TV About tabs get cinematic review and stills rails; Community opens reliably on first visit; diary rating feels sharper.",
		items: [
			{
				title: "Reviews carousel on film & TV detail",
				body: "Patron reviews on the About tab scroll horizontally in a centered editorial rail — large quote, score, and byline. Hover a review to read the full post in the review reader.",
			},
			{
				title: "Backgrounds stills",
				body: "TMDb backdrop stills appear in a widescreen rail on film and TV detail (Movies and Shows). Save a still with the download control when you want a copy for wallpapers or references.",
			},
			{
				title: "Community loads on first visit",
				body: "Opening /home on Community no longer sticks on the loading skeleton. Your last browse tab restores correctly without needing a detour through Movies or TV first.",
			},
			{
				title: "Sharper diary rating slider",
				body: "Quick Log and the review composer use a rebuilt 0–10 rating control with clearer track fill, chevron nudges, and a live score readout. On film detail pages the accent can follow the poster palette.",
			},
			{
				title: "Hero artwork",
				body: "Detail hero backdrops pull a richer still set from TMDb, including language-neutral frames where your catalogue locale would otherwise hide them.",
			},
		],
	},
	{
		id: "2026-06-05-profile-media-upload",
		versionLabel: "0.1.0",
		dateLabel: "June 5, 2026",
		headline: "Profile uploads & settings polish",
		summary:
			"Profile photos work in production again, settings live in a sidebar, and smooth scroll is opt-in.",
		items: [
			{
				title: "Profile photos work again",
				body: "Uploading your profile picture or banner failed in production — that's fixed. Pick a new image in Settings → Profile and save; your portrait and banner should update right away.",
			},
			{
				title: "Smooth scroll, your call",
				body: "Experience → Smooth scroll adds gentle wheel inertia. It's off by default so browsing stays snappy on slower devices.",
			},
			{
				title: "Profile polish",
				body: "Films and shows split in your header stats, tab chips stay put when catalogues load, and your own profile actions are simpler.",
			},
			{
				title: "Settings sidebar",
				body: "Settings now uses a sidebar layout so account, profile, catalogue, and experience sections are easier to scan.",
			},
		],
	},
];

/** Lookup a single release by id (What's New dialog, deep links). */
export function getProductChangelogRelease(
	id: string,
): ProductChangelogRelease | null {
	return (
		PRODUCT_CHANGELOG_RELEASES.find((release) => release.id === id) ?? null
	);
}

function formatReleaseDateFromId(releaseId: string): string | null {
	const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(releaseId);
	if (!match) return null;

	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	const date = new Date(year, month - 1, day);
	return date.toLocaleDateString("en-US", {
		month: "long",
		day: "numeric",
		year: "numeric",
	});
}

/** Normalises stored semver — authors pass `0.2.0`; pill shows `v0.2.0`. */
export function formatReleaseVersionLabel(versionLabel: string): string {
	const trimmed = versionLabel.trim();
	if (trimmed.length === 0) return trimmed;
	return trimmed.startsWith("v") ? trimmed : `v${trimmed}`;
}

/** Pill copy above What's New slide titles — `v0.2.0 · June 6, 2026`. */
export function whatsNewReleasePillLabel(releaseId: string): string {
	const entry = getProductChangelogRelease(releaseId);
	const dateLabel =
		entry?.dateLabel ?? formatReleaseDateFromId(releaseId) ?? releaseId;
	const versionLabel = entry?.versionLabel
		? formatReleaseVersionLabel(entry.versionLabel)
		: null;

	if (versionLabel) return `${versionLabel} · ${dateLabel}`;
	return dateLabel;
}

/** `/changelog` release kicker — same version + date pairing as the dialog pill. */
export function formatChangelogReleaseKicker(
	release: ProductChangelogRelease,
): string {
	return whatsNewReleasePillLabel(release.id);
}
