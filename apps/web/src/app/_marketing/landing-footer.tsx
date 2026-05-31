import Link from "next/link";

import { APP_NAME } from "@/lib/app-brand";

import {
	LANDING_FEATURES_SECTION_TITLE_CLASS,
	LANDING_HERO_CTA_PRIMARY_CLASS,
	LANDING_HERO_CTA_ROW_CLASS,
	LANDING_HERO_CTA_SECONDARY_CLASS,
	LANDING_SECTION_CLASS,
	LANDING_SECTION_INNER_CLASS,
} from "./landing-mobbin-hero";
import { LandingScrollReveal } from "./landing-scroll-reveal";

/**
 * Mobbin closing CTA band + minimal footer links.
 */
export function LandingFooter() {
	const year = new Date().getFullYear();

	return (
		<footer id="start" className="scroll-mt-24 bg-background">
			<section className={`${LANDING_SECTION_CLASS} border-border/40 border-t`}>
				<div className={LANDING_SECTION_INNER_CLASS}>
					<LandingScrollReveal>
						<div className="mx-auto max-w-[40ch] text-center">
							<h2 className={LANDING_FEATURES_SECTION_TITLE_CLASS}>
								Never lose track of what you watch
							</h2>
							<p className="mt-4 font-sans text-muted-foreground text-sm leading-relaxed">
								Start a free account — log tonight, build lists tomorrow, and
								share reviews when you are ready.
							</p>
							<div
								className={`${LANDING_HERO_CTA_ROW_CLASS} mt-8 justify-center`}
							>
								<Link
									href="/sign-up"
									className={LANDING_HERO_CTA_PRIMARY_CLASS}
								>
									Create account
								</Link>
								<Link
									href="/sign-in"
									className={LANDING_HERO_CTA_SECONDARY_CLASS}
								>
									Sign in
								</Link>
							</div>
						</div>
					</LandingScrollReveal>
				</div>
			</section>

			<div className="border-border/40 border-t px-4 py-12 sm:px-6">
				<div className="mx-auto flex w-full max-w-mobbin-page flex-col gap-10 sm:flex-row sm:items-start sm:justify-between">
					<div>
						<p className="font-sans font-semibold text-foreground text-sm">
							{APP_NAME}
						</p>
						<p className="mt-2 max-w-xs font-sans text-muted-foreground text-xs leading-relaxed">
							Your cinematic memory — diary, lists, and community for people who
							care how they watch.
						</p>
					</div>

					<nav
						aria-label="Site"
						className="flex flex-wrap gap-x-10 gap-y-6 font-sans text-sm"
					>
						<ul className="space-y-2 text-muted-foreground">
							<li>
								<Link
									href="#intro"
									className="transition-colors duration-200 [@media(hover:hover)]:text-foreground"
								>
									Product
								</Link>
							</li>
							<li>
								<Link
									href="#diary"
									className="transition-colors duration-200 [@media(hover:hover)]:text-foreground"
								>
									Features
								</Link>
							</li>
							<li>
								<Link
									href="#catalogue"
									className="transition-colors duration-200 [@media(hover:hover)]:text-foreground"
								>
									Catalogue
								</Link>
							</li>
						</ul>
						<ul className="space-y-2 text-muted-foreground">
							<li>
								<Link
									href="/sign-up"
									className="transition-colors duration-200 [@media(hover:hover)]:text-foreground"
								>
									Create account
								</Link>
							</li>
							<li>
								<Link
									href="/sign-in"
									className="transition-colors duration-200 [@media(hover:hover)]:text-foreground"
								>
									Sign in
								</Link>
							</li>
						</ul>
					</nav>
				</div>

				<p className="mx-auto mt-10 w-full max-w-mobbin-page font-sans text-muted-foreground text-xs">
					© {year} {APP_NAME}. All rights reserved.
				</p>
			</div>
		</footer>
	);
}
