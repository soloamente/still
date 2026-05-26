import Link from "next/link";

import { LANDING_GLASS_PILL } from "./landing-glass";
import { LandingScrollReveal } from "./landing-scroll-reveal";
import { LANDING_VIEWPORT_SECTION } from "./landing-section";

const INFO = [
	{ title: "Diary", body: "Venue, date, 10.0 ratings, rewatch logs." },
	{ title: "Lists", body: "Curated walls with custom covers." },
	{ title: "Community", body: "Reviews, ranks, and friend activity." },
] as const;

export function LandingFeatures() {
	return (
		<section
			id="diary"
			className={`${LANDING_VIEWPORT_SECTION} items-center justify-center border-foreground/10 border-t bg-background px-4 sm:px-6`}
		>
			<div className="mx-auto w-full max-w-[1400px]">
				<LandingScrollReveal className="flex flex-col items-center gap-6 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
					<div>
						<p className="text-muted-foreground text-sm">Info</p>
						<h2 className="mt-3 font-sans font-semibold text-[clamp(1.5rem,3.5vw,2.25rem)] tracking-[-0.035em]">
							How you actually watch
						</h2>
					</div>
					<Link
						href="#start"
						className={`${LANDING_GLASS_PILL} inline-flex h-11 items-center px-6 font-sans text-foreground/90 text-sm`}
					>
						Contact us
					</Link>
				</LandingScrollReveal>

				<ul className="mt-14 grid gap-10 sm:grid-cols-3 sm:gap-8">
					{INFO.map((item) => (
						<li key={item.title}>
							<LandingScrollReveal>
								<h3 className="font-medium font-sans text-foreground text-lg tracking-[-0.02em]">
									{item.title}
								</h3>
								<p className="mt-2 text-muted-foreground text-sm leading-relaxed">
									{item.body}
								</p>
							</LandingScrollReveal>
						</li>
					))}
				</ul>
			</div>
		</section>
	);
}
