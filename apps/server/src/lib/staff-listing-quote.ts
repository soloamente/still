import { db, listingQuote } from "@still/db";

import { makeId } from "./cuid";
import {
	assertListingCached,
	parseQuoteSubmissionInput,
	type QuoteSubmissionInput,
} from "./quote-submission";

/** Staff publish — inserts catalog row with `source: staff` (no submission queue). */
export async function createStaffListingQuote(args: {
	input: QuoteSubmissionInput;
}): Promise<{ quoteId: string } | { error: "listing_missing" }> {
	const parsed = parseQuoteSubmissionInput(args.input);
	const cached = await assertListingCached(parsed.scope);
	if (!cached) return { error: "listing_missing" };

	const quoteId = makeId("lquote");
	await db.insert(listingQuote).values({
		id: quoteId,
		movieId: parsed.scope.movieId,
		tvId: parsed.scope.tvId,
		seasonNumber: parsed.scope.seasonNumber,
		episodeNumber: parsed.scope.episodeNumber,
		body: parsed.body,
		speaker: parsed.speaker,
		timestampMs: parsed.timestampMs,
		source: "staff",
		submittedByUserId: null,
		externalProvider: null,
		externalId: null,
		upvoteCount: 0,
	});

	return { quoteId };
}
