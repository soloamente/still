"use client";

import { type PlanTierId, tierRank } from "@still/plans";
import { Button } from "@still/ui/components/button";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
	MeAccountContentReveal,
	MeAccountRevealItem,
} from "@/components/profile/me-account-content-reveal";
import {
	MeSettingsPanel,
	MeSettingsSection,
} from "@/components/profile/me-settings-layout";
import { MeSubscriptionIdentityCard } from "@/components/profile/me-subscription-identity-card";
import { useSettingsForm } from "@/components/profile/settings-form-context";
import { openInviteEarnDialog } from "@/components/referrals/invite-earn-dialog-root";
import { authClient } from "@/lib/auth-client";
import { fetchSyncPolarCheckoutClient } from "@/lib/fetch-sync-polar-checkout-client";
import { fetchSyncPolarSubscriptionClient } from "@/lib/fetch-sync-polar-subscription-client";
import type { SubscriptionBillingStatus } from "@/lib/subscription-identity-card";

/** Settings → Subscription — identity card, Polar portal, upgrade CTAs, invite. */
export function MeSubscriptionSettings() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const { profile, effectiveTier, displayName } = useSettingsForm();
	const { data: session } = authClient.useSession();
	const [portalLoading, setPortalLoading] = useState(false);

	const subscriptionTier = (profile.subscriptionTier ?? "still") as PlanTierId;
	const planOverride = (profile.planOverride ?? null) as PlanTierId | null;
	const subscriptionStatus = (profile.subscriptionStatus ??
		null) as SubscriptionBillingStatus;
	const billingInterval = profile.subscriptionInterval ?? null;
	const polarSubscriptionId = profile.polarSubscriptionId?.trim() ?? "";

	// Polar portal applies to paid subscriptions synced from webhooks.
	const canManagePolarBilling =
		polarSubscriptionId.length > 0 ||
		(subscriptionTier !== "still" &&
			(subscriptionStatus === "active" || subscriptionStatus === "past_due"));

	const showAttunedUpgrade = tierRank(effectiveTier) < tierRank("attuned");
	const showImmersedUpgrade = tierRank(effectiveTier) < tierRank("immersed");

	// Portal plan changes may arrive before webhooks — mirror Polar on page open.
	useEffect(() => {
		let cancelled = false;

		async function syncBillingFromPolar() {
			if (polarSubscriptionId.length === 0 && subscriptionTier === "still") {
				return;
			}

			try {
				const result = await fetchSyncPolarSubscriptionClient();
				if (cancelled || !result.synced) return;

				const tierChanged = result.tier !== subscriptionTier;
				const intervalChanged = result.interval !== billingInterval;
				if (tierChanged || intervalChanged) {
					router.refresh();
				}
			} catch {
				// Webhook remains source of truth when sync fails.
			}
		}

		void syncBillingFromPolar();

		return () => {
			cancelled = true;
		};
	}, [billingInterval, polarSubscriptionId, router, subscriptionTier]);

	useEffect(() => {
		const checkoutId = searchParams.get("checkout_id")?.trim() ?? "";
		const checkoutSuccess = searchParams.get("checkout") === "success";

		// Success dialog on /home handles checkout=success — keep sync-only path here.
		if (checkoutSuccess) {
			const url = new URL(window.location.href);
			url.searchParams.delete("checkout");
			url.searchParams.delete("checkout_id");
			router.replace(url.pathname + url.search, { scroll: false });
			return;
		}

		async function finalizeCheckoutReturn() {
			if (!checkoutId) return;

			try {
				const result = await fetchSyncPolarCheckoutClient(checkoutId);
				if (result.synced) {
					router.refresh();
				}
			} catch {
				// Webhook remains source of truth when sync fails.
			}

			const url = new URL(window.location.href);
			url.searchParams.delete("checkout_id");
			router.replace(url.pathname + url.search, { scroll: false });
		}

		void finalizeCheckoutReturn();
	}, [router, searchParams]);

	const handleManageSubscription = async () => {
		if (portalLoading) return;
		setPortalLoading(true);
		try {
			await authClient.customer.portal();
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: "Could not open billing portal";
			toast.error(message);
		} finally {
			setPortalLoading(false);
		}
	};

	return (
		<MeAccountContentReveal className="flex min-h-0 flex-1 flex-col space-y-0">
			<MeAccountRevealItem className="flex min-h-0 flex-1 flex-col">
				<div className="flex min-h-0 flex-1 flex-col gap-12 pb-4 lg:gap-14 [&>*:first-child]:min-h-0 [&>*:first-child]:flex-1 [&>*:not(:first-child)]:flex-none">
					{/* Identity stage replaces the old plan-status + Upgrade panels. */}
					<MeSubscriptionIdentityCard
						handle={profile.handle}
						displayName={displayName}
						avatarUrl={session?.user?.image ?? null}
						effectiveTier={effectiveTier}
						subscriptionTier={subscriptionTier}
						planOverride={planOverride}
						subscriptionStatus={subscriptionStatus}
						billingInterval={billingInterval}
						canManagePolarBilling={canManagePolarBilling}
						portalLoading={portalLoading}
						onManage={() => void handleManageSubscription()}
						showAttunedUpgrade={showAttunedUpgrade}
						showImmersedUpgrade={showImmersedUpgrade}
					/>

					<MeSettingsSection
						title="Invite & earn"
						description="Share Sense with friends — they get 10% off their first paid plan and you unlock milestone rewards."
					>
						<MeSettingsPanel className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
							<p className="max-w-md text-muted-foreground text-sm leading-relaxed">
								Copy your personal link and track Scout badges, subscription
								months, and profile flair as invites qualify.
							</p>
							<Button
								type="button"
								variant="secondary"
								className="h-11 shrink-0 rounded-full px-6 transition-transform duration-150 ease-out active:scale-[0.96] motion-reduce:active:scale-100"
								onClick={openInviteEarnDialog}
							>
								Invite friends
							</Button>
						</MeSettingsPanel>
					</MeSettingsSection>
				</div>
			</MeAccountRevealItem>
		</MeAccountContentReveal>
	);
}
