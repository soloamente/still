"use client";

import { cn } from "@still/ui/lib/utils";
import { useReducedMotion } from "motion/react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { LandingMarkPill } from "@/app/_marketing/landing-mark-pill";
import { LegalPolicyContent } from "@/components/legal/legal-policy-content";
import { LegalRouteSlide } from "@/components/legal/legal-route-slide";
import { LegalTrustContent } from "@/components/legal/legal-trust-content";
import { MovieDetailSectionNav } from "@/components/movie/movie-detail-section-nav";
import { APP_NAME } from "@/lib/app-brand";
import {
	buildLegalSectionNavItems,
	formatLegalLastUpdated,
} from "@/lib/legal-format";
import { getLegalPolicy } from "@/lib/legal-policy-bodies";
import {
	isLegalPolicySurface,
	LEGAL_FOOTER_NAV,
	type LegalSurfaceId,
} from "@/lib/legal-surface";
import { LEGAL_TRADER } from "@/lib/legal-trader";
import { MOVIE_DETAIL_SECTION_NAV_GUTTER_CLASS } from "@/lib/movie-detail-sections";

/** How long other sections stay dim after a right-rail jump. */
const SECTION_SPOTLIGHT_MS = 2200;

/**
 * Full-document legal surface (Mobbin privacy layout + Sense tokens).
 * Auth signup still uses the Vaul drawer so film stills stay under the scrim.
 */
export function LegalDocumentPage({
	surfaceId,
}: {
	surfaceId: LegalSurfaceId;
}) {
	const reduceMotion = useReducedMotion();
	const trader = LEGAL_TRADER;
	const isPolicy = isLegalPolicySurface(surfaceId);
	const policy = isPolicy ? getLegalPolicy(surfaceId) : null;
	const sectionNavItems = isPolicy ? buildLegalSectionNavItems(surfaceId) : [];
	const title = policy?.title ?? "Trust Center";
	const description =
		policy?.description ??
		`Vendors and subprocessors that may handle personal data for ${APP_NAME}.`;

	const [spotlightSectionId, setSpotlightSectionId] = useState<string | null>(
		null,
	);
	const spotlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const handleNavigateToSection = useCallback(
		(id: string) => {
			if (spotlightTimerRef.current) {
				clearTimeout(spotlightTimerRef.current);
			}
			setSpotlightSectionId(id);
			const holdMs = reduceMotion ? 900 : SECTION_SPOTLIGHT_MS;
			spotlightTimerRef.current = setTimeout(() => {
				setSpotlightSectionId(null);
				spotlightTimerRef.current = null;
			}, holdMs);
		},
		[reduceMotion],
	);

	// Peer switches keep scroll position otherwise — jump back to the hero.
	useEffect(() => {
		window.scrollTo(0, 0);
		setSpotlightSectionId(null);
		if (spotlightTimerRef.current) {
			clearTimeout(spotlightTimerRef.current);
			spotlightTimerRef.current = null;
		}
	}, [surfaceId]);

	useEffect(() => {
		return () => {
			if (spotlightTimerRef.current) {
				clearTimeout(spotlightTimerRef.current);
			}
		};
	}, []);

	return (
		<div className="min-h-svh bg-background text-foreground">
			{/* Quiet marketing chrome — mark home + Sign in (no landing chapter anchors). */}
			<header className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4 sm:px-6 sm:pt-5">
				<nav
					aria-label="Sense"
					className="pointer-events-auto flex w-full max-w-2xl items-center justify-between gap-2 rounded-full bg-card/80 p-1.5 pl-2 backdrop-blur-lg"
				>
					<div className="justify-self-start">
						<LandingMarkPill className="w-fit min-w-0 bg-background px-3 text-sm sm:px-4 sm:text-base" />
					</div>
					<Link
						href="/sign-in"
						className="inline-flex h-11 w-fit min-w-0 shrink-0 select-none items-center justify-center rounded-full bg-foreground px-4 font-sans font-semibold text-background text-sm transition-opacity duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card active:opacity-85 [@media(hover:hover)]:opacity-90"
					>
						Sign in
					</Link>
				</nav>
			</header>

			{/* Center activation: short legal sections + last item near the footer. */}
			{isPolicy ? (
				<MovieDetailSectionNav
					key={surfaceId}
					sections={sectionNavItems}
					activation="center"
					onNavigateToSection={handleNavigateToSection}
				/>
			) : null}

			<main
				className={cn(
					"px-5 pt-[min(12.5rem,22vh)] pb-24 sm:px-8 sm:pb-32",
					MOVIE_DETAIL_SECTION_NAV_GUTTER_CLASS,
				)}
			>
				{/* Title + body slide together on peer switch (transitions.dev page-slide). */}
				<LegalRouteSlide surfaceId={surfaceId}>
					<header className="mx-auto w-full max-w-[52.125rem] text-center">
						<h1 className="text-balance font-sans font-semibold text-[clamp(2.75rem,6vw,5rem)] text-foreground leading-none tracking-tight">
							{title}
						</h1>
						<p className="mt-5 text-muted-foreground text-sm tracking-wide">
							Last updated {formatLegalLastUpdated(trader.lastUpdated)}
						</p>
					</header>

					<div className="mx-auto mt-16 w-full max-w-[52.125rem] sm:mt-20">
						{isPolicy ? (
							<LegalPolicyContent
								policyId={surfaceId}
								variant="page"
								showTitle={false}
								spotlightSectionId={spotlightSectionId}
							/>
						) : (
							<LegalTrustContent />
						)}
					</div>
				</LegalRouteSlide>

				<footer className="mx-auto mt-24 w-full max-w-[52.125rem] border-0 pt-8 text-center text-muted-foreground text-xs sm:mt-32">
					<p className="sr-only">{description}</p>
					<ul className="flex flex-wrap justify-center gap-x-6 gap-y-2">
						{LEGAL_FOOTER_NAV.map((item) => (
							<li key={item.id}>
								<Link
									href={item.href}
									className={cn(
										item.id === surfaceId
											? "text-foreground"
											: "[@media(hover:hover)]:hover:text-foreground",
									)}
									aria-current={item.id === surfaceId ? "page" : undefined}
								>
									{item.label}
								</Link>
							</li>
						))}
					</ul>
					<p className="mt-6">
						© {new Date().getFullYear()} {APP_NAME}.
					</p>
				</footer>
			</main>
		</div>
	);
}
