import { pgEnum } from "drizzle-orm/pg-core";

/** Who can see a review or diary log. Tiers nest: friends ⊆ followers ⊆ public. */
export const contentVisibility = pgEnum("content_visibility", [
	"public",
	"followers",
	"friends",
	"private",
]);

export type ContentVisibility = (typeof contentVisibility.enumValues)[number];
