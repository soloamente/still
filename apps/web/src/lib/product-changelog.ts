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
