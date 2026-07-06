/** Stable campaign key — persisted per patron when they dismiss the dialog. */
export const SENSE_SUPPORT_CAMPAIGN_ID = "sense-growth-2026-07";

export const SENSE_SUPPORT_CAMPAIGN_VIDEO_SRC =
	"/campaigns/patch-0.3.3-video-cozy.mp4";

/** Set false after the campaign ends to restore What's New. */
export const SENSE_SUPPORT_CAMPAIGN_ENABLED = true;

export type SenseSupportCampaign = {
	id: string;
	videoSrc: string;
	title: string;
	bodyParagraphs: readonly string[];
	learnTitle: string;
	learnBody: string;
	primaryCtaLabel: string;
	primaryCtaHref: string;
	secondaryCtaLabel: string;
};

export const SENSE_SUPPORT_CAMPAIGN_COPY: SenseSupportCampaign = {
	id: SENSE_SUPPORT_CAMPAIGN_ID,
	videoSrc: SENSE_SUPPORT_CAMPAIGN_VIDEO_SRC,
	title: "Sense is growing and so is the work",
	bodyParagraphs: [
		"More of you are showing up every week. That's incredible, and it means higher hosting costs, more support load, and a real push to bring Sense to your phone.",
		"Paid plans keep the lights on and fund the native app we're building. If Sense has become part of how you watch, supporting the project helps us ship it without cutting corners.",
	],
	learnTitle: "App for iOS and Android",
	learnBody:
		"Your subscription also funds the native apps we're building. Apple charges $99 per year just to publish on the App Store; Google Play has its own developer fees on top of design and engineering. Supporting Sense today helps cover those costs so we can ship on your phone, not only keep the web running.",
	primaryCtaLabel: "Support the project",
	primaryCtaHref: "/pricing",
	secondaryCtaLabel: "Maybe later",
};

/** Active one-time support campaign — replaces What's New while enabled. */
export function getActiveSenseSupportCampaign(): SenseSupportCampaign | null {
	if (!SENSE_SUPPORT_CAMPAIGN_ENABLED) return null;
	return SENSE_SUPPORT_CAMPAIGN_COPY;
}
