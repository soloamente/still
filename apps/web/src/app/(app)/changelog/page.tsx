import type { Metadata } from "next";

import { Section } from "@/components/ui/section";
import { APP_NAME } from "@/lib/app-brand";
import {
	formatChangelogReleaseKicker,
	PRODUCT_CHANGELOG_RELEASES,
} from "@/lib/product-changelog";

export const metadata: Metadata = {
	title: "Changelog",
	description: `Release notes and product updates for ${APP_NAME}.`,
};

/**
 * Patron-facing product changelog — full release history for What's New deep links.
 */
export default function ChangelogPage() {
	return (
		<div className="space-y-12">
			<Section
				title="Changelog"
				subtitle={`What shipped recently in ${APP_NAME} — fixes, polish, and new ways to browse your taste.`}
			>
				<div className="space-y-10">
					{PRODUCT_CHANGELOG_RELEASES.map((release) => (
						<article
							key={release.id}
							className="rounded-2xl bg-background px-5 py-6 sm:px-7 sm:py-8"
						>
							<header className="mb-5">
								<p className="font-medium text-[11px] text-muted-foreground tabular-nums tracking-wide">
									{formatChangelogReleaseKicker(release)}
								</p>
								<h2 className="mt-1.5 text-balance font-semibold text-foreground text-xl tracking-tight sm:text-2xl">
									{release.headline}
								</h2>
								{release.summary ? (
									<p className="mt-2 max-w-prose text-pretty text-muted-foreground text-sm leading-relaxed sm:text-base">
										{release.summary}
									</p>
								) : null}
							</header>
							<ul className="space-y-4">
								{release.items.map((item) => (
									<li
										key={`${release.id}-${item.title ?? item.body.slice(0, 48)}`}
										className="max-w-prose text-pretty text-sm leading-relaxed sm:text-base"
									>
										{item.title ? (
											<p className="font-medium text-foreground">
												{item.title}
											</p>
										) : null}
										<p
											className={
												item.title
													? "mt-1 text-muted-foreground"
													: "text-muted-foreground"
											}
										>
											{item.body}
										</p>
									</li>
								))}
							</ul>
						</article>
					))}
				</div>
			</Section>
		</div>
	);
}
