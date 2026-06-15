"use client";

import { cn } from "@still/ui/lib/utils";
import { type ReactNode, useRef } from "react";

import {
	HOME_LOBBY_FILTER_ROW_CLASSNAME,
	HOME_LOBBY_FILTER_ROW_LEADING_CLASSNAME,
	HOME_LOBBY_SCROLL_FADE_LEFT_CLASSNAME,
	HOME_LOBBY_SCROLL_FADE_RIGHT_CLASSNAME,
} from "@/lib/home-lobby-catalogue-layout";
import {
	HORIZONTAL_OVERFLOW_RAIL_CLASSNAME,
	useHorizontalScrollFades,
} from "@/lib/use-horizontal-scroll-fades";

/** Horizontal scroll + edge fades when sort/feed chips overflow on narrow viewports. */
function HomeLobbyFilterScrollRail({
	children,
	contentKey = "",
}: {
	children: ReactNode;
	contentKey?: string;
}) {
	const scrollRef = useRef<HTMLDivElement>(null);
	const { showStartFade, showEndFade } = useHorizontalScrollFades(
		scrollRef,
		true,
		contentKey,
	);

	return (
		<div
			className={cn(
				HOME_LOBBY_FILTER_ROW_LEADING_CLASSNAME,
				"relative overflow-hidden",
			)}
		>
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
				className={cn(HORIZONTAL_OVERFLOW_RAIL_CLASSNAME, "gap-0 pb-0")}
				data-lenis-prevent-wheel
			>
				{children}
			</div>
		</div>
	);
}

/**
 * Sort/feed rail + secondary toolbar under `/home` sticky chrome.
 * Single row: scrollable sort chips on the left, compact popovers + filters pinned right.
 * Optional `center` (Community ranks Films · Shows) uses a three-column grid from `sm+`.
 */
export function HomeLobbyFilterRow({
	leading,
	leadingScrollKey = "",
	center,
	trailing,
}: {
	leading: ReactNode;
	/** Resync scroll fades when sort/feed options change (e.g. browse surface). */
	leadingScrollKey?: string;
	/** Center rail — e.g. Rankings catalogue on Community ranks (desktop only). */
	center?: ReactNode;
	trailing: ReactNode;
}) {
	if (center) {
		return (
			<div
				className={cn(
					HOME_LOBBY_FILTER_ROW_CLASSNAME,
					"sm:grid sm:w-full sm:grid-cols-[1fr_auto_1fr] sm:items-center",
				)}
			>
				<HomeLobbyFilterScrollRail contentKey={leadingScrollKey}>
					{leading}
				</HomeLobbyFilterScrollRail>
				{/* Mobile keeps Films · Shows in the filters popover — center only on `sm+`. */}
				<div className="hidden shrink-0 justify-center sm:flex">{center}</div>
				<div className="flex shrink-0 items-center gap-1 sm:justify-self-end">
					{trailing}
				</div>
			</div>
		);
	}

	return (
		<div className={HOME_LOBBY_FILTER_ROW_CLASSNAME}>
			<HomeLobbyFilterScrollRail contentKey={leadingScrollKey}>
				{leading}
			</HomeLobbyFilterScrollRail>
			<div className="flex shrink-0 items-center gap-1">{trailing}</div>
		</div>
	);
}
