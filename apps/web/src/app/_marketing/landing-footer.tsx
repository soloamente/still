import Link from "next/link";

import { APP_NAME } from "@/lib/app-brand";
import { LandingConvert } from "./landing-convert";
import { LANDING_FOOTER_LINKS } from "./landing-copy";

const FOOTER_LINK_CLASS =
	"font-sans text-muted-foreground text-sm [@media(hover:hover)]:text-foreground";

export function LandingFooter() {
	const year = new Date().getFullYear();

	return (
		<footer className="bg-background">
			<LandingConvert />
			<div className="px-4 pb-12 sm:px-6">
				<div className="mx-auto flex w-full max-w-mobbin-page flex-col gap-10 sm:flex-row sm:items-start sm:justify-between">
					<p className="font-sans font-semibold text-foreground text-sm">
						{APP_NAME}
					</p>
					<nav aria-label="Site" className="flex flex-wrap gap-x-10 gap-y-6">
						<ul className="space-y-2">
							{LANDING_FOOTER_LINKS.map((link) => (
								<li key={link.href}>
									<Link href={link.href} className={FOOTER_LINK_CLASS}>
										{link.label}
									</Link>
								</li>
							))}
						</ul>
					</nav>
				</div>
				<p className="mx-auto mt-10 w-full max-w-mobbin-page font-sans text-muted-foreground text-xs">
					© {year} {APP_NAME}.
				</p>
			</div>
		</footer>
	);
}
