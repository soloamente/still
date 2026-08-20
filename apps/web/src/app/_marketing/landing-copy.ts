export const LANDING_SKIP_HREF = "#main-content";

export const LANDING_METADATA_DESCRIPTION =
	"A social identity for how you watch. Log films and shows, then find people who see film the same way.";

export const LANDING_CHAPTERS = [
	{ id: "taste", label: "Taste" },
	{ id: "diary", label: "Diary" },
	{ id: "community", label: "Community" },
] as const;

export type LandingProductTabId = (typeof LANDING_CHAPTERS)[number]["id"];

export const LANDING_PRODUCT_HEADING = "How Sense works.";

/** Decorative lobby browse pills inside the hero well — Movies is the active face. */
export const LANDING_HERO_BROWSE = [
	{ id: "movies", label: "Movies" },
	{ id: "tv", label: "TV" },
	{ id: "community", label: "Community" },
] as const;

export const LANDING_HERO_COPY = {
	headline: "Your taste is the point.",
	subline:
		"A social identity for how you watch — then a diary, lists, and people who see film the same way.",
} as const;

export const LANDING_CTA = {
	primary: { href: "/sign-up", label: "Create account" },
	secondary: { href: "/sign-in", label: "Sign in" },
} as const;

export const LANDING_CHAPTER_COPY = {
	taste: {
		heading: "Who you are as a watcher",
		body: "Sense reads your diary into a signature — an archetype and the genres that lead. People can see how you watch before they open a list.",
	},
	diary: {
		heading: "Log the night, not just the title",
		body: "Venue, date, and a 0–10 score in one pass. New logs default to at home. Cinema when you were there.",
	},
	community: {
		heading: "People who watch like you",
		body: "Lists, reviews, and ranks — follow patrons and see who logged what.",
	},
} as const;

export const LANDING_CONVERT_COPY = {
	heading: "Start a free account",
	body: "Log tonight. Your taste signature forms as you watch.",
} as const;

export const LANDING_TASTE_SPECIMEN = {
	pill: "Genre-led",
	line: "Drama leads, with Thriller in rotation.",
} as const;

export const LANDING_FOOTER_LINKS = [
	{ href: "/pricing", label: "Pricing" },
	{ href: "/changelog", label: "Changelog" },
	{ href: "/sign-in", label: "Sign in" },
] as const;
