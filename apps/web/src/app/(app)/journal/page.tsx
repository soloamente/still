import type { Metadata } from "next";

import { JournalCatalogueGrid } from "@/components/journal/journal-catalogue-grid";
import { APP_NAME } from "@/lib/app-brand";
import { fetchJournalPosts } from "@/lib/fetch-journal";
import {
	OG_DEFAULT_PATH,
	ogImageMetadataFields,
} from "@/lib/og/og-image-metadata";

export const revalidate = 300;

export const metadata: Metadata = {
	title: "Journal",
	description: `Essays and editorial from ${APP_NAME} on film, TV, and taste.`,
	alternates: { canonical: "/journal" },
	robots: { index: true, follow: true },
	openGraph: {
		title: `Journal — ${APP_NAME}`,
		description: `Essays and editorial from ${APP_NAME} on film, TV, and taste.`,
		url: "/journal",
		type: "website",
		...ogImageMetadataFields(OG_DEFAULT_PATH, `${APP_NAME} Journal`).openGraph,
	},
	twitter: {
		title: `Journal — ${APP_NAME}`,
		...ogImageMetadataFields(OG_DEFAULT_PATH, `${APP_NAME} Journal`).twitter,
	},
};

export default async function JournalIndexPage() {
	const data = await fetchJournalPosts({ page: 1, limit: 24, revalidate: 300 });
	const items = data?.items ?? [];

	return (
		<div className="flex min-h-0 flex-1 flex-col gap-4 pb-2">
			<header className="space-y-2 px-0.5 text-center">
				<h1 className="text-balance font-semibold text-2xl tracking-tight sm:text-3xl">
					Journal
				</h1>
				<p className="mx-auto max-w-md text-pretty text-muted-foreground text-sm leading-relaxed">
					Longer reads from the {APP_NAME} team — culture, craft, and why taste
					matters.
				</p>
			</header>

			{items.length === 0 ? (
				<div className="flex min-h-[40vh] flex-1 flex-col items-center justify-center px-4 py-12 text-center">
					<p className="text-muted-foreground text-sm">
						Published articles will appear here soon.
					</p>
				</div>
			) : (
				<JournalCatalogueGrid posts={items} />
			)}
		</div>
	);
}
