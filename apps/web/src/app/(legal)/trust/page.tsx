import type { Metadata } from "next";
import { headers } from "next/headers";

import { APP_NAME } from "@/lib/app-brand";
import { getSiteOrigin } from "@/lib/site-origin";

export async function generateMetadata(): Promise<Metadata> {
	const origin = getSiteOrigin(await headers());
	const title = "Trust Center";
	const description = `Vendors and subprocessors that may handle personal data for ${APP_NAME}.`;

	return {
		title,
		description,
		alternates: { canonical: `${origin}/trust` },
		robots: { index: true, follow: true },
		openGraph: {
			title: `${title} · ${APP_NAME}`,
			description,
			url: `${origin}/trust`,
			type: "website",
		},
	};
}

/** Body rendered by `(legal)/layout` → LegalDocumentPage. */
export default function TrustPage() {
	return null;
}
