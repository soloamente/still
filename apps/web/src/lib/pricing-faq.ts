/** Hash + landmark for the pricing Q&A — keep in sync with the section `id`. */
export const PRICING_FAQ_SECTION_ID = "questions";

/** Heading id for `aria-labelledby` on the Q&A landmark. */
export const PRICING_FAQ_HEADING_ID = "pricing-faq-heading";

export type PricingFaqLink = {
	href: string;
	label: string;
};

export type PricingFaqAnswerPart =
	| { type: "text"; text: string }
	| { type: "link"; href: string; label: string };

export type PricingFaqItem = {
	id: string;
	question: string;
	/** Plain sentences for the accordion and FAQPage JSON-LD — no markup. */
	answerPlain: string;
	links?: readonly PricingFaqLink[];
};

/**
 * Public pricing Q&A — copy matches current product (Still free, Polar paid,
 * Devoted purchasable after confirm, referral 10% off first Attuned/Immersed).
 */
export const PRICING_FAQ_ITEMS: readonly PricingFaqItem[] = [
	{
		id: "still-free",
		question: "What's included on Still?",
		answerPlain:
			"Diary, reviews, lists, follows, and Community stay on Still. Paid plans add depth — stats, expression, and presence — not the core loop.",
	},
	{
		id: "plans-differ",
		question: "How do Attuned, Immersed, and Devoted differ?",
		answerPlain:
			"Each plan includes everything on the tier below, then adds more. Open Compare plans & features for the full matrix.",
		links: [{ href: "#compare", label: "Compare plans & features" }],
	},
	{
		id: "change-or-cancel",
		question: "Can I switch or cancel later?",
		answerPlain:
			"Yes. Open Subscription settings to manage billing. Canceling paid features does not delete your diary, reviews, or lists.",
		links: [
			{ href: "/me/settings/subscription", label: "Subscription settings" },
		],
	},
	{
		id: "annual-billing",
		question: "Why does annual show a monthly price?",
		answerPlain:
			"Annual is billed once per year. The large figure is the monthly equivalent so you can compare plans. The billed-yearly amount sits next to it.",
	},
	{
		id: "friend-invite",
		question: "How do friend invites work?",
		answerPlain:
			"A friend's code gives you 10% off your first Attuned or Immersed checkout. They unlock milestone rewards as you join.",
	},
	{
		id: "devoted",
		question: "What is Devoted?",
		answerPlain:
			"Devoted is the supporter plan. Some perks are still rolling out — you'll confirm that before checkout.",
	},
];

/** Split a plain answer so one in-copy label can render as a real link. */
export function splitFaqAnswerWithLinks(
	answer: string,
	links: readonly PricingFaqLink[],
): PricingFaqAnswerPart[] {
	const link = links[0];
	if (!link) {
		return [{ type: "text", text: answer }];
	}

	const index = answer.indexOf(link.label);
	if (index < 0) {
		return [{ type: "text", text: answer }];
	}

	const before = answer.slice(0, index);
	const after = answer.slice(index + link.label.length);
	const parts: PricingFaqAnswerPart[] = [];
	if (before) {
		parts.push({ type: "text", text: before });
	}
	parts.push({ type: "link", href: link.href, label: link.label });
	if (after) {
		parts.push({ type: "text", text: after });
	}
	return parts;
}

export type PricingFaqJsonLd = {
	"@context": "https://schema.org";
	"@type": "FAQPage";
	"@id": string;
	mainEntity: Array<{
		"@type": "Question";
		name: string;
		acceptedAnswer: {
			"@type": "Answer";
			text: string;
		};
	}>;
};

/** FAQPage JSON-LD for `/pricing` — origin must be the request host. */
export function buildPricingFaqJsonLd(origin: string): PricingFaqJsonLd {
	const trimmed = origin.replace(/\/$/, "");
	return {
		"@context": "https://schema.org",
		"@type": "FAQPage",
		"@id": `${trimmed}/pricing#${PRICING_FAQ_SECTION_ID}`,
		mainEntity: PRICING_FAQ_ITEMS.map((item) => ({
			"@type": "Question",
			name: item.question,
			acceptedAnswer: {
				"@type": "Answer",
				text: item.answerPlain,
			},
		})),
	};
}
