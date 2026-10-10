import type { Metadata } from "next";
import { headers } from "next/headers";

import { APP_NAME } from "@/lib/app-brand";
import { getLegalPolicy } from "@/lib/legal-policy-bodies";
import { getSiteOrigin } from "@/lib/site-origin";

export async function generateMetadata(): Promise<Metadata> {
	const origin = getSiteOrigin(await headers());
	const policy = getLegalPolicy("terms");

	return {
		title: policy.title,
		description: policy.description,
		alternates: { canonical: `${origin}/terms` },
		robots: { index: true, follow: true },
		openGraph: {
			title: `${policy.title} · ${APP_NAME}`,
			description: policy.description,
			url: `${origin}/terms`,
			type: "website",
		},
	};
}

/** Body rendered by `(legal)/layout` → LegalDocumentPage. */
export default function TermsPage() {
	return null;
}
