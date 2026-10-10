import { APP_NAME } from "@/lib/app-brand";

/** Public `/companion` intro — Mobbin MCP–shaped brochure, Sense voice. */

export const COMPANION_PAGE_META = {
	title: "Sense Companion",
	description: `${APP_NAME} Companion shows what you’re watching on Discord and Sense, and can log when you finish.`,
} as const;

/** Marketing specimen — fixed TMDb poster so the hero isn’t an empty card. */
export const COMPANION_SPECIMEN = {
	title: "Parasite",
	service: "Netflix",
	/** TMDb `/movie/496243` poster path. */
	posterPath: "/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg",
} as const;

export const COMPANION_HERO = {
	/**
	 * Lead before inline Discord / Sense brand chips (Mobbin homepage pattern).
	 * Trailing words render in `CompanionPage` with rounded-square logos.
	 */
	headlineLead: "Watch on streaming. Show up on",
	subline: `Companion is a browser extension that shows what you're watching in your Discord status and logs every title to your Sense diary, automatically.`,
	/** Used when a store listing URL is configured. */
	storeCtaLabel: "Get Companion",
	/** Honest label until Chrome/Edge listings ship. */
	setupCtaLabel: "See setup",
	secondaryCta: { href: "/sign-up", label: "Create account" },
} as const;

export const COMPANION_PROBLEM = {
	lines: [
		"You finish a film on Netflix.",
		"Discord stays quiet.",
		"Your Sense diary stays empty.",
	],
	fix: `${APP_NAME} Companion fixes that.`,
} as const;

/** Single mid-page sequence (replaces duplicate demo + use-case sections). */
export const COMPANION_BEATS = [
	{
		id: "discord",
		label: "Discord",
		heading: "Discord Watching",
		body: "Keep Discord desktop open on this PC. Friends see the title — and can open your Sense profile when you’ve paired.",
	},
	{
		id: "sense",
		label: "Sense",
		heading: "Live on your profile",
		body: "Pair once. Watching can appear on your profile and account menu, with the same privacy controls as your other presence.",
	},
	{
		id: "autolog",
		label: "Diary",
		heading: "Log when you finish",
		body: "Near the end of a film or episode, Companion can add one at-home diary row. Rate from the notice, or dismiss.",
	},
] as const;

export type CompanionBeatId = (typeof COMPANION_BEATS)[number]["id"];

/**
 * Supported services — TMDb watch-provider PNGs in `public/companion/services/`
 * (brand-colored squares, same marks as Sense streaming rails — not Discord black plates).
 */
export const COMPANION_SERVICES = [
	{
		id: "netflix",
		label: "Netflix",
		logoSrc: "/companion/services/netflix.png",
		/** TMDb provider 8 */
		tmdbLogoPath: "/rK1KljqmbvO9HQa1PBFLILWah72.png",
	},
	{
		id: "disney",
		label: "Disney+",
		logoSrc: "/companion/services/disney.png",
		tmdbLogoPath: "/5eZ872CghnHFLB1j8grszbrx0dx.png",
	},
	{
		id: "prime",
		label: "Prime Video",
		logoSrc: "/companion/services/prime.png",
		tmdbLogoPath: "/gMZdpavHmxFNnLpMHwVxfqeux2g.png",
	},
	{
		id: "apple",
		label: "Apple TV+",
		logoSrc: "/companion/services/apple.png",
		/** TMDb “Apple TV” (350) — closest flatrate mark. */
		tmdbLogoPath: "/9icYBfYFcwgCbky5VdGUIKJ4C5i.png",
	},
	{
		id: "max",
		label: "Max",
		logoSrc: "/companion/services/max.png",
		/** TMDb “HBO Max” (1899). */
		tmdbLogoPath: "/skypuy7SXuugIQeYg0IglmzoKaS.png",
	},
	{
		id: "hulu",
		label: "Hulu",
		logoSrc: "/companion/services/hulu.png",
		tmdbLogoPath: "/fibZ29NMQS46v7vXZ1Y3uXL7Q39.png",
	},
] as const;

export const COMPANION_SETUP = {
	heading: "Set up in under a minute",
	subline:
		"Chrome and Edge listings are coming soon. When they’re live, install Companion, then pair Sense.",
	storeSoonLabel: "Chrome and Edge listings coming soon",
	steps: [
		{
			id: "install",
			title: "Install Companion",
			body: "Add it from the Chrome Web Store or Edge Add-ons. You only need the extension — no separate helper app.",
		},
		{
			id: "discord",
			title: "Open Discord desktop",
			body: "Needed for Discord Watching on this PC. Sense pairing still works if Discord is closed.",
		},
		{
			id: "pair",
			title: "Pair with Sense",
			body: "In Settings → Profile → Browser extension, copy the code into the Companion popup.",
		},
	],
} as const;

export type CompanionFaqItem = {
	id: string;
	question: string;
	answer: string;
};

export const COMPANION_FAQ_ITEMS: readonly CompanionFaqItem[] = [
	{
		id: "what",
		question: "What is Sense Companion?",
		answer: `${APP_NAME} Companion is a Chrome and Edge extension. It detects what you’re watching on supported streaming sites, can show it on Discord and your Sense profile, and can log a title when you finish.`,
	},
	{
		id: "discord-required",
		question: "Do I need Discord?",
		answer:
			"Only for Discord Watching. Pairing with Sense and auto-log work without it. For Watching status, Discord desktop must be open on the same computer.",
	},
	{
		id: "sites",
		question: "Which sites does it support?",
		answer:
			"Netflix, Disney+, Prime Video, Apple TV+, and Max. More may follow. Generic video pages are limited.",
	},
	{
		id: "privacy",
		question: "Who can see what I’m watching?",
		answer:
			"Sense presence follows your profile privacy settings. Discord shows activity to people who can see your Discord status. Disconnect the extension or turn off sharing in Settings anytime.",
	},
	{
		id: "autolog",
		question: "Does it rate titles for me?",
		answer:
			"No. Auto-log adds an at-home diary row without a score. A notice lets you rate 0–10 or dismiss. The same title isn’t re-logged for twelve hours.",
	},
	{
		id: "cost",
		question: "Is Companion free?",
		answer:
			"The extension is free to install. Sense account features follow your plan. Discord activity on Sense may need an eligible plan when that gate is on.",
	},
] as const;

export const COMPANION_CLOSING = {
	heading: "Stop typing what you just watched",
	body: "Install Companion, pair Sense, and let streaming nights show up where they belong.",
	secondaryCta: { href: "/sign-in", label: "Sign in" },
} as const;
