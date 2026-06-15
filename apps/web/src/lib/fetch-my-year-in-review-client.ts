import { stillApiOrigin } from "@/lib/still-api-origin";
import type { YearInReviewPayload } from "@/lib/year-in-review-types";

/** Browser fetch for Wrapped stats (Achievements eligibility, etc.). */
export async function fetchMyYearInReviewClient(
	year: number,
	signal?: AbortSignal,
): Promise<YearInReviewPayload | null> {
	const res = await fetch(`${stillApiOrigin()}/api/me/year/${year}`, {
		credentials: "include",
		cache: "no-store",
		signal,
	});
	if (!res.ok) return null;
	return (await res.json()) as YearInReviewPayload;
}
