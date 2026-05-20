import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { serverApi } from "@/lib/server-api";
import { LandingFeatures } from "./_marketing/landing-features";
import { LandingFooter } from "./_marketing/landing-footer";
import { LandingHero } from "./_marketing/landing-hero";
import { LandingNav } from "./_marketing/landing-nav";
import type { LandingPoster } from "./_marketing/landing-preview";
import { LandingPreview } from "./_marketing/landing-preview";
import { LandingSocialProof } from "./_marketing/landing-social-proof";

export const metadata: Metadata = {
	title: "Still — your cinematic memory",
	description:
		"Log every film you watch, rate it, share it. A modern social home for cinephiles — diaries, reviews, lists, chat, and badges.",
};

export const dynamic = "force-dynamic";

export default async function LandingPage() {
	// Signed-in visitors land on /home — keep the marketing surface for logged-out browsers only.
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
				results?: { id: number; title: string; poster_url: string | null }[];
			} | null
		)?.results
			?.slice(0, 18)
			.map((m) => ({
				id: m.id,
				title: m.title,
				posterUrl: m.poster_url,
			})) ?? [];

	return (
		<div className="relative min-h-dvh overflow-x-hidden bg-background text-foreground">
			{/* Quiet cinematic wash — Mobbin clarity on Still canvas, not full theater floor. */}
			<div
				aria-hidden
				className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_50%_at_50%_-20%,rgba(183,89,40,0.12),transparent_55%),radial-gradient(40%_35%_at_100%_80%,rgba(4,65,82,0.14),transparent_50%)]"
			/>

			<main className="relative z-10">
				<LandingNav />
				<LandingHero />
				<LandingSocialProof />
				<LandingPreview posters={posters} />
				<LandingFeatures />
			</main>
			<LandingFooter />
		</div>
	);
}
