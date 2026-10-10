import type { Metadata } from "next";
import { headers } from "next/headers";

import { CompanionPage } from "@/components/companion/companion-page";
import { APP_NAME } from "@/lib/app-brand";
import { COMPANION_PAGE_META } from "@/lib/companion-page-copy";
import { getSiteOrigin } from "@/lib/site-origin";

export async function generateMetadata(): Promise<Metadata> {
	const origin = getSiteOrigin(await headers());
	const { title, description } = COMPANION_PAGE_META;

	return {
		title,
		description,
		alternates: { canonical: `${origin}/companion` },
		robots: { index: true, follow: true },
		openGraph: {
			title: `${title} · ${APP_NAME}`,
			description,
			url: `${origin}/companion`,
			type: "website",
		},
	};
}

export default function CompanionRoutePage() {
	return <CompanionPage />;
}
