/**
 * English long-form policy sections for public legal pages.
 * Plainspoken product copy. Counsel should review before launch.
 */

import { APP_NAME } from "@/lib/app-brand";
import { LEGAL_TRADER } from "@/lib/legal-trader";

export type LegalPolicyId = "privacy" | "terms" | "cookies";

export type LegalPolicySection = {
	heading: string;
	paragraphs: string[];
	/** Optional bullets (e.g. disclosure categories), Mobbin-style. */
	bullets?: string[];
};

export type LegalPolicyDefinition = {
	id: LegalPolicyId;
	title: string;
	description: string;
	/** Short opener under the title (Mobbin/ign style). */
	intro: string[];
	sections: LegalPolicySection[];
};

export const LEGAL_NAV: { id: LegalPolicyId; href: string; label: string }[] = [
	{ id: "privacy", href: "/privacy", label: "Privacy" },
	{ id: "terms", href: "/terms", label: "Terms" },
	{ id: "cookies", href: "/cookies", label: "Cookies" },
];

const trader = LEGAL_TRADER;
const name = trader.productName || APP_NAME;
const address = trader.addressLines.join(", ");

export const LEGAL_POLICY_SECTIONS: Record<
	LegalPolicyId,
	LegalPolicyDefinition
> = {
	privacy: {
		id: "privacy",
		title: "Privacy Policy",
		description: `What ${name} collects, why, and how to ask about your data.`,
		intro: [
			`This policy explains what ${name} collects, why we use it, and what you can ask us to do.`,
			"We collect what we need to run your diary, profile, and community. Optional analytics and trailer embeds stay off until you agree. We do not sell your data.",
			`We, ${name}, are the data controller. ${trader.legalName} operates ${name} as a sole trader. Postal address and email are in Contact below.`,
		],
		sections: [
			{
				heading: "What we collect",
				paragraphs: [
					"Account details. Email, display name, handle, and how you sign in. If you use a password, we store a hash. If you connect Discord, Apple, or another provider, we receive the basic profile they send. We never see those providers’ passwords.",
					`Your activity on ${name}. Diary logs, ratings, reviews (including optional voice notes), lists, watchlist, follows, quotes you save or submit, showcase picks, and similar taste activity.`,
					"Security signals. Session cookies, tokens, and rough device or browser signals. We use these to keep accounts safe, limit abuse, and keep the service online. Presence and Discord activity only run when you turn them on.",
					"Payments. Paid plans go through Polar, who act as merchant of record. Card details go to Polar, not into our database. We keep subscription status and the IDs we need to unlock plan features and help with billing problems.",
					"Messages you send us. If you email our contact address, we keep the message so we can reply.",
				],
			},
			{
				heading: "Why we use it",
				paragraphs: [
					"To provide the product you signed up for: account, diary, community, recommendations, and subscriptions.",
					"To keep the service secure and reliable.",
					"To send transactional email, such as verification or security notices.",
					"With your consent where the law requires it: non-essential preferences, product analytics, and media embeds. Details are in the Cookie Policy.",
				],
			},
			{
				heading: "Disclosure of personal information to third parties",
				paragraphs: [
					"We may disclose personal information to:",
					"We do not sell personal data. We do not run third-party advertising pixels in this version of the product.",
				],
				bullets: [
					`Service providers who help us run ${name}, such as hosting, email, payments, catalogue data, and media embeds`,
					"Identity providers you choose to connect",
					"Our contractors or related parties who need access to operate the service",
					"Courts, regulators, or law enforcement when required by law or to protect legal rights",
					"A buyer or successor if we transfer all or substantially all of the business",
				],
			},
			{
				heading: "Third parties we currently use",
				paragraphs: [
					"We keep a live list of vendors and subprocessors on our Trust Center. That list is public and may change over time.",
				],
			},
			{
				heading: "How long we keep it",
				paragraphs: [
					"We keep your account and library while the account exists, and for a limited time afterward for backups, legal duties, or disputes.",
					"When you are signed in, you can export data, clear library data, or delete your account from Settings under Data. Some security logs may remain when the law requires us to keep them.",
				],
			},
			{
				heading: "Your choices",
				paragraphs: [
					"Depending on where you live, you may have rights to access, correct, delete, restrict, or object to certain processing, and to complain to a supervisory authority.",
					`Email ${trader.email} from the address on your account. We may need to confirm it is you before we act.`,
				],
			},
			{
				heading: "Children",
				paragraphs: [
					`${name} is not for children under 13, or under a higher age your country sets. We do not knowingly collect data from them. If you think a child has an account, email ${trader.email} and we will remove it.`,
				],
			},
			{
				heading: "Cookies",
				paragraphs: [
					"The Cookie Policy explains categories, defaults, and how to change your choice.",
				],
			},
			{
				heading: "Changes",
				paragraphs: [
					"When this policy changes, the new version replaces this one when we publish it here, and the date at the top updates. For significant changes we will make a reasonable effort to tell you.",
				],
			},
			{
				heading: "Contact",
				paragraphs: [
					`Questions about your data: ${trader.email}.`,
					`Postal address: ${trader.legalName}, ${address}.`,
				],
			},
		],
	},
	terms: {
		id: "terms",
		title: "Terms of Service",
		description: `The rules for using ${name}.`,
		intro: [
			`${name} is a social identity platform for taste. You keep a diary of films and TV, share lists and reviews, and browse a community of other patrons.`,
			`These terms are the agreement between you and ${name}. By creating an account or using the service, you accept them.`,
		],
		sections: [
			{
				heading: "Who we are",
				paragraphs: [
					`${name} is operated by ${trader.legalName}, a sole trader. Account help: ${trader.email}. Postal address: ${address}.`,
					"For questions about your data, see the Contact section of the Privacy Policy.",
				],
			},
			{
				heading: "Changes to these terms",
				paragraphs: [
					"We may update these terms. The new version applies when we publish it here, and the date at the top updates.",
					"If a change affects a paid plan in a material way (price, what it includes, or how it renews), we will make a reasonable effort to tell you before it takes effect. If you do not accept a change, stop using the service and cancel any paid plan before it renews.",
				],
			},
			{
				heading: "Your account",
				paragraphs: [
					"You must be old enough to form a binding contract where you live, and meet any minimum age we state at signup. One person, one account.",
					`You are responsible for what happens through your account. Keep your sign-in secure. Email ${trader.email} if you think someone else has access.`,
					`Handles are first come, first served, with limits. You may not take a handle that impersonates someone, pretends to be official ${name}, or exists to mislead. We can reclaim, rename, or suspend a handle that breaks this.`,
				],
			},
			{
				heading: "What you publish",
				paragraphs: [
					`Reviews, lists, uploads, voice notes, quotes, and other content you put on ${name} stay yours. You are responsible for them. By publishing, you confirm you have the rights to do so, and that the content does not break the law or anyone else’s rights.`,
					`To run the service, you give us a worldwide, royalty-free licence to store, copy, resize, re-encode, and display that content so we can operate ${name} and show it to people you share it with. That includes preview cards other sites generate from your links.`,
					"The licence is limited to running the service. It ends when you delete the content or your account, except for copies we must keep for legal or security reasons, and copies other people have already saved or reshared, which we cannot reach.",
				],
			},
			{
				heading: "Catalogue media",
				paragraphs: [
					`Film and TV metadata and artwork come from The Movie Database (TMDb). ${name} does not claim ownership of studio posters, backdrops, or TMDb data. We show attribution where TMDb’s terms require it.`,
				],
			},
			{
				heading: "What is not allowed",
				paragraphs: [
					`Do not use ${name} to publish, host, or link to anything illegal where you are, where we operate, or where your visitors are. That includes sexual content involving minors; intimate images shared without agreement; harassment or threats; material that encourages violence, terrorism, self-harm, or hatred of a group; work you do not have the right to publish; and scams, phishing, malware, or anything meant to deceive.`,
					"Do not use the service against us or other patrons. No impersonation, no probing or bypassing security, no scraping or automating without our written permission, no credential stuffing, and no attempts to dodge plan limits.",
				],
			},
			{
				heading: "How we enforce this",
				paragraphs: [
					`We do not review every post before it goes live. We act on reports and on what we find. Report abuse or infringement to ${trader.email} with enough detail for us to find the material.`,
					"If something breaks these terms, we may remove content, restrict a feature, or close the account. We may do so without warning when the harm is serious or ongoing.",
				],
			},
			{
				heading: "Plans, payments, and refunds",
				paragraphs: [
					`${name} has a free tier. Paid plans unlock optional features. They do not lock your diary or stop you editing what you already own. Prices appear on the pricing page before any tax that applies where you are.`,
					"Payments go through Polar, who act as merchant of record. When you buy a plan, Polar is the seller for that purchase and handles the payment, tax, and receipt. Receipts, chargebacks, and some billing questions may involve Polar as well as us. Check who appears as merchant of record on your receipt.",
					"Subscriptions renew until you cancel. Cancelling stops the next renewal. It does not automatically refund the current period. If a renewal payment fails, paid features turn off until payment succeeds. Your diary and content stay where they are.",
				],
			},
			{
				heading: "Your right to change your mind",
				paragraphs: [
					"If you are a consumer in the EU/EEA, or in another region with similar rules, you may have a right to withdraw from a distance purchase within a short period (often fourteen days) without giving a reason.",
					"For digital content or services, that right can end once performance begins, if you gave prior express consent and acknowledged that you lose the withdrawal right. We aim to show this clearly at checkout. If our wording conflicts with consumer law, consumer law wins.",
				],
			},
			{
				heading: "How to request a refund",
				paragraphs: [
					`Email ${trader.email} from the address on your account. Include your order or Polar receipt details, your account handle, and a short description of the issue.`,
					"We review requests in good faith. We do not offer an unlimited money-back guarantee. Cancelling stops the next renewal; it does not automatically refund the current period.",
				],
			},
			{
				heading: "The service itself",
				paragraphs: [
					`We run ${name} carefully, but we provide it as it is. We do not promise uninterrupted availability, that we will never lose data, or that recommendations will match your taste. Export anything you would be upset to lose.`,
					`To the extent the law allows, we are not liable for indirect or consequential loss from your use of ${name}. Our total liability for anything connected to these terms is limited to the greater of what you paid us in the twelve months before the claim, or one hundred US dollars. Nothing here removes a right you have that cannot be waived by agreement.`,
					"You agree to cover us for claims that come from what you published, how you used the service, or a breach of these terms.",
				],
			},
			{
				heading: "Ending",
				paragraphs: [
					`You can stop using ${name} at any time. You can delete your account from Settings under Data. Deletion removes your library and account from the live service and cannot be undone. The Privacy Policy explains what happens to remaining data.`,
					"We can suspend or close an account that breaks these terms, creates a legal or security problem, or that we are required to act on. Terms meant to survive account closure continue to apply.",
				],
			},
		],
	},
	cookies: {
		id: "cookies",
		title: "Cookie Policy",
		description: `How ${name} uses cookies and similar storage.`,
		intro: [
			`${name} uses first-party cookies and browser storage to keep you signed in and remember preferences.`,
			"With your consent, we also measure product usage and load media embeds such as YouTube trailers. We do not use third-party advertising cookies in this version of the product.",
		],
		sections: [
			{
				heading: "Categories",
				paragraphs: [
					"Necessary (always on). Session and auth cookies, security tokens, and storing your cookie choice itself.",
					"Preferences (off until you Accept all, or grant them later). Examples include theme and non-essential “seen” flags that are not required to sign in.",
					`Analytics (off until granted). First-party product events that help us improve ${name}. Not sold to advertisers.`,
					"Embeds / media (off until granted, or until you choose Load trailer on a title). YouTube iframes do not load before then.",
				],
			},
			{
				heading: "How to change your choice",
				paragraphs: [
					"On your first visit we show a banner with Necessary only and Accept all. Your choice is stored on this device.",
					"Clearing site data for this origin resets the choice, and the banner can appear again.",
					"The Privacy Policy explains how related personal data is handled, including how to contact us.",
				],
			},
		],
	},
};

export function getLegalPolicy(id: LegalPolicyId): LegalPolicyDefinition {
	return LEGAL_POLICY_SECTIONS[id];
}
