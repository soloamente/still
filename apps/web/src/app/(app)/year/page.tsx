import { redirect } from "next/navigation";

import {
	currentWrappedYear,
	yearInReviewPagePath,
} from "@/lib/year-in-review-share";

export const dynamic = "force-dynamic";

/** Wrapped lobby — always opens the current UTC calendar year. */
export default function YearInReviewLobbyPage() {
	redirect(yearInReviewPagePath(currentWrappedYear()));
}
