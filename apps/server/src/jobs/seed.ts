import { achievement, badge, db } from "@still/db";
import { eq } from "drizzle-orm";

/**
 * Seed the badge + achievement catalogs. Idempotent — safe to re-run on
 * every boot. Designers can add rows directly to the DB; this list only
 * guarantees the v1 baseline ships with the product.
 */
const BADGES = [
	// Watch milestones
	{
		id: "watch_1",
		slug: "first-log",
		name: "First Light",
		description: "Logged your first film.",
		tier: "bronze",
		category: "watch_milestone",
		points: 10,
		iconUrl: "/badges/light.png",
		criteria: { kind: "logs_count", min: 1 },
	},
	{
		id: "watch_10",
		slug: "ten-films",
		name: "Reel One",
		description: "Logged 10 films.",
		tier: "bronze",
		category: "watch_milestone",
		points: 20,
		iconUrl: "/badges/10.png",
		criteria: { kind: "logs_count", min: 10 },
	},
	{
		id: "watch_100",
		slug: "century",
		name: "Century",
		description: "Logged 100 films.",
		tier: "silver",
		category: "watch_milestone",
		points: 50,
		criteria: { kind: "logs_count", min: 100 },
	},
	{
		id: "watch_500",
		slug: "five-hundred",
		name: "Connoisseur",
		description: "Logged 500 films.",
		tier: "gold",
		category: "watch_milestone",
		points: 150,
		criteria: { kind: "logs_count", min: 500 },
	},
	{
		id: "watch_1000",
		slug: "auteur",
		name: "Auteur",
		description: "Logged 1,000 films.",
		tier: "platinum",
		category: "watch_milestone",
		points: 400,
		criteria: { kind: "logs_count", min: 1000 },
	},
	{
		id: "watch_5000",
		slug: "lifetime",
		name: "Lifetime Pass",
		description: "Logged 5,000 films.",
		tier: "legendary",
		category: "watch_milestone",
		points: 1500,
		criteria: { kind: "logs_count", min: 5000 },
	},
	// Social
	{
		id: "social_1f",
		slug: "first-follower",
		name: "First Fan",
		description: "Got your first follower.",
		tier: "bronze",
		category: "social",
		points: 10,
		criteria: { kind: "followers_count", min: 1 },
	},
	{
		id: "social_10f",
		slug: "friends-circle",
		name: "Inner Circle",
		description: "10 followers strong.",
		tier: "silver",
		category: "social",
		points: 30,
		criteria: { kind: "followers_count", min: 10 },
	},
	{
		id: "social_100f",
		slug: "spotlight",
		name: "Spotlight",
		description: "100 followers — your taste resonates.",
		tier: "gold",
		category: "social",
		points: 120,
		criteria: { kind: "followers_count", min: 100 },
	},
	// Curator
	{
		id: "cur_1l",
		slug: "first-list",
		name: "Curator",
		description: "Published your first list.",
		tier: "bronze",
		category: "curator",
		points: 10,
		iconUrl: "/badges/curator.png",
		criteria: { kind: "lists_count", min: 1 },
	},
	{
		id: "cur_10l",
		slug: "list-maker",
		name: "List Maker",
		description: "Published 10 lists.",
		tier: "silver",
		category: "curator",
		points: 40,
		criteria: { kind: "lists_count", min: 10 },
	},
	// Reviewer
	{
		id: "rev_1",
		slug: "first-review",
		name: "Critic in Training",
		description: "Wrote your first review.",
		tier: "bronze",
		category: "reviewer",
		points: 15,
		iconUrl: "/badges/critic.png",
		criteria: { kind: "reviews_count", min: 1 },
	},
	{
		id: "rev_100likes",
		slug: "viral-take",
		name: "Viral Take",
		description: "A review reached 100 likes.",
		tier: "gold",
		category: "reviewer",
		points: 150,
		criteria: { kind: "review_likes", min: 100 },
	},
	// Explorer (genres — TMDb genre ids; 28 = action, 27 = horror, 16 = animation, 99 = documentary)
	{
		id: "exp_horror",
		slug: "horror-50",
		name: "Lights Out",
		description: "50 horror films logged.",
		tier: "silver",
		category: "explorer",
		points: 60,
		criteria: { kind: "genre_count", genreId: 27, min: 50 },
	},
	{
		id: "exp_doc",
		slug: "docs-50",
		name: "Truth Hunter",
		description: "50 documentaries logged.",
		tier: "silver",
		category: "explorer",
		points: 60,
		criteria: { kind: "genre_count", genreId: 99, min: 50 },
	},
	{
		id: "exp_animation",
		slug: "animation-50",
		name: "Drawn World",
		description: "50 animated films logged.",
		tier: "silver",
		category: "explorer",
		points: 60,
		criteria: { kind: "genre_count", genreId: 16, min: 50 },
	},
	// Decade traveler
	{
		id: "exp_decades",
		slug: "decade-traveler",
		name: "Decade Traveler",
		description: "Watched ≥10 films from at least 6 decades.",
		tier: "gold",
		category: "explorer",
		points: 120,
		criteria: { kind: "decade_coverage", min: 10, minDecades: 6 },
	},
	// Prestige (Sense Tier 1) — scarce, profile-worthy; not volume ladders.
	{
		id: "prestige_voice",
		slug: "distinct-voice",
		name: "Distinct Voice",
		description: "A review of yours reached 25 likes.",
		tier: "gold",
		category: "prestige",
		points: 90,
		criteria: { kind: "review_likes", min: 25 },
	},
	{
		id: "prestige_echo",
		slug: "echo-chamber",
		name: "Echo Chamber",
		description: "A review of yours reached 50 likes.",
		tier: "platinum",
		category: "prestige",
		points: 160,
		criteria: { kind: "review_likes", min: 50 },
	},
	{
		id: "prestige_midnight",
		slug: "midnight-alcove",
		name: "Midnight Alcove",
		description: "25 horror films logged — atmosphere over jumpscares.",
		tier: "gold",
		category: "prestige",
		points: 85,
		criteria: { kind: "genre_count", genreId: 27, min: 25 },
	},
	{
		id: "prestige_zeitgeist",
		slug: "zeitgeist",
		name: "Zeitgeist",
		description: "Ten films each from eight different decades.",
		tier: "platinum",
		category: "prestige",
		points: 140,
		criteria: { kind: "decade_coverage", min: 10, minDecades: 8 },
	},
	{
		id: "prestige_babel",
		slug: "babel",
		name: "Babel",
		description: "Logged films in 8 different languages.",
		tier: "platinum",
		category: "prestige",
		points: 130,
		criteria: { kind: "languages_count", min: 8 },
	},
	{
		id: "prestige_orbit",
		slug: "inner-orbit",
		name: "Inner Orbit",
		description: "25 followers — your taste has an audience.",
		tier: "gold",
		category: "prestige",
		points: 100,
		criteria: { kind: "followers_count", min: 25 },
	},
	{
		id: "prestige_diaries_merged",
		slug: "diaries-merged",
		name: "Diaries Merged",
		description: "Imported your watching history from Letterboxd.",
		tier: "silver",
		category: "prestige",
		points: 45,
		iconUrl: "/badges/curator.png",
		criteria: { kind: "manual" },
	},
	// Completionist challenges (Sense Tier 1) — awarded when a curated set is finished.
	{
		id: "prestige_challenge_nolan",
		slug: "architect-of-time",
		name: "Architect of Time",
		description: "Completed the Nolan essentials challenge.",
		tier: "gold",
		category: "prestige",
		points: 120,
		criteria: { kind: "manual" },
	},
	{
		id: "prestige_challenge_horror",
		slug: "night-reel",
		name: "Night Reel",
		description: "Completed the Horror canon challenge.",
		tier: "gold",
		category: "prestige",
		points: 110,
		criteria: { kind: "manual" },
	},
	{
		id: "prestige_challenge_ghibli",
		slug: "wind-rider",
		name: "Wind Rider",
		description: "Completed the Ghibli magic challenge.",
		tier: "gold",
		category: "prestige",
		points: 105,
		criteria: { kind: "manual" },
	},
	{
		id: "prestige_challenge_a24",
		slug: "indie-circuit",
		name: "Indie Circuit",
		description: "Completed the A24 highlights challenge.",
		tier: "platinum",
		category: "prestige",
		points: 130,
		criteria: { kind: "manual" },
	},
] as const;

const ACHIEVEMENTS = [
	{
		id: "ach_polyglot",
		slug: "polyglot",
		name: "Polyglot",
		description: "Watch films in 10 different languages.",
		points: 75,
		isHidden: false,
		target: 10,
		criteria: { kind: "languages_count", min: 10 },
	},
	{
		id: "ach_evangelist",
		slug: "evangelist",
		name: "Evangelist",
		description: "Reach 25 followers.",
		points: 50,
		isHidden: false,
		target: 25,
		criteria: { kind: "followers_count", min: 25 },
	},
	{
		id: "ach_devotee",
		slug: "devotee",
		name: "Devoted",
		description: "Log 250 films in a calendar year.",
		points: 200,
		isHidden: true,
		target: 250,
		criteria: { kind: "logs_count", min: 250 },
	},
	{
		id: "ach_critic",
		slug: "critic",
		name: "Established Critic",
		description: "Publish 25 reviews.",
		points: 75,
		isHidden: false,
		target: 25,
		criteria: { kind: "reviews_count", min: 25 },
	},
] as const;

export async function seedCatalog() {
	for (const b of BADGES) {
		const iconUrl = "iconUrl" in b ? (b.iconUrl as string) : undefined;
		await db
			.insert(badge)
			.values({
				id: b.id,
				slug: b.slug,
				name: b.name,
				description: b.description,
				tier: b.tier as "bronze" | "silver" | "gold" | "platinum" | "legendary",
				category: b.category,
				points: b.points,
				criteria: b.criteria,
				...(iconUrl ? { iconUrl } : {}),
			})
			.onConflictDoNothing();
	}

	// Catalog artwork — safe to re-run; updates rows that already exist without `icon_url`.
	const badgeArtworkById: Record<string, string> = {
		watch_1: "/badges/light.png",
		watch_10: "/badges/10.png",
		cur_1l: "/badges/curator.png",
		rev_1: "/badges/critic.png",
	};
	for (const [id, iconUrl] of Object.entries(badgeArtworkById)) {
		await db.update(badge).set({ iconUrl }).where(eq(badge.id, id));
	}
	for (const a of ACHIEVEMENTS) {
		await db
			.insert(achievement)
			.values({
				id: a.id,
				slug: a.slug,
				name: a.name,
				description: a.description,
				points: a.points,
				isHidden: a.isHidden,
				target: a.target,
				criteria: a.criteria,
			})
			.onConflictDoNothing();
	}
}
