"use client";

import { useProfileActivitySignatureInfinite } from "@/lib/use-profile-activity-signature-infinite";

/**
 * Loads the patron diary heatmap for profile display (ST.2).
 * @deprecated Prefer `useProfileActivitySignatureInfinite` for paginated scroll.
 */
export function useProfileActivitySignature(handle: string) {
	const { weeks, totals, loadingInitial } =
		useProfileActivitySignatureInfinite(handle);

	return {
		signature:
			weeks.length > 0
				? {
						weeks,
						totalDaysActive: totals.totalDaysActive,
						totalLogs: totals.totalLogs,
					}
				: null,
		loading: loadingInitial,
	};
}
