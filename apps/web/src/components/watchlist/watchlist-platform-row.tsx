"use client";

import { cn } from "@still/ui/lib/utils";
import { useReducedMotion } from "motion/react";
import { useRef } from "react";
import { useWatchlistLobbyParams } from "@/components/watchlist/watchlist-lobby-params-context";
import { WatchlistProviderCircleLogo } from "@/components/watchlist/watchlist-provider-circle-logo";
import { useWatchlistProviderFlyChrome } from "@/components/watchlist/watchlist-provider-fly-context";
import { useWatchlistProvidersCatalog } from "@/components/watchlist/watchlist-providers-catalog-context";
import { DETAIL_CANVAS_ON_CARD_HOVER_CLASS } from "@/lib/detail-action-motion";
import {
	HOME_LOBBY_SCROLL_FADE_LEFT_CLASSNAME,
	HOME_LOBBY_SCROLL_FADE_RIGHT_CLASSNAME,
} from "@/lib/home-lobby-catalogue-layout";
import {
	HORIZONTAL_OVERFLOW_RAIL_CLASSNAME,
	useHorizontalScrollFades,
} from "@/lib/use-horizontal-scroll-fades";
import { watchlistPlatformRowLogoUrl } from "@/lib/watchlist-provider-logo-dev";

/** Spec cap for the horizontal logo row — remainder scrolls off-screen. */
const PLATFORM_ROW_VISIBLE_CAP = 12;

/** Lobby chip family — horizontal pill: logo + save count on one line. */
const PLATFORM_PILL_CLASSNAME =
	"inline-flex flex-row items-center justify-center gap-2.5 rounded-full bg-background p-2 py-2 pr-3.5 text-center";

/**
 * Horizontal platform row — TMDb provider pills (logo + save count inline).
 * Selected services leave the row (composite pill beside filters).
 */
export function WatchlistPlatformRow() {
	const reduceMotion = useReducedMotion();
	const { providers: selectedIds, selectProvider } = useWatchlistLobbyParams();
	const { flyProviderToFilter } = useWatchlistProviderFlyChrome();
	const { providers: catalogue, needsRegion } = useWatchlistProvidersCatalog();
	const scrollRef = useRef<HTMLDivElement>(null);

	const handleSelectProvider = (
		entry: (typeof catalogue)[number],
		logoSrc: string | null,
		logoElement: HTMLElement | null,
	) => {
		if (reduceMotion || logoElement == null) {
			selectProvider(entry.providerId);
			return;
		}
		void flyProviderToFilter(
			entry.providerId,
			logoElement.getBoundingClientRect(),
			{
				src: logoSrc,
				name: entry.providerName,
			},
		);
	};

	const rowEntries = catalogue
		.filter((entry) => !selectedIds.includes(entry.providerId))
		.slice(0, PLATFORM_ROW_VISIBLE_CAP);

	const railContentKey = rowEntries.map((entry) => entry.providerId).join(",");
	const { showStartFade, showEndFade } = useHorizontalScrollFades(
		scrollRef,
		rowEntries.length > 0,
		railContentKey,
	);

	if (needsRegion || rowEntries.length === 0) return null;

	return (
		<div className="relative z-10 min-w-0 shrink-0 py-1">
			<div className="relative min-w-0 overflow-hidden">
				<div
					aria-hidden
					className={cn(
						HOME_LOBBY_SCROLL_FADE_LEFT_CLASSNAME,
						"transition-opacity duration-200 motion-reduce:transition-none",
						showStartFade ? "opacity-100" : "opacity-0",
					)}
				/>
				<div
					aria-hidden
					className={cn(
						HOME_LOBBY_SCROLL_FADE_RIGHT_CLASSNAME,
						"transition-opacity duration-200 motion-reduce:transition-none",
						showEndFade ? "opacity-100" : "opacity-0",
					)}
				/>
				<div
					ref={scrollRef}
					data-lenis-prevent-wheel
					className={cn(
						HORIZONTAL_OVERFLOW_RAIL_CLASSNAME,
						"items-center gap-2.5 py-1",
					)}
				>
					<ul
						className="flex w-max min-w-0 list-none flex-nowrap items-center gap-2.5 p-0"
						aria-label="Streaming services on your watchlist"
					>
						{rowEntries.map((entry) => {
							const logoSrc = watchlistPlatformRowLogoUrl(entry);
							return (
								<li key={entry.providerId} className="shrink-0">
									<button
										type="button"
										className={cn(
											PLATFORM_PILL_CLASSNAME,
											"transition-[transform] duration-200 ease-out active:scale-[0.96] motion-reduce:transition-none",
											DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
										)}
										onClick={(event) => {
											const logoElement = event.currentTarget.querySelector(
												"[data-watchlist-row-logo]",
											);
											handleSelectProvider(
												entry,
												logoSrc,
												logoElement instanceof HTMLElement ? logoElement : null,
											);
										}}
										aria-label={`Filter by ${entry.providerName}`}
									>
										<WatchlistProviderCircleLogo
											src={logoSrc}
											name={entry.providerName}
											className="size-9"
											dataWatchlistLogo="row"
											providerId={entry.providerId}
										/>
										<span className="shrink-0 whitespace-nowrap text-muted-foreground text-xs tabular-nums leading-none">
											{entry.titleCount}{" "}
											{entry.titleCount === 1 ? "title" : "titles"}
										</span>
									</button>
								</li>
							);
						})}
					</ul>
				</div>
			</div>
		</div>
	);
}
