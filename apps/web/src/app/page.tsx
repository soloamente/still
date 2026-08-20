import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { APP_METADATA_DEFAULT_TITLE, APP_NAME } from "@/lib/app-brand";
import { authServer } from "@/lib/auth-server";
import { fetchMeProfile, PROFILE_FETCH_FAILED } from "@/lib/fetch-me-profile";
import {
	OG_HOME_PATH,
	ogImageMetadataFields,
} from "@/lib/og/og-image-metadata";
import { patronNeedsOnboarding } from "@/lib/onboarding-gate";
import { serverApi } from "@/lib/server-api";
import { getSiteOrigin } from "@/lib/site-origin";
import {
	LANDING_METADATA_DESCRIPTION,
	LANDING_SKIP_HREF,
} from "./_marketing/landing-copy";
import { LandingFooter } from "./_marketing/landing-footer";
import { LandingHero } from "./_marketing/landing-hero";
import { pickLandingHeroPosters } from "./_marketing/landing-hero-still";
import { LANDING_SKIP_LINK_CLASS } from "./_marketing/landing-mobbin-hero";
import { LandingNav } from "./_marketing/landing-nav";
import { LandingProduct } from "./_marketing/landing-product";

export async function generateMetadata(): Promise<Metadata> {
	const origin = getSiteOrigin(await headers());

	return {
		title: APP_METADATA_DEFAULT_TITLE,
		description: LANDING_METADATA_DESCRIPTION,
		openGraph: {
			type: "website",
			url: origin,
			siteName: APP_NAME,
			title: APP_METADATA_DEFAULT_TITLE,
			description: LANDING_METADATA_DESCRIPTION,
			...ogImageMetadataFields(OG_HOME_PATH).openGraph,
		},
		twitter: {
			card: "summary_large_image",
			title: APP_METADATA_DEFAULT_TITLE,
			description: LANDING_METADATA_DESCRIPTION,
			...ogImageMetadataFields(OG_HOME_PATH).twitter,
		},
	};
}

export const dynamic = "force-dynamic";

export default async function LandingPage() {
	// Validate the session server-side — a stale cookie after account deletion
	// must not bounce patrons into the authenticated `/home` shell.
	const session = await authServer();
	if (session) {
		const profileResult = await fetchMeProfile();
		if (
			profileResult !== PROFILE_FETCH_FAILED &&
			patronNeedsOnboarding(profileResult)
		) {
			redirect("/onboarding");
		}
		redirect("/home");
	}

	const api = await serverApi();
	const popular = await api.api.movies.popular
		.get()
		.catch(() => ({ data: null }));
	const posters = pickLandingHeroPosters(
		(
			popular.data as {
				results?: { poster_url?: string | null; title?: string | null }[];
			} | null
		)?.results,
	);

	return (
		<div className="min-h-dvh bg-background text-foreground">
			<a href={LANDING_SKIP_HREF} className={LANDING_SKIP_LINK_CLASS}>
				Skip to content
			</a>
			<LandingNav />
			<main id="main-content">
				<LandingHero posters={posters} />
				<LandingProduct />
			</main>
			<LandingFooter />
		</div>
	);
}
