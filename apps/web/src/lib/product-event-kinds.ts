/** Server product funnel kinds — keep in sync with `apps/server/src/lib/product-event-kinds.ts`. */
export const PRODUCT_EVENT_KINDS = [
	"import.letterboxd.completed",
	"import.anilist.completed",
	"log.first_created",
	"onboarding.completed",
	"taste_card.shared",
	"taste.dismissed",
	"taste.for_you.served",
	"showcase.edited",
	"post_log.celebrate",
	"viral_review.tapped",
	"journal.read",
	"wrapped.viewed",
	"wrapped.shared",
	"members.followed",
	"streaming_alert.sent",
	"quote.upvote",
	"quote.save",
	"quote.unsave",
	"quote.submit",
] as const;

export type ProductEventKind = (typeof PRODUCT_EVENT_KINDS)[number];

/** Kinds the web app may POST via `/api/product-events`. */
export const CLIENT_PRODUCT_EVENT_KINDS = [
	"onboarding.completed",
	"taste_card.shared",
	"post_log.celebrate",
	"viral_review.tapped",
	"journal.read",
	"wrapped.viewed",
	"wrapped.shared",
	"members.followed",
] as const;

export type ClientProductEventKind =
	(typeof CLIENT_PRODUCT_EVENT_KINDS)[number];
