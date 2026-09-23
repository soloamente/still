"use client";

import { cn } from "@still/ui/lib/utils";
import Image from "next/image";
import { useRef } from "react";

import { useWatchlistLobbyParams } from "@/components/watchlist/watchlist-lobby-params-context";
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

const TMDB_PROVIDER_LOGO = (path: string) =>
	`https://image.tmdb.org/t/p/w92${path}`;

/** Spec cap for the horizontal logo row — remainder scrolls off-screen. */
const PLATFORM_ROW_VISIBLE_CAP = 12;

/**
 * Large rounded platform cards — tap adds an AND streaming filter (`?providers=`).
 * Selected services leave the row (they live in the composite pill).
 */
export function WatchlistPlatformRow() {
	const { providers: selectedIds, selectProvider } = useWatchlistLobbyParams();
	const { providers: catalogue, needsRegion } = useWatchlistProvidersCatalog();
	const scrollRef = useRef<HTMLDivElement>(null);

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
		<div className="relative z-10 min-w-0 shrink-0 pt-1">
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
						"gap-2.5 pt-0.5 pb-0.5",
					)}
				>
					<ul
						className="flex w-max min-w-0 list-none flex-nowrap items-stretch gap-2.5 p-0"
						aria-label="Streaming services on your watchlist"
					>
						{rowEntries.map((entry) => (
							<li key={entry.providerId} className="shrink-0">
								<button
									type="button"
									className={cn(
										"flex w-[5.75rem] flex-col items-center gap-2 rounded-[1.35rem] bg-background px-2.5 py-3 text-center transition-[transform] duration-200 ease-out active:scale-[0.96] motion-reduce:transition-none",
										DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
									)}
									onClick={() => selectProvider(entry.providerId)}
									aria-label={`Filter by ${entry.providerName}`}
								>
									<span className="relative flex size-14 items-center justify-center overflow-hidden rounded-2xl bg-card">
										{entry.logoPath ? (
											<Image
												src={TMDB_PROVIDER_LOGO(entry.logoPath)}
												alt=""
												width={56}
												height={56}
												className="size-12 object-contain"
												unoptimized
											/>
										) : (
											<span className="px-1 font-medium text-foreground text-xs">
												{entry.providerName.slice(0, 2).toUpperCase()}
											</span>
										)}
									</span>
									<span className="line-clamp-2 w-full text-pretty font-medium text-foreground text-xs leading-snug">
										{entry.providerName}
									</span>
									{entry.titleCount > 0 ? (
										<span className="text-muted-foreground text-xs tabular-nums">
											{entry.titleCount}{" "}
											{entry.titleCount === 1 ? "save" : "saves"}
										</span>
									) : null}
								</button>
							</li>
						))}
					</ul>
				</div>
			</div>
		</div>
	);
}
