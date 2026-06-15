import { redirect } from "next/navigation";

import { parseYearInReviewYearParam } from "@/lib/year-in-review-display";
import { yearInReviewPagePath } from "@/lib/year-in-review-share";

/** Legacy `/me/year/*` URLs → top-level `/year/*`. */
export default async function LegacyMeYearRedirect({
	params,
}: {
	params: Promise<{ year: string }>;
}) {
	const { year: yearRaw } = await params;
	const year = parseYearInReviewYearParam(yearRaw);
	if (year == null) redirect("/year");
	redirect(yearInReviewPagePath(year));
}
