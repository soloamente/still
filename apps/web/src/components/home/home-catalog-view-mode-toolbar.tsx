"use client";

import IconSlider from "@still/ui/icons/slider";
import { cn } from "@still/ui/lib/utils";
import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { discoverCatalogUrl } from "@/lib/discover-catalog-url";
import { parseHomeBrowseSurface } from "@/lib/home-browse-surface";
import { parseHomeCatalogSort } from "@/lib/home-catalog-sort";
import { buildHomeLobbyHref } from "@/lib/home-lobby-url";

/** Right-rail catalogue chrome — URLs match `HomeCatalogSortChips`: `latest`/`popular`. */
const VIEW_MODE_SEGMENTS = {
	theaters: { sort: "latest" as const, label: "Theaters" },
	streaming: { sort: "popular" as const, label: "Streaming" },
} as const;

/**
 * `/home` **right** toolbar only: theatres vs streaming wording + divider + Filters (icon-only).
 * Does not replace the Latest/Popular chips on the left — same navigation targets, IA copy from design.
 */
export function HomeCatalogViewModeToolbar() {
	const searchParams = useSearchParams();
	const browse = parseHomeBrowseSurface(searchParams.get("browse"));
	const catalogSort = parseHomeCatalogSort(searchParams.get("sort"));
	const reduceMotion = useReducedMotion();

	if (browse === "community") {
		return null;
	}

	const pillTransition = reduceMotion
		? { duration: 0 }
		: {
				type: "tween" as const,
				duration: 0.22,
				ease: [0.165, 0.84, 0.44, 1] as const,
			};

	// Match chip tap targets beside `HomeCatalogSortChips` (left column).
	const chipLink = (active: boolean) =>
		cn(
			"relative inline-flex min-h-10 shrink-0 items-center justify-center rounded-full px-5 py-2.5 text-center font-medium text-sm transition-colors duration-200 ease-out motion-reduce:transition-none",
			active
				? "text-foreground"
				: "text-muted-foreground [@media(hover:hover)]:hover:text-foreground/90",
		);

	const toolbarDescId = "home-catalog-view-mode-desc";

	const filtersHref =
		browse === "tv"
			? "/search"
			: discoverCatalogUrl({
					sort:
						catalogSort === "popular"
							? "popularity.desc"
							: "primary_release_date.desc",
				});

	const filtersAria =
		browse === "tv"
			? "Filters — search and refine TV in the catalogue"
			: "Filters — refine the catalogue view";

	return (
		<div className="flex shrink-0 flex-col items-end gap-1">
			<p id={toolbarDescId} className="sr-only">
				View this catalogue emphasis as theatres-focused releases versus
				streaming-heavy trending picks. Filters opens discover with matching
				sort presets.
			</p>
			<div
				className="flex w-fit items-center rounded-full bg-background p-1"
				role="toolbar"
				aria-label="Catalogue view emphasis and filters"
				aria-describedby={toolbarDescId}
			>
				<div className="flex min-w-0">
					<Link
						href={buildHomeLobbyHref({
							sort: VIEW_MODE_SEGMENTS.theaters.sort,
							browse,
						})}
						aria-current={catalogSort === "latest" ? "page" : undefined}
						className={chipLink(catalogSort === "latest")}
						title="Newer theatrical and catalogue releases on TMDb"
						aria-label="Theaters — newer theatrical and catalogue releases on TMDb"
					>
						{catalogSort === "latest" ? (
							<motion.span
								className="absolute inset-0 z-0 rounded-full bg-card"
								layoutId="home-catalog-view-mode-pill"
								transition={pillTransition}
							/>
						) : null}
						<span className="relative z-10">
							{VIEW_MODE_SEGMENTS.theaters.label}
						</span>
					</Link>
					<Link
						href={buildHomeLobbyHref({
							sort: VIEW_MODE_SEGMENTS.streaming.sort,
							browse,
						})}
						aria-current={catalogSort === "popular" ? "page" : undefined}
						className={chipLink(catalogSort === "popular")}
						title="Trending catalogue titles — theatres and streaming"
						aria-label="Streaming — trending catalogue titles on TMDb"
					>
						{catalogSort === "popular" ? (
							<motion.span
								className="absolute inset-0 z-0 rounded-full bg-card"
								layoutId="home-catalog-view-mode-pill"
								transition={pillTransition}
							/>
						) : null}
						<span className="relative z-10">
							{VIEW_MODE_SEGMENTS.streaming.label}
						</span>
					</Link>
				</div>

				<span
					aria-hidden
					className="mx-1 h-6 w-px shrink-0 self-center bg-border/55"
				/>

				<Link
					href={filtersHref}
					className={cn(
						"inline-flex size-10 shrink-0 items-center justify-center rounded-full text-foreground transition-colors duration-200 ease-out motion-reduce:transition-none",
						"[@media(hover:hover)]:hover:bg-card/55 [@media(hover:hover)]:hover:text-foreground",
						"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
					)}
					aria-label={filtersAria}
					title={filtersAria}
				>
					<IconSlider
						size="1.125rem"
						className="shrink-0 opacity-95"
						aria-hidden
					/>
				</Link>
			</div>
		</div>
	);
}
