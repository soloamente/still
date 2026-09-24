import { db, tasteDismissedTv } from "@still/db";
import { eq } from "drizzle-orm";

import { makeId } from "./cuid";

/** All TV TMDb ids the patron has permanently dismissed from taste rails. */
export async function fetchDismissedTvTmdbIds(
	userId: string,
): Promise<number[]> {
	const rows = await db
		.select({ tvTmdbId: tasteDismissedTv.tvTmdbId })
		.from(tasteDismissedTv)
		.where(eq(tasteDismissedTv.userId, userId));
	return rows.map((row) => row.tvTmdbId);
}

/** Idempotent forever-dismiss row for a TV taste-rail title. */
export async function persistTasteDismissedTv(args: {
	userId: string;
	tvTmdbId: number;
}): Promise<void> {
	await db
		.insert(tasteDismissedTv)
		.values({
			id: makeId("tdt"),
			userId: args.userId,
			tvTmdbId: args.tvTmdbId,
		})
		.onConflictDoNothing();
}
