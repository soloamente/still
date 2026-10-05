import type { CompanionSiteId } from "./settings.ts";

/**
 * What each player option actually changes. Discord is the status.
 * The Sense profile still receives the title while privacy mode is on.
 */
const SETTING_DETAILS: Record<CompanionSiteId, Record<string, string>> = {
	netflix: {
		privacy:
			"Hides the title on Discord and only says you're watching Netflix. Your Sense profile still shows the title.",
		usePresenceName:
			"Uses the film or episode name as the Discord status. Off keeps the status named Netflix.",
		showBrowsingStatus:
			"Also reports when you're browsing the catalog, not only while a title is playing.",
		showCover:
			"Sends the poster when Netflix has one. Off uses the Netflix mark instead.",
		showMovies: "Films you play are reported. Off skips movies.",
		showSeries: "Series and episodes are reported. Off skips them.",
		showSmallImages:
			"While paused, adds a pause mark beside the art when Discord can show that image.",
		timestamp:
			"Shows how far you are on Discord, counting down while the title plays.",
		logoType:
			"Which Netflix mark to use when the poster is off: animated, still, or still with no background.",
	},
	disney: {
		privacy:
			"Hides the title on Discord and only says you're watching. Your Sense profile still shows the title.",
		usePresenceName:
			"Uses the title as the Discord status. Off keeps the status named Disney+.",
		time: "Shows how far you are on Discord while the title plays.",
		buttons:
			"The player can remember a watch link. The Discord status does not include that link.",
	},
	prime: {
		usePresenceName:
			"Uses the title as the Discord status. Off keeps the status named Prime Video.",
		cover:
			"Sends the banner art. Off leaves the art out of the Discord status.",
		imageType:
			"Crops the banner to the right side, where the title usually sits, or sends the whole image.",
	},
	apple: {
		showButton:
			"The player can remember a watch link. The Discord status does not include that link.",
		showCover: "Sends the poster when Apple TV+ has one.",
		useActivityName:
			"Uses the film or episode name as the Discord status. Off keeps the show name only.",
	},
	max: {
		privacy:
			"Hides the title on Discord. Your Sense profile still shows the title.",
		cover: "Sends the poster when HBO Max has one.",
		usePresenceName:
			"Uses the title as the Discord status. Off keeps the status named HBO Max.",
		timestamp:
			"Shows how far you are on Discord, counting down while the title plays.",
		showBrowsingStatus:
			"Also reports when you're browsing the catalog, not only while a title is playing.",
	},
};

export function settingDetail(
	site: CompanionSiteId,
	id: string,
): string | null {
	return SETTING_DETAILS[site][id] ?? null;
}
