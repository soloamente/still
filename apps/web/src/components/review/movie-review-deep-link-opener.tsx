"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

import {
	type ReviewPreview,
	useReviewDetail,
} from "@/components/review/review-detail-sheet";
import {
	MOVIE_REVIEW_COMMENT_SEARCH_PARAM,
	MOVIE_REVIEW_SEARCH_PARAM,
} from "@/lib/review-deep-link";

function placeholderPreview(reviewId: string): ReviewPreview {
	return {
		id: reviewId,
		title: null,
		body: "",
		rating: null,
		likesCount: 0,
		commentsCount: 0,
		publishedAt: new Date().toISOString(),
	};
}

/**
 * On movie detail, `?review=` opens the review reader sheet (notification deep links).
 */
export function MovieReviewDeepLinkOpener() {
	const searchParams = useSearchParams();
	const pathname = usePathname();
	const router = useRouter();
	const openReviewDetail = useReviewDetail((s) => s.open);
	const openedForRef = useRef<string | null>(null);

	const reviewId = searchParams.get(MOVIE_REVIEW_SEARCH_PARAM)?.trim() ?? "";
	const commentId =
		searchParams.get(MOVIE_REVIEW_COMMENT_SEARCH_PARAM)?.trim() ?? "";

	useEffect(() => {
		if (!reviewId) {
			openedForRef.current = null;
			return;
		}
		const openKey = commentId ? `${reviewId}:${commentId}` : reviewId;
		if (openedForRef.current === openKey) return;
		openedForRef.current = openKey;

		openReviewDetail({
			reviewId,
			preview: placeholderPreview(reviewId),
			scrollToCommentId: commentId || undefined,
		});

		const params = new URLSearchParams(searchParams.toString());
		params.delete(MOVIE_REVIEW_SEARCH_PARAM);
		params.delete(MOVIE_REVIEW_COMMENT_SEARCH_PARAM);
		const next = params.toString();
		router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
	}, [reviewId, commentId, openReviewDetail, pathname, router, searchParams]);

	return null;
}
