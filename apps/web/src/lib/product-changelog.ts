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
		id: "2026-07-02-patron-feedback",
		versionLabel: "0.3.1",
		dateLabel: "July 2, 2026",
		headline: "Send feedback to Sense",
		summary:
			"Report bugs, share ideas, and follow replies from the team — right from your account menu.",
		items: [
			{
				title: "Send feedback",
				body: "Open your account menu and choose Send feedback to file a bug, idea, or general note. We capture the page you were on so we can reproduce issues faster.",
			},
			{
				title: "My feedback",
				body: "See every submission and thread in My feedback. When the team replies, you get an inbox notification and can jump straight back to the conversation.",
			},
		],
	},
	{
		id: "2026-06-17-detail-social-live",
		versionLabel: "0.3.0",
		dateLabel: "June 17, 2026",
		headline: "Film detail social & live updates",
		summary:
			"See how patrons engage with a title, spot who else is on the same page, and get fresher notifications and list order — plus smoother scrolling in mobile sheets.",
		items: [
			{
				title: "Watched · Lists · Favorited · Watchlist",
				body: "Film and show pages show four chips under the community score — how many patrons logged, listed, favorited, or saved the title. Tap a chip to browse names, open lists, or jump to a profile.",
			},
			{
				title: "Who's viewing now",
				body: "When other patrons are on the same film or show page, their avatars appear in the corner with a count. Tap to see the full list. A green dot means they're active; orange means they stepped away.",
			},
			{
				title: "Choose who sees you viewing",
				body: "Settings → Profile → Presence visibility lets you stay visible to friends only (default) or show up to anyone with a public profile when you're on a title page.",
			},
			{
				title: "Notifications that stay current",
				body: "The bell menu fills in new activity as it arrives — follows, likes, list updates, and more — without refreshing the page.",
			},
			{
				title: "Ranked lists update together",
				body: "When you drag to reorder a ranked list, anyone else on that list page sees the new order right away.",
			},
			{
				title: "Review reactions in sync",
				body: "Liking or disliking a review in the reader updates the count on the film detail carousel at the same time.",
			},
			{
				title: "Sheets scroll on your phone",
				body: "Cast & crew, filmography, engagement lists, and other bottom sheets scroll normally on mobile again — no more stuck drawers.",
			},
		],
	},
	{
		id: "2026-06-15-list-discovery-polish",
		versionLabel: "0.2.9",
		dateLabel: "June 15, 2026",
		headline: "List discovery polish",
		summary:
			"Community Lists names how many public lists are trending, list detail titles read clearer at hero scale, and share copy confirms the list you copied.",
		items: [
			{
				title: "Popular lists count",
				body: "On Community → Lists, a header shows how many public lists match the active period — ordered by likes, same as the poster wall.",
			},
			{
				title: "List detail typography",
				body: "List titles on detail pages use balanced, semibold hero type so long names wrap cleanly without feeling cramped.",
			},
			{
				title: "Share toast",
				body: "Copying a list link from detail or your lists lobby shows Copied link · {title} so you know what went to the clipboard.",
			},
			{
				title: "Discovery labels",
				body: "Search empty-state people browse is labeled Patrons on Sense — discovery copy names the source instead of generic “suggested for you” wording.",
			},
		],
	},
	{
		id: "2026-06-14-favorite-quotes",
		versionLabel: "0.2.8",
		dateLabel: "June 14, 2026",
		headline: "Favorite quotes",
		summary:
			"Browse memorable lines on film and TV detail, upvote community favorites, save lines to your collection, and suggest new quotes for staff review.",
		items: [
			{
				title: "Quotes tab on detail",
				body: "Film and show pages have a dedicated Quotes tab — browse lines for the title, upvote favorites, and save lines to your collection. TV quotes are scoped by season and episode.",
			},
			{
				title: "Your saved quotes",
				body: "Saved lines live at /quotes — filter by films or shows, set visibility per save, and open the title’s Quotes tab from any row.",
			},
			{
				title: "Suggest a line",
				body: "Missing a quote? Submit it from the Quotes tab. Staff review submissions before they appear in the catalog — you’ll get a notification when yours is approved or declined.",
			},
			{
				title: "Profile strip",
				body: "Your profile shows up to three recent saves under your showcase. Visitors see public saves only; you can jump to the full collection from View all.",
			},
			{
				title: "Detail navigation",
				body: "The detail top bar is now About · Streaming · Community · Quotes — related catalogue stays on About; reviews and lists stay under Community.",
			},
		],
	},
	{
		id: "2026-06-11-taste-mobile",
		versionLabel: "0.2.7",
		dateLabel: "June 11, 2026",
		headline: "Tailored For you picks & mobile polish",
		summary:
			"The Movies For you rail reflects what you actually love and learns from dismissals — plus film detail, home, and profile are easier to use on your phone.",
		items: [
			{
				title: "Rated taste, not just volume",
				body: "For you weighs films you scored highly — not only genres you log often — so the rail tracks your real favorites instead of your most-watched categories.",
			},
			{
				title: "More variety in the row",
				body: "Suggestions spread across genres and eras instead of clustering on one kind of film, with fewer obvious blockbusters dominating the rail.",
			},
			{
				title: "Niche when your diary is niche",
				body: "If you mostly log deep cuts and festival titles, For you reaches further into the catalogue instead of defaulting to the same popular picks.",
			},
			{
				title: "From patrons with similar taste",
				body: "Highly rated titles from people you follow — and from patrons with overlapping diaries — can appear in your For you row when they match what you have not logged yet.",
			},
			{
				title: "Not interested sticks",
				body: "Dismissing a For you poster forever hides that title and downranks similar suggestions — same genre cluster, era, or language — so the rail steers away from picks you rejected.",
			},
			{
				title: "Film detail header on mobile",
				body: "Back and Share in the sticky header show as icon-only buttons on narrow screens — more room for About and Streaming tabs without crowding the bar.",
			},
			{
				title: "Reviews & stills that land centered",
				body: "Patron review quotes and background stills snap to the middle of the screen on load and after swipes, with lighter edge fades so the active slide stays fully readable.",
			},
			{
				title: "Cast & Crew on small screens",
				body: "The arc spotlight shows five larger portraits instead of eleven tiny ones, with spacing tuned so edge cards do not overlap between the cast and crew rows.",
			},
			{
				title: "Home filters on one row",
				body: "Sort chips scroll horizontally on mobile while venue, TV run, and Community period controls tuck into a compact menu — no more wrapped filter rows.",
			},
			{
				title: "Profile & navigation",
				body: "Long display names truncate in the profile sticky header, lobby chips center on narrow widths, and the bottom tab bar uses a tighter icon-only pill.",
			},
		],
	},
	{
		id: "2026-06-10-letterboxd-streak",
		versionLabel: "0.2.5",
		dateLabel: "June 10, 2026",
		headline: "Letterboxd import & diary streak",
		summary:
			"Letterboxd imports match more of your diary, and your profile streak stays aligned with the activity heatmap after a bulk import.",
		items: [
			{
				title: "Fewer unmatched Letterboxd titles",
				body: "Diary and watched CSV rows now resolve more reliably to TMDb — including when Letterboxd’s release year differs from theatrical dates (common on festival and streaming releases).",
			},
			{
				title: "Watched.csv gap-fill",
				body: "Films marked watched on Letterboxd without a diary entry can fill gaps in your Sense diary after the main import — no duplicate logs for titles you already logged.",
			},
			{
				title: "Streak matches your heatmap",
				body: "After importing Letterboxd or Anilist, your streak counter rebuilds from diary history instead of staying stuck on pre-import manual logs. Opening your profile also reconciles streak with the same dates the Diary rhythm grid uses.",
			},
		],
	},
	{
		id: "2026-06-09-share-previews",
		versionLabel: "0.2.4",
		dateLabel: "June 9, 2026",
		headline: "Link share previews",
		summary:
			"Pasting Sense links into messages and social apps now shows a proper preview image — minimal film art, taste cards, and list covers.",
		items: [
			{
				title: "Home & landing",
				body: "Sharing the site or your home catalogue shows a popular film still with the Sense wordmark — or a branded fallback when artwork is unavailable.",
			},
			{
				title: "Film & TV detail",
				body: "Movie and show links preview with a backdrop still and a small Sense mark in the corner — title and description stay in the link text, not painted on the image.",
			},
			{
				title: "Profiles & lists",
				body: "Public profile links use your taste card preview. Public lists use the list cover (custom upload or pinned title) with the same minimal Sense mark.",
			},
			{
				title: "Taste comparison links",
				body: "When you copy a comparison from Compare taste, the link opens a shareable page with the compatibility card preview — then takes you to the overlap sheet on the profile.",
			},
			{
				title: "Everywhere else",
				body: "Diary, settings, and other routes inherit a simple Sense-branded default so links never ship without a preview image.",
			},
		],
	},
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
