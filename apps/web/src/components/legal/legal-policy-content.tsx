"use client";

import { cn } from "@still/ui/lib/utils";

import { legalSectionAnchorId } from "@/lib/legal-format";
import { renderLegalInlineLinks } from "@/lib/legal-inline-links";
import {
	getLegalPolicy,
	type LegalPolicyId,
	type LegalPolicySection,
} from "@/lib/legal-policy-bodies";
import { isLegalTraderIncomplete, LEGAL_TRADER } from "@/lib/legal-trader";
import { MOVIE_DETAIL_SECTION_SCROLL_MARGIN_CLASS } from "@/lib/movie-detail-sections";

/**
 * Shared policy prose used by the Mobbin-style document page and the auth Vaul sheet.
 * `variant="page"` = large hero + reading column; `drawer` = compact sheet density.
 */
/** Opacity pulse after a right-rail jump: focus one section, dim the rest. */
const SPOTLIGHT_TRANSITION_CLASS =
	"transition-opacity duration-300 ease-out motion-reduce:transition-none";

export function LegalPolicyContent({
	policyId,
	variant = "page",
	/** When false, the parent owns the H1 (document page hero). */
	showTitle = true,
	/** Section anchor id currently spotlighted from the on-page nav (page only). */
	spotlightSectionId = null,
}: {
	policyId: LegalPolicyId;
	variant?: "page" | "drawer";
	showTitle?: boolean;
	spotlightSectionId?: string | null;
}) {
	const policy = getLegalPolicy(policyId);
	const trader = LEGAL_TRADER;
	const showPlaceholderNote = isLegalTraderIncomplete(trader);
	const isPage = variant === "page";
	const spotlighting = isPage && Boolean(spotlightSectionId);

	return (
		<div
			className={cn(
				isPage ? "mx-auto w-full max-w-[52.125rem]" : "mx-auto w-full max-w-xl",
			)}
		>
			{showTitle ? (
				isPage ? (
					<header className="text-center">
						<h1 className="text-balance font-sans font-semibold text-[clamp(2.75rem,6vw,5rem)] text-foreground leading-none tracking-tight">
							{policy.title}
						</h1>
					</header>
				) : (
					<h1 className="font-sans font-semibold text-2xl tracking-tight sm:text-3xl">
						{policy.title}
					</h1>
				)
			) : null}

			<div
				className={cn(
					isPage
						? showTitle
							? "mt-16 space-y-5 text-left"
							: "space-y-5 text-left"
						: "mt-6 space-y-4",
					SPOTLIGHT_TRANSITION_CLASS,
					spotlighting && "opacity-35",
				)}
			>
				{policy.intro.map((paragraph) => (
					<p
						key={paragraph}
						className={cn(
							"text-pretty leading-relaxed",
							isPage
								? "text-foreground/90 text-lg leading-6"
								: "text-foreground/90 text-sm sm:text-[0.9375rem]",
						)}
					>
						{renderLegalInlineLinks(paragraph)}
					</p>
				))}
			</div>

			{showPlaceholderNote ? (
				<p
					className={cn(
						"text-muted-foreground text-xs",
						isPage ? "mt-8" : "mt-6",
						SPOTLIGHT_TRANSITION_CLASS,
						spotlighting && "opacity-35",
					)}
				>
					Operator details marked REPLACE_ME must be filled before paid launch.
				</p>
			) : null}

			<div className={cn(isPage ? "mt-20 space-y-20" : "mt-10 space-y-8")}>
				{policy.sections.map((section) => {
					const sectionId = legalSectionAnchorId(section.heading);
					const isSpotlight = spotlightSectionId === sectionId;
					return (
						<section
							key={section.heading}
							id={sectionId}
							className={cn(
								isPage ? MOVIE_DETAIL_SECTION_SCROLL_MARGIN_CLASS : null,
								SPOTLIGHT_TRANSITION_CLASS,
								spotlighting && (isSpotlight ? "opacity-100" : "opacity-35"),
							)}
						>
							<h2
								className={cn(
									"font-sans font-semibold text-foreground tracking-tight",
									isPage ? "text-[2rem] leading-9" : "text-lg",
								)}
							>
								{section.heading}
							</h2>
							<LegalPolicySectionBody section={section} isPage={isPage} />
						</section>
					);
				})}
			</div>
		</div>
	);
}

/** Lead paragraph, optional bullets, then remaining paragraphs (Mobbin disclosure order). */
function LegalPolicySectionBody({
	section,
	isPage,
}: {
	section: LegalPolicySection;
	isPage: boolean;
}) {
	const [lead, ...rest] = section.paragraphs;
	const bodyClass = cn(
		"text-pretty leading-relaxed",
		isPage
			? "text-foreground text-lg leading-6"
			: "text-foreground/90 text-sm sm:text-[0.9375rem]",
	);

	return (
		<>
			{lead ? (
				<p className={cn("mt-4", !isPage && "mt-3", bodyClass)}>
					{renderLegalInlineLinks(lead)}
				</p>
			) : null}
			{section.bullets && section.bullets.length > 0 ? (
				<ul
					className={cn(
						"mt-4 list-disc space-y-2 pl-6",
						!isPage && "mt-3",
						bodyClass,
					)}
				>
					{section.bullets.map((item) => (
						<li key={item}>{renderLegalInlineLinks(item)}</li>
					))}
				</ul>
			) : null}
			{rest.map((paragraph) => (
				<p key={paragraph} className={cn("mt-4", !isPage && "mt-3", bodyClass)}>
					{renderLegalInlineLinks(paragraph)}
				</p>
			))}
		</>
	);
}
