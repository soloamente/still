import { cn } from "@still/ui/lib/utils";
import type { ReactNode } from "react";

import { MOVIE_DETAIL_SECTION_SCROLL_MARGIN_CLASS } from "@/lib/movie-detail-sections";

/**
 * Shared film-detail section shell — matches Cast & Awards: centered `font-sans`
 * title, optional subtitle, scroll-margin when `id` is set for the right-rail legend.
 */
export function MovieDetailBodySection({
	id,
	title,
	subtitle,
	showHeader = true,
	children,
	className,
	contentClassName,
}: {
	id?: string;
	title: ReactNode;
	subtitle?: ReactNode;
	/** When false, render children only (e.g. closing credits crawl with no section chrome). */
	showHeader?: boolean;
	children: ReactNode;
	className?: string;
	contentClassName?: string;
}) {
	return (
		<section
			id={id}
			className={cn(
				id ? MOVIE_DETAIL_SECTION_SCROLL_MARGIN_CLASS : null,
				"relative mx-auto w-full max-w-7xl",
				className,
			)}
		>
			{showHeader ? (
				<>
					<h2 className="text-center font-semibold text-2xl text-foreground tracking-tight sm:text-3xl">
						{title}
					</h2>
					{subtitle ? (
						<p className="mx-auto mt-3 max-w-2xl text-balance text-center font-editorial text-muted-foreground text-sm leading-relaxed sm:text-base">
							{subtitle}
						</p>
					) : null}
				</>
			) : null}
			<div className={cn(showHeader ? "mt-10" : undefined, contentClassName)}>
				{children}
			</div>
		</section>
	);
}
