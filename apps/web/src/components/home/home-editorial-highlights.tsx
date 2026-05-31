import Link from "next/link";

import {
	EDITORIAL_COMMUNITY_HIGHLIGHTS,
	type EditorialHighlight,
} from "@/lib/editorial-feed";

/**
 * Cold-start editorial row when Community has no friend signal yet.
 */
export function HomeEditorialHighlights({
	highlights = EDITORIAL_COMMUNITY_HIGHLIGHTS,
}: {
	highlights?: EditorialHighlight[];
}) {
	if (highlights.length === 0) return null;

	return (
		<section
			className="mx-auto mb-8 max-w-2xl space-y-3 px-6 sm:px-8"
			aria-label="Featured on Sense"
		>
			<p className="text-center font-medium text-foreground text-sm">
				Featured on Sense
			</p>
			<ul className="space-y-2">
				{highlights.map((item) => (
					<li key={item.id}>
						<Link
							href={item.href}
							className="block rounded-2xl bg-background px-5 py-4 transition-colors [@media(hover:hover)]:hover:bg-background/80"
						>
							<p className="font-medium text-foreground text-sm">
								{item.title}
							</p>
							<p className="mt-1 text-balance text-muted-foreground text-sm leading-relaxed">
								{item.description}
							</p>
						</Link>
					</li>
				))}
			</ul>
		</section>
	);
}
