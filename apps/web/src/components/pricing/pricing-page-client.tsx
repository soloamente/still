"use client";

import type { PlanTierId } from "@still/plans";
import { Button } from "@still/ui/components/button";
import { cn } from "@still/ui/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { TextMorph } from "torph/react";

import { PricingComparisonTable } from "@/components/pricing/pricing-comparison-table";
import { PricingDevotedConfirmDialog } from "@/components/pricing/pricing-devoted-confirm-dialog";
import { PricingFeatureIcon } from "@/components/pricing/pricing-feature-icon";
import { PricingOtherPlansSection } from "@/components/pricing/pricing-other-plans-section";
import { SegmentedPillToolbar } from "@/components/ui/segmented-pill-toolbar";
import { authClient } from "@/lib/auth-client";
import { DETAIL_CANVAS_ON_CARD_HOVER_CLASS } from "@/lib/detail-action-motion";
import {
	formatPlanPriceCents,
	type PublicPlanTier,
} from "@/lib/fetch-public-plans";
import { fetchSyncPolarSubscriptionClient } from "@/lib/fetch-sync-polar-subscription-client";
import {
	openPolarCustomerPortal,
	pricingTierCtaLabel,
	startPolarCheckout,
} from "@/lib/polar-checkout";
import {
	incrementalPricingFeatures,
	PRICING_POPULAR_TIER_ID,
	pricingMaxAnnualSavingsPercent,
	pricingTierCheckoutSlug,
	pricingTierHasCheckoutCta,
	pricingTierIncludesFeatureLabel,
} from "@/lib/pricing-tier-display";

type BillingInterval = "month" | "year";

/** Feature list copy — 15px body, 24px line box for icon alignment. */
const PRICING_FEATURE_TEXT_CLASS = "text-[15px] leading-[24px]";

/** Mobbin feature list row — 8px icon gap, 8px vertical rhythm between rows. */
const PRICING_FEATURE_ROW_CLASS = cn(
	PRICING_FEATURE_TEXT_CLASS,
	"flex gap-2 py-2",
);

/** Mobbin primary card CTA — generous vertical padding for tier actions. */
const PRICING_TIER_CTA_CLASS = cn(
	"min-h-12 w-full rounded-full px-4 py-3.5",
	"font-semibold text-[16px] leading-[22px] tracking-[-0.01em]",
);

/** Tagline + rollup — slightly smaller than feature labels. */
const PRICING_BODY_CLASS = "text-[14px] leading-[22px]";

/** 48px figure + 15px billing copy, gap-x-8 row. */
const PRICING_PRICE_PRIMARY_CLASS =
	"font-semibold text-[3rem] leading-none tracking-[-0.04em] tabular-nums";
const PRICING_PRICE_META_CLASS =
	"text-[15px] leading-[18px] text-muted-foreground";

type PricingPageClientProps = {
	tiers: PublicPlanTier[];
	/** Signed-in viewer effective tier — null when signed out or unknown. */
	viewerEffectiveTier?: PlanTierId | null;
	/** When true, paid tier CTAs open Polar portal instead of new checkout. */
	canManagePolarBilling?: boolean;
	isSignedIn?: boolean;
};

function PricingFeatureRow({
	featureKey,
	label,
	comingSoon = false,
}: {
	featureKey: string | null;
	label: string;
	comingSoon?: boolean;
}) {
	return (
		<li className={cn(PRICING_FEATURE_ROW_CLASS, "text-foreground")}>
			{/* Lock icon to the feature title cap-height when a Coming soon line follows. */}
			<span className="flex h-6 shrink-0 items-center">
				<PricingFeatureIcon featureKey={featureKey} />
			</span>
			<span className="min-w-0">
				{label}
				{comingSoon ? (
					<span className="mt-0.5 block text-[13px] text-muted-foreground leading-[18px]">
						Coming soon
					</span>
				) : null}
			</span>
		</li>
	);
}

/** Mobbin rollup row — text-body secondary, no icon. */
function PricingTierIncludesRow({ label }: { label: string }) {
	return (
		<li
			className={cn(
				PRICING_FEATURE_ROW_CLASS,
				"items-center text-muted-foreground",
			)}
		>
			{label}
		</li>
	);
}

function tierPriceBlock(
	tier: PublicPlanTier,
	interval: BillingInterval,
): {
	primary: string;
	perMonth: string | null;
	billedYearly: string | null;
} {
	if (tier.id === "still") {
		return { primary: "Free", perMonth: "forever", billedYearly: null };
	}

	if (interval === "month") {
		return {
			primary:
				tier.priceMonthlyCents != null
					? formatPlanPriceCents(tier.priceMonthlyCents)
					: "—",
			perMonth: "per month",
			billedYearly: null,
		};
	}

	if (tier.priceYearlyCents != null) {
		const monthlyEquivalent = Math.round(tier.priceYearlyCents / 12);
		return {
			primary: formatPlanPriceCents(monthlyEquivalent),
			perMonth: "per month",
			billedYearly: `${formatPlanPriceCents(tier.priceYearlyCents)} billed yearly`,
		};
	}

	return { primary: "—", perMonth: null, billedYearly: null };
}

function PricingCurrentPlanButton() {
	return (
		<Button
			type="button"
			disabled
			className={cn(
				PRICING_TIER_CTA_CLASS,
				"cursor-not-allowed bg-background text-muted-foreground disabled:pointer-events-auto disabled:opacity-100",
			)}
		>
			Your current plan
		</Button>
	);
}

function PricingTierCard({
	tier,
	allTiers,
	interval,
	viewerEffectiveTier,
	canManagePolarBilling,
	onSubscribe,
	checkoutLoadingSlug,
}: {
	tier: PublicPlanTier;
	allTiers: PublicPlanTier[];
	interval: BillingInterval;
	viewerEffectiveTier: PlanTierId | null;
	canManagePolarBilling: boolean;
	onSubscribe: (tier: PublicPlanTier, interval: BillingInterval) => void;
	checkoutLoadingSlug: string | null;
}) {
	const slug = pricingTierCheckoutSlug(tier, interval);
	const hasCheckoutCta = pricingTierHasCheckoutCta(tier);
	const isLoading = slug != null && checkoutLoadingSlug === slug;
	const includesLabel = pricingTierIncludesFeatureLabel(tier, allTiers);
	const displayFeatures = incrementalPricingFeatures(tier, allTiers);
	const price = tierPriceBlock(tier, interval);
	const isPopular = tier.id === PRICING_POPULAR_TIER_ID;
	const isCurrentPlan =
		viewerEffectiveTier != null && tier.id === viewerEffectiveTier;
	const subscribeCtaLabel = canManagePolarBilling
		? pricingTierCtaLabel(tier.id as PlanTierId, viewerEffectiveTier)
		: "Get started";
	const subscribeLoadingLabel = canManagePolarBilling
		? "Opening billing…"
		: "Opening checkout…";

	return (
		<article
			id={tier.id}
			className={cn(
				"flex min-h-full scroll-mt-28 flex-col gap-4 rounded-3xl bg-card p-6",
				isPopular && "bg-foreground/[0.04]",
			)}
		>
			<header className="flex flex-col gap-1">
				<div className="flex flex-wrap items-center gap-2">
					<h2 className="font-sans font-semibold text-xl leading-[26px] tracking-[-0.02em]">
						{tier.name}
					</h2>
					{isPopular ? (
						<span className="rounded-full bg-foreground px-2.5 py-0.5 font-medium text-[10px] text-background uppercase tracking-wide">
							Popular
						</span>
					) : null}
				</div>
				<p
					className={cn(
						PRICING_BODY_CLASS,
						"line-clamp-2 text-muted-foreground",
					)}
				>
					{tier.tagline}
				</p>
			</header>

			<section className="flex items-center gap-2">
				<TextMorph as="p" className={PRICING_PRICE_PRIMARY_CLASS}>
					{price.primary}
				</TextMorph>
				{price.perMonth || price.billedYearly ? (
					<div className="flex flex-col gap-1">
						{price.perMonth ? (
							<p className={PRICING_PRICE_META_CLASS}>{price.perMonth}</p>
						) : null}
						{price.billedYearly ? (
							<TextMorph as="p" className={PRICING_PRICE_META_CLASS}>
								{price.billedYearly}
							</TextMorph>
						) : null}
					</div>
				) : null}
			</section>

			<div className={cn(isCurrentPlan && "cursor-not-allowed")}>
				{isCurrentPlan ? (
					<PricingCurrentPlanButton />
				) : hasCheckoutCta && slug ? (
					<Button
						type="button"
						className={cn(
							PRICING_TIER_CTA_CLASS,
							isPopular &&
								"bg-foreground text-background hover:bg-foreground/90",
						)}
						disabled={isLoading}
						onClick={() => onSubscribe(tier, interval)}
					>
						{isLoading ? subscribeLoadingLabel : subscribeCtaLabel}
					</Button>
				) : tier.id === "still" ? (
					<Link
						href="/sign-up"
						className={cn(
							PRICING_TIER_CTA_CLASS,
							"inline-flex items-center justify-center bg-background px-4 text-foreground transition-colors",
							DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
						)}
					>
						Get started free
					</Link>
				) : null}
			</div>

			<ul className="flex flex-1 flex-col">
				{includesLabel ? (
					<PricingTierIncludesRow label={includesLabel} />
				) : null}
				{displayFeatures.map((feature) => (
					<PricingFeatureRow
						key={`${tier.id}-${feature.key ?? feature.name}`}
						featureKey={feature.key}
						label={feature.name}
						comingSoon={feature.buildStatus === "planned"}
					/>
				))}
			</ul>

			{tier.id === "devoted" ? (
				<p
					className={cn(
						PRICING_BODY_CLASS,
						"text-[13px] text-muted-foreground leading-[18px]",
					)}
				>
					Supporter tier — some Devoted perks are still in development.
				</p>
			) : null}
		</article>
	);
}

/** Public pricing — Mobbin-style tier cards + compare table. */
export function PricingPageClient({
	tiers,
	viewerEffectiveTier = null,
	canManagePolarBilling = false,
	isSignedIn = false,
}: PricingPageClientProps) {
	const router = useRouter();
	const { data: session } = authClient.useSession();
	const [interval, setInterval] = useState<BillingInterval>("year");
	const [checkoutLoadingSlug, setCheckoutLoadingSlug] = useState<string | null>(
		null,
	);
	const [devotedConfirmOpen, setDevotedConfirmOpen] = useState(false);
	const [pendingSubscribe, setPendingSubscribe] = useState<{
		tier: PublicPlanTier;
		interval: BillingInterval;
	} | null>(null);

	const annualSavings = pricingMaxAnnualSavingsPercent(tiers);

	// Portal plan changes may land before webhooks — mirror Polar on pricing page open.
	useEffect(() => {
		if (!isSignedIn || !canManagePolarBilling) return;

		let cancelled = false;

		async function syncBillingFromPolar() {
			try {
				const result = await fetchSyncPolarSubscriptionClient();
				if (cancelled || !result.synced) return;

				const tierChanged = result.tier !== (viewerEffectiveTier ?? "still");
				if (tierChanged) {
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
	}, [canManagePolarBilling, isSignedIn, router, viewerEffectiveTier]);

	const executeSubscribe = useCallback(
		async (tier: PublicPlanTier, billingInterval: BillingInterval) => {
			const slug = pricingTierCheckoutSlug(tier, billingInterval);
			if (!slug) {
				toast.error("Checkout is not available for this plan yet.");
				return;
			}

			if (!session) {
				const returnPath = `/pricing#${tier.id}`;
				router.push(`/sign-in?from=${encodeURIComponent(returnPath)}`);
				return;
			}

			// Existing Polar subscribers change plans in the portal — not a second checkout.
			if (canManagePolarBilling) {
				setCheckoutLoadingSlug(slug);
				try {
					await openPolarCustomerPortal();
				} catch (error) {
					const message =
						error instanceof Error
							? error.message
							: "Could not open billing portal";
					toast.error(message);
				} finally {
					setCheckoutLoadingSlug(null);
				}
				return;
			}

			setCheckoutLoadingSlug(slug);
			try {
				await startPolarCheckout(slug);
			} catch (error) {
				const message =
					error instanceof Error ? error.message : "Checkout failed";
				toast.error(message);
			} finally {
				setCheckoutLoadingSlug(null);
			}
		},
		[canManagePolarBilling, router, session],
	);

	/** Devoted checkout requires an explicit confirmation step first. */
	const requestSubscribe = useCallback(
		(tier: PublicPlanTier, billingInterval: BillingInterval) => {
			if (tier.id === "devoted") {
				setPendingSubscribe({ tier, interval: billingInterval });
				setDevotedConfirmOpen(true);
				return;
			}
			void executeSubscribe(tier, billingInterval);
		},
		[executeSubscribe],
	);

	const handleDevotedConfirm = useCallback(() => {
		if (!pendingSubscribe) return;
		const { tier, interval: billingInterval } = pendingSubscribe;
		setDevotedConfirmOpen(false);
		setPendingSubscribe(null);
		void executeSubscribe(tier, billingInterval);
	}, [executeSubscribe, pendingSubscribe]);

	const handleDevotedConfirmCancel = useCallback(() => {
		if (checkoutLoadingSlug) return;
		setDevotedConfirmOpen(false);
		setPendingSubscribe(null);
	}, [checkoutLoadingSlug]);

	return (
		<div className="mx-auto w-full max-w-[128rem] px-4 pt-10 pb-20 sm:px-6 lg:px-8 2xl:px-10">
			<header className="mx-auto max-w-2xl text-center">
				<h1 className="font-sans font-semibold text-3xl tracking-[-0.03em] sm:text-4xl">
					Choose your depth
				</h1>
				<p className="mt-3 text-balance text-muted-foreground text-sm leading-relaxed sm:text-base">
					Start free on Still. Upgrade when you want richer stats, expression,
					and community presence.
				</p>

				<div className="mt-8 flex flex-col items-center gap-2">
					<SegmentedPillToolbar
						layoutId="pricing-billing-interval"
						aria-label="Billing interval"
						value={interval}
						onChange={setInterval}
						className="bg-card"
						indicatorClassName="bg-background"
						options={[
							{ id: "year", label: "Annual" },
							{ id: "month", label: "Monthly" },
						]}
					/>
					{interval === "year" && annualSavings != null ? (
						<p className="text-muted-foreground text-xs">
							Save up to{" "}
							<span className="font-medium text-foreground tabular-nums">
								{annualSavings}%
							</span>{" "}
							on an annual subscription
						</p>
					) : null}
				</div>
			</header>

			<div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4 xl:gap-5">
				{tiers.map((tier) => (
					<PricingTierCard
						key={tier.id}
						tier={tier}
						allTiers={tiers}
						interval={interval}
						viewerEffectiveTier={viewerEffectiveTier}
						canManagePolarBilling={canManagePolarBilling}
						onSubscribe={requestSubscribe}
						checkoutLoadingSlug={checkoutLoadingSlug}
					/>
				))}
			</div>

			<PricingOtherPlansSection isSignedIn={isSignedIn} />

			<PricingComparisonTable tiers={tiers} interval={interval} />

			<PricingDevotedConfirmDialog
				open={devotedConfirmOpen}
				confirming={checkoutLoadingSlug != null}
				confirmLabel="I am Devoted"
				onCancel={handleDevotedConfirmCancel}
				onConfirm={handleDevotedConfirm}
			/>
		</div>
	);
}
