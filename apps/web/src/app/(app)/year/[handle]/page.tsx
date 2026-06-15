import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { YearInReviewPageContent } from "@/components/achievements/year-in-review-page-content";
import { APP_NAME } from "@/lib/app-brand";
import { fetchMeProfile, PROFILE_FETCH_FAILED } from "@/lib/fetch-me-profile";
import { fetchMyYearInReviewServer } from "@/lib/fetch-year-in-review-server";
import {
	ogImageMetadataFields,
	ogYearInReviewPath,
} from "@/lib/og/og-image-metadata";
import { parseYearInReviewYearParam } from "@/lib/year-in-review-display";
import {
	yearInReviewPagePath,
	yearInReviewSharePath,
} from "@/lib/year-in-review-share";

export const dynamic = "force-dynamic";

type Params = { handle: string };

/**
 * Signed-in Wrapped at `/year/2026`.
 *
 * Next.js requires the same dynamic param name as the public share route
 * (`/year/[handle]/[year]`). A single segment that parses as a calendar year
 * is the patron view; handles like `adgv` need the second segment on the
 * share route instead.
 */
function yearFromRouteSegment(segment: string): number | null {
	return parseYearInReviewYearParam(segment);
}

export async function generateMetadata({
	params,
}: {
	params: Promise<Params>;
}): Promise<Metadata> {
	const { handle: segment } = await params;
	const year = yearFromRouteSegment(segment);
	if (year == null) return { title: "Year in review" };

	const profile = await fetchMeProfile();
	const handle = profile === PROFILE_FETCH_FAILED ? null : profile?.handle;
	if (!handle) {
		return { title: `${year} in film · ${APP_NAME}` };
	}

	const title = `Your ${year} in film · ${APP_NAME}`;
	const description = `Diary stats and top picks from ${year} on ${APP_NAME}.`;
	const sharePath = yearInReviewSharePath(handle, year);

	return {
		title,
		description,
		alternates: { canonical: yearInReviewPagePath(year) },
		openGraph: {
			title,
			description,
			url: sharePath,
			type: "website",
			...ogImageMetadataFields(ogYearInReviewPath(handle, year), title)
				.openGraph,
		},
		twitter: {
			...ogImageMetadataFields(ogYearInReviewPath(handle, year), title).twitter,
		},
	};
}

export default async function YearInReviewPage({
	params,
}: {
	params: Promise<Params>;
}) {
	const { handle: segment } = await params;
	const year = yearFromRouteSegment(segment);
	if (year == null) notFound();

	const [profileResult, payload] = await Promise.all([
		fetchMeProfile(),
		fetchMyYearInReviewServer(year),
	]);
	if (!payload) notFound();
	const profile = profileResult === PROFILE_FETCH_FAILED ? null : profileResult;
	if (!profile?.handle) notFound();

	return (
		<YearInReviewPageContent
			displayName={profile.displayName?.trim() || profile.handle}
			handle={profile.handle}
			payload={payload}
		/>
	);
}
