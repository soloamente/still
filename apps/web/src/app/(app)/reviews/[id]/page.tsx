import { redirect } from "next/navigation";

import { buildMovieReviewHref } from "@/lib/review-deep-link";
import { serverApi } from "@/lib/server-api";

export const dynamic = "force-dynamic";

type ReviewDetail = {
	review: { id: string; movieId: number };
};

/**
 * Legacy `/reviews/:id` URLs (old notification rows) → movie detail + review sheet.
 */
export default async function ReviewRedirectPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	const api = await serverApi();
	const res = await api.api.reviews({ id }).get();
	const detail = res.data as ReviewDetail | null;
	const movieId = detail?.review?.movieId;
	if (!detail?.review || movieId == null || !Number.isFinite(movieId)) {
		redirect("/home");
	}
	redirect(buildMovieReviewHref(movieId, id));
}
