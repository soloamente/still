"use client";

import { cn } from "@still/ui/lib/utils";

import { PricingCheckIcon } from "@/components/pricing/pricing-check-icon";
import {
	formatPlanPriceCents,
	type PublicPlanFeature,
	type PublicPlanTier,
} from "@/lib/fetch-public-plans";
import {
	buildPricingComparisonSections,
	PRICING_POPULAR_TIER_ID,
	PRICING_TIER_ORDER,
	tierIncludesFeature,
} from "@/lib/pricing-tier-display";

type BillingInterval = "month" | "year";

function tierColumnPrice(
	tier: PublicPlanTier,
	interval: BillingInterval,
): string {
	if (tier.id === "still") return "Free";
	if (interval === "month") {
		return tier.priceMonthlyCents != null
			? `${formatPlanPriceCents(tier.priceMonthlyCents)}/mo`
			: "—";
	}
	return tier.priceYearlyCents != null
		? `${formatPlanPriceCents(tier.priceYearlyCents)}/yr`
		: "—";
}

function ComparisonCell({
	included,
	planned,
}: {
	included: boolean;
	planned: boolean;
}) {
	if (!included) {
		return <span className="text-muted-foreground/40">—</span>;
	}
	return (
		<span className="inline-flex items-center justify-center text-foreground">
			<PricingCheckIcon className="size-5" />
			{planned ? (
				<span className="sr-only">Included — coming soon</span>
			) : (
				<span className="sr-only">Included</span>
			)}
		</span>
	);
}

/** Mobbin-style "Compare plans & features" matrix below tier cards. */
export function PricingComparisonTable({
	tiers,
	interval,
}: {
	tiers: PublicPlanTier[];
	interval: BillingInterval;
}) {
	const sections = buildPricingComparisonSections(tiers);
	const orderedTiers = PRICING_TIER_ORDER.map((id) =>
		tiers.find((tier) => tier.id === id),
	).filter((tier): tier is PublicPlanTier => tier != null);

	return (
		<section
			id="compare"
			className="mt-20 scroll-mt-28 border-foreground/10 border-t pt-16"
			aria-labelledby="pricing-compare-heading"
		>
			<h2
				id="pricing-compare-heading"
				className="text-center font-sans font-semibold text-2xl tracking-[-0.03em] sm:text-3xl"
			>
				Compare plans & features
			</h2>

			<div className="mt-8 overflow-x-auto">
				<table className="w-full min-w-[720px] border-collapse text-left text-sm">
					<thead>
						<tr className="border-foreground/10 border-b">
							<th scope="col" className="min-w-[12rem] py-4 pr-4 font-medium">
								<span className="sr-only">Feature</span>
							</th>
							{orderedTiers.map((tier) => (
								<th
									key={tier.id}
									scope="col"
									className={cn(
										"min-w-[8.5rem] px-3 py-4 text-center font-medium",
										tier.id === PRICING_POPULAR_TIER_ID &&
											"rounded-t-2xl bg-foreground/[0.04]",
									)}
								>
									<div className="flex flex-col items-center gap-1">
										<span className="inline-flex items-center gap-2 font-semibold text-foreground">
											{tier.name}
											{tier.id === PRICING_POPULAR_TIER_ID ? (
												<span className="rounded-full bg-foreground px-2 py-0.5 font-medium text-[10px] text-background uppercase tracking-wide">
													Popular
												</span>
											) : null}
										</span>
										<span className="font-normal text-muted-foreground text-xs tabular-nums">
											{tierColumnPrice(tier, interval)}
										</span>
									</div>
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{sections.map((section) => (
							<SectionRows
								key={section.id}
								sectionLabel={section.label}
								features={section.features}
								tiers={orderedTiers}
								allTiers={tiers}
							/>
						))}
					</tbody>
				</table>
			</div>
		</section>
	);
}

function SectionRows({
	sectionLabel,
	features,
	tiers,
	allTiers,
}: {
	sectionLabel: string;
	features: PublicPlanFeature[];
	tiers: PublicPlanTier[];
	allTiers: PublicPlanTier[];
}) {
	return (
		<>
			<tr className="border-foreground/10 border-b bg-foreground/[0.03]">
				<th
					colSpan={tiers.length + 1}
					scope="colgroup"
					className="px-0 py-3 font-semibold text-foreground text-xs uppercase tracking-wide"
				>
					{sectionLabel}
				</th>
			</tr>
			{features.map((feature) => (
				<tr
					key={feature.key ?? feature.name}
					className="border-foreground/10 border-b"
				>
					<th
						scope="row"
						className="py-3.5 pr-4 font-normal text-foreground leading-snug"
					>
						{feature.name}
						{feature.buildStatus === "planned" ? (
							<span className="mt-0.5 block text-muted-foreground text-xs">
								Coming soon
							</span>
						) : null}
					</th>
					{tiers.map((tier) => (
						<td
							key={`${tier.id}-${feature.key ?? feature.name}`}
							className={cn(
								"px-3 py-3.5 text-center",
								tier.id === PRICING_POPULAR_TIER_ID && "bg-foreground/[0.04]",
							)}
						>
							<ComparisonCell
								included={tierIncludesFeature(
									tier.id as (typeof PRICING_TIER_ORDER)[number],
									feature,
									allTiers,
								)}
								planned={feature.buildStatus === "planned"}
							/>
						</td>
					))}
				</tr>
			))}
		</>
	);
}
