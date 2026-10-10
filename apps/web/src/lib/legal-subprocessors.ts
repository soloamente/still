/**
 * Public vendor / subprocessor list for the Trust Center.
 * Keep this current when infrastructure or processors change.
 */

export type LegalSubprocessor = {
	name: string;
	/** What they do for Sense (plain language). */
	purpose: string;
};

/** Current third parties that may process personal data for Sense. */
export const LEGAL_SUBPROCESSORS: LegalSubprocessor[] = [
	{
		name: "The Movie Database (TMDb)",
		purpose: "Catalogue metadata and artwork under TMDb’s terms.",
	},
	{
		name: "Polar",
		purpose: "Checkout and payment processing as merchant of record.",
	},
	{
		name: "Resend",
		purpose: "Transactional email when that service is configured.",
	},
	{
		name: "Identity providers you connect",
		purpose:
			"Basic profile and sign-in when you choose Discord, Apple, or another provider.",
	},
	{
		name: "YouTube",
		purpose:
			"Trailer embeds after you grant embeds consent or choose to load a trailer.",
	},
	{
		name: "Vercel",
		purpose: "Web hosting and edge delivery.",
	},
	{
		name: "Cloudflare",
		purpose: "Edge infrastructure where used.",
	},
	{
		name: "Neon",
		purpose: "Primary application database.",
	},
	{
		name: "Upstash Redis",
		purpose: "Realtime and presence when those features are on.",
	},
];
