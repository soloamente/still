import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { APP_NAME } from "@/lib/app-brand";
import {
	compareSharePath,
	ogComparePath,
	ogImageMetadataFields,
} from "@/lib/og/og-image-metadata";

type Params = { viewer: string; target: string };

/** Crawler-friendly compare link — opens taste overlap on the target profile. */
export async function generateMetadata({
	params,
}: {
	params: Promise<Params>;
}): Promise<Metadata> {
	const { viewer, target } = await params;
	const viewerHandle = viewer.toLowerCase();
	const targetHandle = target.toLowerCase();
	const title = `@${viewerHandle} & @${targetHandle} · Taste comparison`;
	const description = `See how ${viewerHandle} and ${targetHandle} line up on ${APP_NAME}.`;

	return {
		title,
		description,
		alternates: { canonical: compareSharePath(viewerHandle, targetHandle) },
		openGraph: {
			title,
			description,
			url: compareSharePath(viewerHandle, targetHandle),
			type: "website",
			...ogImageMetadataFields(ogComparePath(viewerHandle, targetHandle), title)
				.openGraph,
		},
		twitter: {
			...ogImageMetadataFields(ogComparePath(viewerHandle, targetHandle), title)
				.twitter,
		},
	};
}

export default async function CompareSharePage({
	params,
}: {
	params: Promise<Params>;
}) {
	const { target } = await params;
	redirect(`/profile/${target.toLowerCase()}?tasteCompare=1`);
}
