export const DISCORD_LAYOUT_STORAGE_KEY = "senseCompanionDiscordLayout";

/** What a Discord line can show. Discord itself writes "Watching" above the title. */
export const DISCORD_FIELD_SOURCES = [
	"title",
	"episodeTitle",
	"seasonEpisode",
	"service",
	"sense",
	"empty",
] as const;

export type DiscordFieldSource = (typeof DISCORD_FIELD_SOURCES)[number];

export const DISCORD_FIELD_SOURCE_LABELS: Record<DiscordFieldSource, string> = {
	title: "Title",
	episodeTitle: "Episode name",
	seasonEpisode: "Season and episode",
	service: "Service",
	sense: "Sense",
	empty: "Empty",
};

export type DiscordActivityLayout = {
	name: DiscordFieldSource;
	details: DiscordFieldSource;
	state: DiscordFieldSource;
	largeText: DiscordFieldSource;
	cover: "artwork" | "none";
	profileButton: "show" | "hide";
};

/** Matches the card Discord shows today: title, season and episode, then Sense. */
export const DEFAULT_DISCORD_ACTIVITY_LAYOUT: DiscordActivityLayout = {
	name: "title",
	details: "seasonEpisode",
	state: "sense",
	largeText: "title",
	cover: "artwork",
	profileButton: "show",
};

export type DiscordActivityParts = {
	title: string;
	episodeTitle: string | null;
	seasonEpisode: string | null;
	service: string;
};

function episodeMark(
	season: number | null,
	episode: number | null,
): string | null {
	if (season == null || episode == null) return null;
	if (!Number.isInteger(season) || !Number.isInteger(episode)) return null;
	if (season < 1 || episode < 1) return null;
	return `S${season} E${episode}`;
}

/** Text the player already collected, before a layout picks the lines. */
export function discordActivityParts(input: {
	service: string;
	title: string | null;
	episodeTitle: string | null;
	season: number | null;
	episode: number | null;
}): DiscordActivityParts | null {
	const title = input.title?.trim() ?? "";
	if (!title) return null;
	const episodeTitle = input.episodeTitle?.trim() ?? "";
	return {
		title,
		episodeTitle:
			episodeTitle.length > 0 && episodeTitle !== title ? episodeTitle : null,
		seasonEpisode: episodeMark(input.season, input.episode),
		service: input.service.trim() || "Sense",
	};
}

/** Lines the helper writes. `name` is the title under Discord's Watching label. */
export type DiscordActivityFields = {
	name: string;
	details: string | null;
	state: string | null;
	largeText: string | null;
};

const SOURCE_SET = new Set<string>(DISCORD_FIELD_SOURCES);

function isSource(value: unknown): value is DiscordFieldSource {
	return typeof value === "string" && SOURCE_SET.has(value);
}

export function readDiscordActivityLayout(
	value: unknown,
): DiscordActivityLayout {
	if (typeof value !== "object" || value === null) {
		return DEFAULT_DISCORD_ACTIVITY_LAYOUT;
	}
	const raw = value as Partial<DiscordActivityLayout>;
	return {
		name: isSource(raw.name) ? raw.name : DEFAULT_DISCORD_ACTIVITY_LAYOUT.name,
		details: isSource(raw.details)
			? raw.details
			: DEFAULT_DISCORD_ACTIVITY_LAYOUT.details,
		state: isSource(raw.state)
			? raw.state
			: DEFAULT_DISCORD_ACTIVITY_LAYOUT.state,
		largeText: isSource(raw.largeText)
			? raw.largeText
			: DEFAULT_DISCORD_ACTIVITY_LAYOUT.largeText,
		cover: raw.cover === "none" ? "none" : "artwork",
		profileButton: raw.profileButton === "hide" ? "hide" : "show",
	};
}

function lineFor(
	source: DiscordFieldSource,
	parts: DiscordActivityParts,
): string | null {
	switch (source) {
		case "title":
			return parts.title;
		case "episodeTitle":
			return parts.episodeTitle;
		case "seasonEpisode":
			return parts.seasonEpisode;
		case "service":
			return parts.service;
		case "sense":
			return "Sense";
		case "empty":
			return null;
		default: {
			const unreachable: never = source;
			return unreachable;
		}
	}
}

function filled(value: string | null): string | null {
	const trimmed = value?.trim() ?? "";
	return trimmed.length > 0 ? trimmed : null;
}

/** Fill the card. The title line always has the show name if the chosen line is empty. */
export function resolveDiscordActivityFields(
	layout: DiscordActivityLayout,
	parts: DiscordActivityParts,
): DiscordActivityFields {
	const title = parts.title.trim();
	return {
		name: filled(lineFor(layout.name, parts)) ?? title,
		details: filled(lineFor(layout.details, parts)),
		state: filled(lineFor(layout.state, parts)),
		largeText: filled(lineFor(layout.largeText, parts)),
	};
}
