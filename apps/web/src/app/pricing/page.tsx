import type { PlanTierId } from "@still/plans";
import type { Metadata } from "next";
import Link from "next/link";

import { PricingPageClient } from "@/components/pricing/pricing-page-client";
import { InviteEarnDialogRoot } from "@/components/referrals/invite-earn-dialog-root";
import { APP_NAME } from "@/lib/app-brand";
import { authServer } from "@/lib/auth-server";
import { fetchMeProfile, PROFILE_FETCH_FAILED } from "@/lib/fetch-me-profile";
import { fetchPublicPlans } from "@/lib/fetch-public-plans";
import { buildPatronEntitlementsFromProfile } from "@/lib/patron-entitlements";
import { canManagePolarBilling } from "@/lib/polar-billing";
import { getSiteOrigin } from "@/lib/site-origin";

export const metadata: Metadata = {
	title: "Pricing",
	description: `${APP_NAME} plans — Still (free), Attuned, Immersed, and Devoted. Compare features and subscribe.`,
	alternates: { canonical: `${getSiteOrigin()}/pricing` },
	robots: { index: true, follow: true },
	openGraph: {
		title: `Pricing · ${APP_NAME}`,
		description: `Compare ${APP_NAME} subscription tiers and choose the plan that fits your taste.`,
		url: `${getSiteOrigin()}/pricing`,
		type: "website",
	},
};

export const revalidate = 3600;

/** Always read fresh catalogue — tier purchasability must match Polar env. */
export const dynamic = "force-dynamic";

export default async function PricingPage() {
	const { tiers } = await fetchPublicPlans({ cache: "no-store" });
	const session = await authServer();
	let viewerEffectiveTier: PlanTierId | null = null;
	let canManageBilling = false;
	const isSignedIn = Boolean(session);

	if (session) {
		const profile = await fetchMeProfile();
		if (profile && profile !== PROFILE_FETCH_FAILED) {
			const entitlements = buildPatronEntitlementsFromProfile(profile);
			viewerEffectiveTier = entitlements.effectiveTier;
			canManageBilling = canManagePolarBilling({
				polarSubscriptionId:
					typeof profile.polarSubscriptionId === "string"
						? profile.polarSubscriptionId
						: null,
				subscriptionTier: entitlements.subscriptionTier,
				subscriptionStatus:
					typeof profile.subscriptionStatus === "string"
						? profile.subscriptionStatus
						: null,
			});
		}
	}

	return (
		<div className="min-h-svh bg-background text-foreground">
			<header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-6 sm:px-6 lg:px-8">
				<Link
					href="/"
					className="font-semibold text-foreground text-sm tracking-tight [@media(hover:hover)]:hover:opacity-80"
				>
					{APP_NAME}
				</Link>
				<nav className="flex items-center gap-3 text-sm">
					<Link
						href="/sign-in"
						className="rounded-full px-4 py-2 text-muted-foreground [@media(hover:hover)]:hover:text-foreground"
					>
						Sign in
					</Link>
					<Link
						href="/sign-up"
						className="rounded-full bg-card px-4 py-2 font-medium text-foreground"
					>
						Get started
					</Link>
				</nav>
			</header>

			<main>
				<PricingPageClient
					tiers={tiers}
					viewerEffectiveTier={viewerEffectiveTier}
					canManagePolarBilling={canManageBilling}
					isSignedIn={isSignedIn}
				/>
				{isSignedIn ? <InviteEarnDialogRoot /> : null}
			</main>
		</div>
	);
}
