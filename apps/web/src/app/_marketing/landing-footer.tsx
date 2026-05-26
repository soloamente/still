import Link from "next/link";

import { LANDING_GLASS_PANEL, LANDING_GLASS_PILL } from "./landing-glass";
import { LandingMarkPill } from "./landing-mark-pill";
import { LandingScrollReveal } from "./landing-scroll-reveal";

/** La Nube footer — newsletter pill, columns, credits. */
export function LandingFooter() {
	const year = new Date().getFullYear();

	return (
		<footer
			id="start"
			className="scroll-mt-24 bg-card px-4 py-20 sm:px-6 sm:py-28"
		>
			<LandingScrollReveal>
				<div className="mx-auto max-w-[1400px]">
					<div
						className={`${LANDING_GLASS_PANEL} flex flex-col gap-3 p-2 sm:flex-row sm:items-stretch sm:gap-2`}
					>
						<div className="flex min-h-14 flex-1 flex-col justify-center rounded-full px-6 py-3">
							<span className="font-sans text-foreground/90 text-sm">
								Subscribe to your diary
							</span>
							<span className="mt-0.5 text-muted-foreground text-xs">
								Free account — log your next screening tonight
							</span>
						</div>
						<Link
							href="/sign-up"
							className={`${LANDING_GLASS_PILL} inline-flex h-12 shrink-0 items-center justify-center px-8 font-medium font-sans text-foreground text-sm sm:min-h-14`}
						>
							Create account
						</Link>
					</div>

					<div className="mt-16 grid gap-12 sm:grid-cols-2 lg:grid-cols-4">
						<div className="space-y-3">
							<p className="text-muted-foreground text-xs uppercase tracking-wider">
								Mail
							</p>
							<p className="font-sans text-foreground/90 text-sm">
								hello@still.app
							</p>
						</div>
						<nav aria-label="Site" className="space-y-3">
							<p className="text-muted-foreground text-xs uppercase tracking-wider">
								Site
							</p>
							<ul className="space-y-2 font-sans text-foreground/90 text-sm">
								<li>
									<Link href="/">Home</Link>
								</li>
								<li>
									<Link href="#work">Work</Link>
								</li>
								<li>
									<Link href="#diary">Info</Link>
								</li>
							</ul>
						</nav>
						<nav aria-label="Product" className="space-y-3">
							<p className="text-muted-foreground text-xs uppercase tracking-wider">
								Product
							</p>
							<ul className="space-y-2 font-sans text-foreground/90 text-sm">
								<li>
									<Link href="/sign-up">Create account</Link>
								</li>
								<li>
									<Link href="/sign-in">Sign in</Link>
								</li>
								<li>
									<Link href="#catalogue">Catalogue</Link>
								</li>
							</ul>
						</nav>
						<div className="space-y-3">
							<p className="text-muted-foreground text-xs uppercase tracking-wider">
								Legal
							</p>
							<p className="font-sans text-foreground/90 text-sm">
								Privacy policy
							</p>
						</div>
					</div>

					<div className="mt-16 flex flex-col gap-4 border-foreground/10 border-t pt-8 sm:flex-row sm:items-center sm:justify-between">
						<div className="flex items-center gap-3">
							<LandingMarkPill href="/" />
							<p className="font-sans text-muted-foreground text-xs">
								Still — All rights reserved © {year}
							</p>
						</div>
						<p className="text-muted-foreground text-xs">
							Your cinematic memory
						</p>
					</div>
				</div>
			</LandingScrollReveal>
		</footer>
	);
}
