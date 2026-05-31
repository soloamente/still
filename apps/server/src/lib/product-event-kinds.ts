/** Server- and client-recorded funnel kinds aligned with roadmap §Metrics. */
export const PRODUCT_EVENT_KINDS = [
	"import.letterboxd.completed",
	"import.anilist.completed",
	"log.first_created",
	"onboarding.completed",
	"taste_card.shared",
] as const;

export type ProductEventKind = (typeof PRODUCT_EVENT_KINDS)[number];

/** Kinds the web app may POST via `/api/product-events`. */
export const CLIENT_PRODUCT_EVENT_KINDS = [
	"onboarding.completed",
	"taste_card.shared",
] as const;

export type ClientProductEventKind =
	(typeof CLIENT_PRODUCT_EVENT_KINDS)[number];

export function isProductEventKind(value: string): value is ProductEventKind {
	return (PRODUCT_EVENT_KINDS as readonly string[]).includes(value);
}

export function isClientProductEventKind(
	value: string,
): value is ClientProductEventKind {
	return (CLIENT_PRODUCT_EVENT_KINDS as readonly string[]).includes(value);
}
