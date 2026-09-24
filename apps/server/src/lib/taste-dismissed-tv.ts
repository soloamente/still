import { persistTasteDismissedTv } from "./taste-dismissed-tv-store";

export { fetchDismissedTvTmdbIds } from "./taste-dismissed-tv-store";

/**
 * Persist a forever TV dismiss. Replacement stays null until Task 5
 * fills it from the TV scorer — never write movie dismissals here.
 */
export async function dismissTasteTv(args: {
	userId: string;
	tvTmdbId: number;
	excludeTmdbIds?: number[];
}): Promise<{ dismissedTmdbId: number; replacement: null }> {
	await persistTasteDismissedTv({
		userId: args.userId,
		tvTmdbId: args.tvTmdbId,
	});

	return {
		dismissedTmdbId: args.tvTmdbId,
		replacement: null,
	};
}
