"use client";

import { cn } from "@still/ui/lib/utils";
import { useRef } from "react";

import { PricingCheckIcon } from "@/components/pricing/pricing-check-icon";
import { PricingFeatureIcon } from "@/components/pricing/pricing-feature-icon";
import {
	formatPlanPriceCents,
	type PublicPlanFeature,
	type PublicPlanTier,
} from "@/lib/fetch-public-plans";
import { HOME_LOBBY_SCROLL_FADE_RIGHT_CLASSNAME } from "@/lib/home-lobby-catalogue-layout";
import {
	buildPricingComparisonSections,
	PRICING_POPULAR_TIER_ID,
	PRICING_TIER_ORDER,
	tierIncludesFeature,
} from "@/lib/pricing-tier-display";
import { useTextStateSwap } from "@/lib/text-state-swap";
import { useHorizontalScrollFades } from "@/lib/use-horizontal-scroll-fades";

type BillingInterval = "month" | "year";

/** Sticky feature names — `bg-card` so sliding tier cells pass underneath without a hairline. */
const STICKY_FEATURE_CELL_CLASSNAME = cn(
	"sticky left-0 z-[1] bg-card",
	// Fade instead of a scroll border when the matrix is panned.
	"after:pointer-events-none after:absolute after:inset-y-0 after:left-full after:w-6 after:bg-linear-to-r after:from-0% after:from-card after:via-35% after:via-card/50 after:to-card/0 after:opacity-0 after:transition-opacity after:duration-200 after:ease-out after:content-[''] motion-reduce:after:transition-none",
	"group-data-[scrolled-start]/compare:after:opacity-100",
);

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

function ComparisonTierPrice({
	tier,
	interval,
}: {
	tier: PublicPlanTier;
	interval: BillingInterval;
}) {
	const label = tierColumnPrice(tier, interval);
	const labelRef = useTextStateSwap(label);
	return (
		<span
			ref={labelRef}
			className="t-text-swap font-normal text-muted-foreground text-xs tabular-nums"
		>
			{label}
		</span>
	);
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

function popularColumnClass(tierId: string): string | false {
	return tierId === PRICING_POPULAR_TIER_ID && "bg-background";
}

/** Header tier cells — rounded top so the Popular highlight (and first/last caps) aren’t square. */
const TIER_HEADER_CELL_CLASSNAME =
	"min-w-[8.5rem] rounded-t-2xl px-3 py-4 text-center font-medium";

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
	const scrollRef = useRef<HTMLDivElement>(null);
	const { showStartFade, showEndFade } = useHorizontalScrollFades(
		scrollRef,
		true,
		`${orderedTiers.map((tier) => tier.id).join(":")}:${interval}`,
	);

	return (
		<section
			id="compare"
			className="mt-20 scroll-mt-28"
			aria-labelledby="pricing-compare-heading"
		>
			<h2
				id="pricing-compare-heading"
				className="text-center font-sans font-semibold text-2xl tracking-[-0.03em] sm:text-3xl"
			>
				Compare plans & features
			</h2>

			{/* Raised card — grouping by surface, not a section rule. Inner radius is concentric (24 − 8). */}
			<div
				className="group/compare mt-8 rounded-mobbin-3xl bg-card p-2 sm:p-3"
				data-scrolled-start={showStartFade ? "" : undefined}
			>
				<div className="relative min-w-0 overflow-hidden rounded-2xl">
					<div
						aria-hidden
						className={cn(
							HOME_LOBBY_SCROLL_FADE_RIGHT_CLASSNAME,
							"z-20 transition-opacity duration-200 motion-reduce:transition-none",
							showEndFade ? "opacity-100" : "opacity-0",
						)}
					/>
					{/*
					 * No `data-lenis-prevent-wheel` — this matrix is tall and rarely overflows
					 * vertically. Preventing the wheel here ate page scroll on hover.
					 * Lenis `allowNestedScroll` still lets a narrow viewport pan sideways.
					 */}
					<div
						ref={scrollRef}
						className="scrollbar-none overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden"
					>
						{/* `separate` + 0 spacing so `rounded-t-2xl` on header cells actually paints. */}
						<table className="w-full min-w-[720px] border-separate border-spacing-0 text-left text-sm">
							<thead>
								<tr>
									<th
										scope="col"
										className={cn(
											STICKY_FEATURE_CELL_CLASSNAME,
											"relative min-w-[12rem] rounded-tl-2xl py-4 pr-4 font-medium",
										)}
									>
										<span className="sr-only">Feature</span>
									</th>
									{orderedTiers.map((tier) => (
										<th
											key={tier.id}
											scope="col"
											className={cn(
												TIER_HEADER_CELL_CLASSNAME,
												popularColumnClass(tier.id),
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
												<ComparisonTierPrice tier={tier} interval={interval} />
											</div>
										</th>
									))}
								</tr>
							</thead>
							<tbody>
								{sections.map((section, sectionIndex) => (
									<SectionRows
										key={section.id}
										sectionLabel={section.label}
										features={section.features}
										tiers={orderedTiers}
										allTiers={tiers}
										isFirstSection={sectionIndex === 0}
										isLastSection={sectionIndex === sections.length - 1}
									/>
								))}
							</tbody>
						</table>
					</div>
				</div>
			</div>
		</section>
	);
}

function SectionRows({
	sectionLabel,
	features,
	tiers,
	allTiers,
	isFirstSection,
	isLastSection,
}: {
	sectionLabel: string;
	features: PublicPlanFeature[];
	tiers: PublicPlanTier[];
	allTiers: PublicPlanTier[];
	isFirstSection: boolean;
	isLastSection: boolean;
}) {
	return (
		<>
			<tr>
				<th
					scope="colgroup"
					className={cn(
						STICKY_FEATURE_CELL_CLASSNAME,
						"relative px-0 py-3 font-semibold text-foreground text-xs uppercase tracking-wide",
						!isFirstSection && "pt-8",
					)}
				>
					{sectionLabel}
				</th>
				{tiers.map((tier) => (
					<td
						key={`${tier.id}-${sectionLabel}`}
						className={cn(
							popularColumnClass(tier.id),
							!isFirstSection && "pt-8",
						)}
					/>
				))}
			</tr>
			{features.map((feature, featureIndex) => {
				const isLastRow = isLastSection && featureIndex === features.length - 1;
				return (
					<tr key={feature.key ?? feature.name}>
						<th
							scope="row"
							className={cn(
								STICKY_FEATURE_CELL_CLASSNAME,
								"relative py-3.5 pr-4 font-normal text-foreground leading-snug",
								isLastRow && "rounded-bl-2xl",
							)}
						>
							{/* Same catalogue glyphs as the tier cards — lock to the title line. */}
							<span className="flex items-start gap-2">
								<span className="flex h-6 shrink-0 items-center">
									<PricingFeatureIcon featureKey={feature.key} />
								</span>
								<span className="min-w-0">
									{feature.name}
									{feature.buildStatus === "planned" ? (
										<span className="mt-0.5 block text-muted-foreground text-xs">
											Coming soon
										</span>
									) : null}
								</span>
							</span>
						</th>
						{tiers.map((tier) => (
							<td
								key={`${tier.id}-${feature.key ?? feature.name}`}
								className={cn(
									"px-3 py-3.5 text-center",
									popularColumnClass(tier.id),
									isLastRow && "rounded-b-2xl",
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
				);
			})}
		</>
	);
}
