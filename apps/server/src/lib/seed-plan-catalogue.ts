import { db, planFeature, planFeatureTier, planTier } from "@still/db";
import { makeId } from "./cuid";

const TIERS = [
	{
		id: "still",
		name: "Still",
		sortOrder: 0,
		priceYearly: null,
		priceMonthly: null,
		tagline: "Quiet foundation — always free",
	},
	{
		id: "attuned",
		name: "Attuned",
		sortOrder: 1,
		priceYearly: 2400,
		priceMonthly: 300,
		tagline: "Know yourself as a watcher",
	},
	{
		id: "immersed",
		name: "Immersed",
		sortOrder: 2,
		priceYearly: 4800,
		priceMonthly: 600,
		tagline: "Expression, social depth, engagement layer",
	},
	{
		id: "devoted",
		name: "Devoted",
		sortOrder: 3,
		priceYearly: 10000,
		priceMonthly: 1200,
		tagline: "You helped build this",
	},
] as const;

type FeatureSeed = {
	name: string;
	description: string;
	buildStatus: "exists" | "planned";
	tiers: Array<"still" | "attuned" | "immersed" | "devoted">;
};

const FEATURES: FeatureSeed[] = [
	// ── Still ──
	{
		name: "Log movies, TV & anime",
		description:
			"Mark anything as watched. Movies pull from TMDB. TV tracks episode by episode. Anime works the same way. You can log something multiple times (rewatches).",
		buildStatus: "exists",
		tiers: ["still", "attuned", "immersed", "devoted"],
	},
	{
		name: "Watchlist & ratings",
		description:
			"Save things you want to watch. Rate anything on a 0–10 scale. Ratings are stored to the tenth (e.g. 8.5). You can also mark things you own.",
		buildStatus: "exists",
		tiers: ["still", "attuned", "immersed", "devoted"],
	},
	{
		name: "Reviews & lists",
		description:
			"Write reviews tied to a log entry. Create public lists — curated collections of any movies/TV/anime. Lists have titles, descriptions, and covers.",
		buildStatus: "exists",
		tiers: ["still", "attuned", "immersed", "devoted"],
	},
	{
		name: "Follow & social feed",
		description:
			"Follow other users. Your feed shows what people you follow are watching, rating, and reviewing. Feed supports real-time presence and shows rating divergence.",
		buildStatus: "exists",
		tiers: ["still", "attuned", "immersed", "devoted"],
	},
	{
		name: "Import from Letterboxd, AniList, MAL",
		description:
			"Bring your entire watch history over. Letterboxd via CSV. AniList and MyAnimeList via API. Imports match titles to TMDB, map episodes, and preserve ratings.",
		buildStatus: "exists",
		tiers: ["still", "attuned", "immersed", "devoted"],
	},
	{
		name: "TV episode progress tracking",
		description:
			"Track progress at the episode level. The server syncs new episodes as they air. Mark episodes watched in bulk or one by one.",
		buildStatus: "exists",
		tiers: ["still", "attuned", "immersed", "devoted"],
	},
	{
		name: "Basic streaks & starter badges",
		description:
			"A running count of consecutive days you've logged something. Volume milestone badges — watched 10, 100, 1000 things. These appear in your Achievements section.",
		buildStatus: "exists",
		tiers: ["still", "attuned", "immersed", "devoted"],
	},
	{
		name: "Year in review (annual snapshot)",
		description:
			"An annual summary generated once per year: how many things you watched, top genres, highest-rated, most active month. Free users get this once a year.",
		buildStatus: "planned",
		tiers: ["still", "attuned", "immersed", "devoted"],
	},
	// ── Attuned ──
	{
		name: "Full stats",
		description:
			"All-time & per-year breakdowns: genres, media types, average rating, most active periods. Attuned users get on-demand access across any time range — free tier gets the annual snapshot only.",
		buildStatus: "exists",
		tiers: ["attuned", "immersed", "devoted"],
	},
	{
		name: "Taste signature",
		description:
			"Rule-based archetype auto-generated from your diary: Contrarian, Curator, Genre Purist, Dual Affinity, Generous, Selective, Genre-Led, Eclectic. A one-line headline shows on your profile and updates as you log more.",
		buildStatus: "exists",
		tiers: ["attuned", "immersed", "devoted"],
	},
	{
		name: "Activity signature",
		description:
			"GitHub-style 52-week heatmap on your profile. Darker squares = more activity that day. Shows whether you're a weekend binger, daily watcher, or seasonal burst viewer.",
		buildStatus: "exists",
		tiers: ["attuned", "immersed", "devoted"],
	},
	{
		name: "Streaming filters",
		description:
			"Filter the catalogue by what's actually available on your streaming services right now in your country. Start from what you can already watch.",
		buildStatus: "exists",
		tiers: ["attuned", "immersed", "devoted"],
	},
	{
		name: "Watchlist alerts",
		description:
			"Get notified when something on your watchlist becomes available on a streaming service in your region. Works by periodically diffing TMDB streaming availability against your preferences.",
		buildStatus: "exists",
		tiers: ["attuned", "immersed", "devoted"],
	},
	{
		name: "Theater listings",
		description:
			"Shows what's currently playing in cinemas near you. Pulls from TMDB theatrical release data filtered by your region.",
		buildStatus: "planned",
		tiers: ["attuned", "immersed", "devoted"],
	},
	{
		name: "Advanced feed filters",
		description:
			"Filter your social feed by type — only reviews, only logs, only ratings, only a specific person. Free users see everything chronologically.",
		buildStatus: "planned",
		tiers: ["attuned", "immersed", "devoted"],
	},
	// ── Immersed ──
	{
		name: "All themes unlocked",
		description:
			"Ember and Midnight themes unlocked (currently gated as 'pro' in app-themes.ts — gate renamed to 'immersed'). All future themes included automatically.",
		buildStatus: "exists",
		tiers: ["immersed", "devoted"],
	},
	{
		name: "Profile customization",
		description:
			"Choose an accent color (Desert, Copper, Rose, Slate) and banner frame (None, Cinema, Editorial). These change how your profile looks to visitors.",
		buildStatus: "exists",
		tiers: ["immersed", "devoted"],
	},
	{
		name: "Pinned reviews & custom list covers",
		description:
			"Pin your best reviews to the top of your profile. Custom list covers let you pick which poster represents a list instead of the auto-generated one.",
		buildStatus: "exists",
		tiers: ["immersed", "devoted"],
	},
	{
		name: "Private lists & collaboration",
		description:
			"Make a list private so only you and invited collaborators can see it. Invite specific users to co-curate before making it public.",
		buildStatus: "exists",
		tiers: ["immersed", "devoted"],
	},
	{
		name: "Taste overlap scores",
		description:
			"See how much your taste overlaps with anyone you follow. Compares shared watches, finds titles you both rated, and shows where you agree vs. diverge.",
		buildStatus: "exists",
		tiers: ["immersed", "devoted"],
	},
	{
		name: "Rivalry mode",
		description:
			"Send a head-to-head taste challenge to someone — compatibility score, biggest disagreements, shared obsessions. Shareable card for social media. Builds on the existing taste overlap engine.",
		buildStatus: "planned",
		tiers: ["immersed", "devoted"],
	},
	{
		name: "Full badge collection & prestige unlocks",
		description:
			"Beyond volume milestones: prestige badges earned by completing director filmographies, developing a contrarian taste signature, writing high-engagement reviews. Tiers: Bronze → Silver → Gold → Platinum → Legendary.",
		buildStatus: "exists",
		tiers: ["immersed", "devoted"],
	},
	{
		name: "Completionist challenges",
		description:
			"Structured watchlists with a goal attached. Current: Nolan Essentials, Horror Canon, Ghibli Magic, A24 Highlights. Completing one earns a permanent prestige badge.",
		buildStatus: "exists",
		tiers: ["immersed", "devoted"],
	},
	{
		name: "Leaderboard visibility",
		description:
			"Appear on the community leaderboard ranked by activity, reviews, list quality, and engagement. Free and Attuned users can view it but aren't listed.",
		buildStatus: "exists",
		tiers: ["immersed", "devoted"],
	},
	// ── Devoted ──
	{
		name: "Vote on upcoming features",
		description:
			"Access to a private roadmap board where Devoted members can upvote and comment on what gets built next. Votes are tracked and used to prioritize.",
		buildStatus: "planned",
		tiers: ["devoted"],
	},
	{
		name: "Beta access",
		description:
			"New features before they're released to anyone else. Polished betas close to shipping — you're the first to see what's coming.",
		buildStatus: "planned",
		tiers: ["devoted"],
	},
	{
		name: "Direct feedback channel to team",
		description:
			"A direct line to the team — not a support ticket queue. Closer to a private Discord channel where your feedback is seen and responded to personally.",
		buildStatus: "planned",
		tiers: ["devoted"],
	},
	{
		name: "Inner circle community",
		description:
			"A private space for Devoted members only to talk about the platform, share opinions on features, and be part of the conversation that shapes Sense.",
		buildStatus: "planned",
		tiers: ["devoted"],
	},
	{
		name: "Name in app credits",
		description:
			"Your name or username appears in a dedicated supporters page in the app — permanent and visible to all users. Accumulates as long as you're Devoted.",
		buildStatus: "planned",
		tiers: ["devoted"],
	},
	{
		name: "Devoted badge on profile",
		description:
			"A visible marker on your profile that signals to everyone that you're a Devoted supporter. Designed to be noticed — other users will know you believe in the platform.",
		buildStatus: "planned",
		tiers: ["devoted"],
	},
	{
		name: "Public supporters page listing",
		description:
			"A page on Sense listing all Devoted members with profile links. Part recognition, part community — the people who love the platform most, celebrated.",
		buildStatus: "planned",
		tiers: ["devoted"],
	},
	{
		name: "Seasonal exclusive themes",
		description:
			"Themes released for specific moments — a film festival season, a Sense anniversary — available only to Devoted members, never sold or released to other tiers.",
		buildStatus: "planned",
		tiers: ["devoted"],
	},
	{
		name: "Rare Devoted-only badges",
		description:
			"Special badges that can only ever exist on Devoted member profiles. Not earnable by anyone else regardless of watch history. Permanent identity markers.",
		buildStatus: "planned",
		tiers: ["devoted"],
	},
];

export async function seedPlanCatalogue() {
	console.log("Seeding plan tiers…");
	await db.insert(planTier).values(TIERS).onConflictDoNothing();

	console.log("Seeding plan features…");
	for (let i = 0; i < FEATURES.length; i++) {
		const f = FEATURES[i];
		const id = makeId("feat");
		await db
			.insert(planFeature)
			.values({
				id,
				name: f.name,
				description: f.description,
				buildStatus: f.buildStatus,
				sortOrder: i,
			})
			.onConflictDoNothing();
		await db
			.insert(planFeatureTier)
			.values(f.tiers.map((tierId) => ({ featureId: id, tierId })))
			.onConflictDoNothing();
	}
	console.log("Done.");
}
