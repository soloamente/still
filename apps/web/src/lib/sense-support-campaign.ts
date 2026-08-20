/** Stable campaign key — persisted per patron when they dismiss the dialog. */
export const SENSE_SUPPORT_CAMPAIGN_ID = "discord-activity-pro-2026-08";

export const SENSE_SUPPORT_CAMPAIGN_VIDEO_SRC =
	"/campaigns/patch-0.3.3-video-cozy.mp4";

/** Set false after the campaign ends. What's New still ships independently. */
export const SENSE_SUPPORT_CAMPAIGN_ENABLED = false;

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
	title: "Discord activity for Pro",
	bodyParagraphs: [
		"Listening and Playing on profiles needs a dedicated presence server. We're funding it with paid plans so the feature can stay reliable for everyone who unlocks it.",
		"When enough Pro members are in, Discord activity turns on for Attuned and above — not only early supporters. Live progress is on Pricing.",
	],
	learnTitle: "What you unlock",
	learnBody:
		"Connect Discord once, then Listening, Playing, and Streaming can show on your profile and account menu. Privacy follows your existing presence settings. Production stays off until the server is funded.",
	primaryCtaLabel: "See Pro progress",
	primaryCtaHref: "/pricing",
	secondaryCtaLabel: "Maybe later",
};

/** Active one-time Discord / Pro campaign — shown after What's New when both are due. */
export function getActiveSenseSupportCampaign(): SenseSupportCampaign | null {
	if (!SENSE_SUPPORT_CAMPAIGN_ENABLED) return null;
	return SENSE_SUPPORT_CAMPAIGN_COPY;
}
