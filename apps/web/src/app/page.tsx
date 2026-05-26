import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { serverApi } from "@/lib/server-api";
import { LandingFeatures } from "./_marketing/landing-features";
import { LandingFooter } from "./_marketing/landing-footer";
import { LandingHero } from "./_marketing/landing-hero";
import { LandingIntro } from "./_marketing/landing-intro";
import { LandingNav } from "./_marketing/landing-nav";
import type { LandingPoster } from "./_marketing/landing-poster";
import { LandingPreview } from "./_marketing/landing-preview";
import { LandingScrollScenes } from "./_marketing/landing-scroll-scenes";
import { LandingWorkStack } from "./_marketing/landing-work-stack";

export const metadata: Metadata = {
	title: "Still — your cinematic memory",
	description:
		"Log every film you watch, rate it, share it. A modern social home for cinephiles — diaries, reviews, lists, and community.",
};

export const dynamic = "force-dynamic";

export default async function LandingPage() {
	const cookieStore = await cookies();
	const hasSession = [
		"better-auth.session_token",
		"__Secure-better-auth.session_token",
	].some((n) => cookieStore.has(n));
	if (hasSession) redirect("/home");

	const api = await serverApi();
	const popular = await api.api.movies.popular
		.get()
		.catch(() => ({ data: null }));
	const posters: LandingPoster[] =
		(
			popular.data as {
				results?: {
					id: number;
					title: string;
					poster_url: string | null;
					backdrop_url: string | null;
				}[];
			} | null
		)?.results
			?.slice(0, 18)
			.map((m) => ({
				id: m.id,
				title: m.title,
				posterUrl: m.poster_url,
				backdropUrl: m.backdrop_url,
			})) ?? [];

	return (
		<div className="min-h-dvh bg-background text-foreground">
			<LandingNav />

			<main>
				<LandingHero posters={posters} />
				<LandingIntro />
				<LandingWorkStack posters={posters} />
				<LandingScrollScenes posters={posters} />
				<LandingFeatures />
				<LandingPreview posters={posters} />
			</main>
			<LandingFooter />
		</div>
	);
}
