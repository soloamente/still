import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { APP_NAME } from "@/lib/app-brand";
import { authServer } from "@/lib/auth-server";
import { fetchMeProfile, PROFILE_FETCH_FAILED } from "@/lib/fetch-me-profile";
import { fetchYearInReviewForHandleServer } from "@/lib/fetch-year-in-review-server";
import {
	ogImageMetadataFields,
	ogYearInReviewPath,
} from "@/lib/og/og-image-metadata";
import { parseYearInReviewYearParam } from "@/lib/year-in-review-display";
import {
	yearInReviewPagePath,
	yearInReviewSharePath,
} from "@/lib/year-in-review-share";

type Params = { handle: string; year: string };

/** Crawler-friendly Wrapped share link — redirects humans to the right surface. */
export async function generateMetadata({
	params,
}: {
	params: Promise<Params>;
}): Promise<Metadata> {
	const { handle, year: yearRaw } = await params;
	const normalized = handle.toLowerCase();
	const year = parseYearInReviewYearParam(yearRaw);
	if (year == null) return { title: "Year in review" };

	const title = `@${normalized} · ${year} in film · ${APP_NAME}`;
	const description = `Diary stats and top picks from ${year} on ${APP_NAME}.`;
	const sharePath = yearInReviewSharePath(normalized, year);

	return {
		title,
		description,
		alternates: { canonical: sharePath },
		openGraph: {
			title,
			description,
			url: sharePath,
			type: "website",
			...ogImageMetadataFields(ogYearInReviewPath(normalized, year), title)
				.openGraph,
		},
		twitter: {
			...ogImageMetadataFields(ogYearInReviewPath(normalized, year), title)
				.twitter,
		},
	};
}

export default async function YearInReviewSharePage({
	params,
}: {
	params: Promise<Params>;
}) {
	const { handle, year: yearRaw } = await params;
	const normalized = handle.toLowerCase();
	const year = parseYearInReviewYearParam(yearRaw);
	if (year == null) notFound();

	const payload = await fetchYearInReviewForHandleServer(normalized, year);
	if (!payload) notFound();

	const session = await authServer();
	if (session) {
		const meResult = await fetchMeProfile();
		const me = meResult === PROFILE_FETCH_FAILED ? null : meResult;
		if (me?.handle?.toLowerCase() === normalized) {
			redirect(yearInReviewPagePath(year));
		}
	}

	redirect(`/profile/${normalized}`);
}
