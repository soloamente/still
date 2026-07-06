"use client";

import { type PlanTierId, tierRank } from "@still/plans";
import { Button } from "@still/ui/components/button";
import { cn } from "@still/ui/lib/utils";
import Link from "next/link";
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
import { useSettingsForm } from "@/components/profile/settings-form-context";
import { openInviteEarnDialog } from "@/components/referrals/invite-earn-dialog-root";
import { authClient } from "@/lib/auth-client";
import { fetchSyncPolarCheckoutClient } from "@/lib/fetch-sync-polar-checkout-client";
import { fetchSyncPolarSubscriptionClient } from "@/lib/fetch-sync-polar-subscription-client";

/** Patron-facing tier names for billing copy. */
const TIER_LABELS: Record<PlanTierId, string> = {
	still: "Still",
	attuned: "Attuned",
	immersed: "Immersed",
	devoted: "Devoted",
};

const TIER_TAGLINES: Record<PlanTierId, string> = {
	still: "Quiet foundation — always free",
	attuned: "Know yourself as a watcher",
	immersed: "Expression, social depth, engagement layer",
	devoted: "You helped build this",
};

type SubscriptionStatus = "active" | "past_due" | "canceled" | null;

function statusBadgeCopy(status: SubscriptionStatus): {
	label: string;
	className: string;
} {
	switch (status) {
		case "active":
			return {
				label: "Active",
				className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
			};
		case "past_due":
			return {
				label: "Payment issue",
				className: "bg-desert-orange/15 text-desert-orange",
			};
		case "canceled":
			return {
				label: "Canceled",
				className: "bg-muted text-muted-foreground",
			};
		default:
			return {
				label: "Free",
				className: "bg-background text-muted-foreground",
			};
	}
}

function formatBillingInterval(
	interval: "month" | "year" | null | undefined,
): string | null {
	if (interval === "month") return "Monthly billing";
	if (interval === "year") return "Annual billing";
	return null;
}

function PlanStatusBadge({
	status,
	className,
}: {
	status: SubscriptionStatus;
	className?: string;
}) {
	const copy = statusBadgeCopy(status);
	return (
		<span
			className={cn(
				"inline-flex items-center rounded-full px-2.5 py-1 font-medium text-xs",
				copy.className,
				className,
			)}
		>
			{copy.label}
		</span>
	);
}

/** Settings → Subscription — current tier, Polar portal, upgrade CTAs. */
export function MeSubscriptionSettings() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const { profile, effectiveTier } = useSettingsForm();
	const [portalLoading, setPortalLoading] = useState(false);

	const subscriptionTier = profile.subscriptionTier ?? "still";
	const planOverride = profile.planOverride ?? null;
	const subscriptionStatus = (profile.subscriptionStatus ??
		null) as SubscriptionStatus;
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
		<MeAccountContentReveal className="space-y-0">
			<MeAccountRevealItem>
				<div className="flex flex-col gap-12 pb-4 lg:gap-14">
					<MeSettingsSection
						title="Subscription"
						description="Your Sense plan, billing, and upgrades."
					>
						<MeSettingsPanel className="space-y-5">
							<div className="flex flex-wrap items-start justify-between gap-4">
								<div>
									<p className="font-semibold text-foreground text-xl tracking-tight">
										{TIER_LABELS[effectiveTier]}
									</p>
									<p className="mt-1 max-w-md text-muted-foreground text-sm leading-relaxed">
										{TIER_TAGLINES[effectiveTier]}
									</p>
								</div>
								<PlanStatusBadge status={subscriptionStatus} />
							</div>

							{formatBillingInterval(billingInterval) ? (
								<p className="text-muted-foreground text-sm">
									{formatBillingInterval(billingInterval)}
								</p>
							) : null}

							{planOverride ? (
								<p className="text-muted-foreground text-sm leading-relaxed">
									You have complimentary{" "}
									<span className="font-medium text-foreground">
										{TIER_LABELS[planOverride]}
									</span>{" "}
									access from the Sense team
									{subscriptionTier !== "still"
										? ` — your Polar subscription is ${TIER_LABELS[subscriptionTier]}`
										: ""}
									.
								</p>
							) : null}

							{canManagePolarBilling ? (
								<Button
									type="button"
									variant="secondary"
									className="h-11 rounded-full px-6"
									disabled={portalLoading}
									onClick={handleManageSubscription}
								>
									{portalLoading ? "Opening portal…" : "Manage subscription"}
								</Button>
							) : null}
						</MeSettingsPanel>
					</MeSettingsSection>

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
								className="h-11 shrink-0 rounded-full px-6"
								onClick={openInviteEarnDialog}
							>
								Invite friends
							</Button>
						</MeSettingsPanel>
					</MeSettingsSection>

					{showAttunedUpgrade || showImmersedUpgrade ? (
						<MeSettingsSection
							title="Upgrade"
							description="Unlock more stats, expression, and community features."
						>
							<MeSettingsPanel className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
								{showAttunedUpgrade ? (
									<Link
										href="/pricing#attuned"
										className="inline-flex h-11 items-center justify-center rounded-full bg-card px-6 font-medium text-foreground text-sm transition-colors [@media(hover:hover)]:hover:bg-card/80"
									>
										View Attuned
									</Link>
								) : null}
								{showImmersedUpgrade ? (
									<Link
										href="/pricing#immersed"
										className="inline-flex h-11 items-center justify-center rounded-full bg-foreground px-6 font-medium text-background text-sm transition-colors [@media(hover:hover)]:hover:bg-foreground/90"
									>
										View Immersed
									</Link>
								) : null}
							</MeSettingsPanel>
						</MeSettingsSection>
					) : null}
				</div>
			</MeAccountRevealItem>
		</MeAccountContentReveal>
	);
}
