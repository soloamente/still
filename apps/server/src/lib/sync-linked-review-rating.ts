import { db, review } from "@still/db";
import { eq } from "drizzle-orm";

/** Keep denormalized review.rating aligned when patron edits diary score. */
export async function syncLinkedReviewRatingFromLog(
	logId: string,
	rating: number | null,
): Promise<void> {
	await db.update(review).set({ rating }).where(eq(review.logId, logId));
}
