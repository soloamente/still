import {
	browsePlaceLine,
	companionServiceDisplayName,
	DISCORD_TRACKING_WITH_SENSE,
	isGenericBrowseTitle,
} from "./service-platform-brand";

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

export type CompanionPresenceMode = "playing" | "browsing" | "sense";

type ActivityShape = {
	name: string | null;
	details: string | null;
	state: string | null;
	smallImageText: string | null;
	startTimestamp: number | null;
	endTimestamp: number | null;
};

type SenseMediaShape = {
	kind: "movie" | "episode";
	title: string;
	season: number | null;
	episode: number | null;
} | null;

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

/** Guess mode when the content script did not set one explicitly. */
export function inferCompanionPresenceMode(input: {
	service: string;
	senseMedia: SenseMediaShape;
	activity: ActivityShape;
	presenceMode?: CompanionPresenceMode;
}): CompanionPresenceMode {
	if (input.presenceMode) return input.presenceMode;
	if (input.service === "Sense") return "sense";
	if (input.senseMedia) return "playing";
	const small = input.activity.smallImageText?.trim().toLowerCase() ?? "";
	if (small.includes("browse") || small.includes("reading")) return "browsing";
	if (
		input.activity.startTimestamp != null &&
		input.activity.endTimestamp == null
	) {
		return "browsing";
	}
	if (input.senseMedia == null && filled(input.activity.details)) {
		return "browsing";
	}
	return "playing";
}

/**
 * Discord shows "Watching {name}" in the member list and on the card header.
 * Playback says "Watching with Sense". The title is the first row. A film's
 * second row is "On {service}". A show's second row is the episode.
 * Exploring and a title page keep a Browsing line, then On {platform}.
 */
export function finalizeDiscordActivityFields(
	fields: DiscordActivityFields,
	input: {
		mode: CompanionPresenceMode;
		senseMedia: SenseMediaShape;
		service: string;
		activityState: string | null;
		episodeTitle: string | null;
		seasonEpisode: string | null;
		pagePath?: string | null;
	},
): DiscordActivityFields {
	const title = fields.name.trim();
	if (input.mode === "sense") {
		return {
			name: title.length > 0 ? title : "Sense",
			details:
				fields.details ??
				(filled(input.activityState) && input.activityState !== title
					? input.activityState
					: null),
			state: presenceStateLine(fields.state),
			largeText: fields.largeText ?? title,
		};
	}
	if (input.mode === "browsing") {
		return browseCard({
			title,
			service: input.service,
			pagePath: input.pagePath,
		});
	}
	if (
		input.senseMedia?.kind === "movie" ||
		input.senseMedia?.kind === "episode"
	) {
		return playingCard({
			title,
			service: input.service,
			kind: input.senseMedia.kind,
			episodeTitle: input.episodeTitle,
			seasonEpisode: input.seasonEpisode,
		});
	}
	return fields;
}

/** Discord prefixes this with "Watching", so the status reads "Watching with Sense". */
export const DISCORD_WATCHING_WITH_SENSE = "with Sense";

/**
 * Status is "Watching with Sense" and the title is the first row. A film's
 * second row is "On {service}". A show's second row is the episode only,
 * so the platform is not stuck on that same line.
 */
function playingCard(input: {
	title: string;
	service: string;
	kind: "movie" | "episode";
	episodeTitle: string | null;
	seasonEpisode: string | null;
}): DiscordActivityFields {
	const platform = onPlatformLine(input.service);
	const episode = input.kind === "episode" ? episodeLine(input) : null;
	switch (input.kind) {
		case "movie":
			return {
				name: DISCORD_WATCHING_WITH_SENSE,
				details: input.title,
				state: platform,
				largeText: input.title,
			};
		case "episode":
			return {
				name: DISCORD_WATCHING_WITH_SENSE,
				details: input.title,
				state: episode ?? platform,
				largeText: input.title,
			};
		default: {
			const unreachable: never = input.kind;
			return unreachable;
		}
	}
}

/**
 * Same header as playback. The first row stays "Browsing …" so a title page
 * is not just a name. The second row is On {platform}.
 */
function browseCard(input: {
	title: string;
	service: string;
	pagePath?: string | null;
}): DiscordActivityFields {
	const named = isGenericBrowseTitle(input.title) ? null : input.title;
	const headline = browsePlaceLine({
		title: input.title,
		service: input.service,
		pagePath: input.pagePath,
	});
	return {
		name: DISCORD_WATCHING_WITH_SENSE,
		details: headline,
		state: onPlatformLine(input.service),
		// Poster hover is the film or show. A catalogue hover names the page.
		largeText: named ?? headline,
	};
}

function episodeLine(input: {
	title: string;
	episodeTitle: string | null;
	seasonEpisode: string | null;
}): string | null {
	const episodeName =
		input.episodeTitle && input.episodeTitle !== input.title
			? input.episodeTitle
			: null;
	const line = [input.seasonEpisode, episodeName].filter(Boolean).join(" - ");
	return line.length > 0 ? line : null;
}

/** "Movy" alone looks like the title. "On Movy" is the platform. */
function onPlatformLine(service: string): string {
	const name = companionServiceDisplayName(service);
	if (name.toLowerCase().startsWith("on ")) return name;
	return `On ${name}`;
}

function presenceStateLine(state: string | null): string {
	const trimmed = state?.trim() ?? "";
	if (!trimmed || trimmed === "Sense") return DISCORD_TRACKING_WITH_SENSE;
	return trimmed;
}

/** One resolver for the extension background and the Discord host fallback. */
export function resolveDiscordActivityFromMessage(
	message: {
		service: string;
		activity: ActivityShape;
		senseMedia: SenseMediaShape;
		presenceMode?: CompanionPresenceMode;
		pagePath?: string | null;
	},
	layout: DiscordActivityLayout,
): DiscordActivityFields | null {
	const showTitle =
		message.senseMedia?.title.trim() ||
		message.activity.name?.trim() ||
		message.activity.details?.trim() ||
		"";
	if (!showTitle) return null;
	const details = message.activity.details?.trim() ?? "";
	const state = message.activity.state?.trim() ?? "";
	const episodeTitle =
		details.length > 0 && details !== showTitle
			? details
			: state.length > 0 && state !== showTitle
				? state
				: null;
	const parts = discordActivityParts({
		service: message.service,
		title: showTitle,
		episodeTitle,
		season: message.senseMedia?.season ?? null,
		episode: message.senseMedia?.episode ?? null,
	});
	if (!parts) return null;
	const mode = inferCompanionPresenceMode(message);
	const base = resolveDiscordActivityFields(layout, parts);
	return finalizeDiscordActivityFields(base, {
		mode,
		senseMedia: message.senseMedia,
		service: parts.service,
		activityState: message.activity.state,
		episodeTitle: parts.episodeTitle,
		seasonEpisode: parts.seasonEpisode,
		pagePath: message.pagePath,
	});
}
