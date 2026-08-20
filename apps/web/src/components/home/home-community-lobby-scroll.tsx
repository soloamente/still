"use client";

import { cn } from "@still/ui/lib/utils";
import type { ReactNode } from "react";

import {
	HOME_COMMUNITY_FEED_COLUMN_CLASSNAME,
	HOME_COMMUNITY_LOBBY_BODY_CLASSNAME,
} from "@/lib/home-community-lobby-layout";

/**
 * Community lobby body — document flow inside the catalogue card (page/Lenis scroll),
 * not a nested overflow scrollport (that fought Lenis once `data-lenis-prevent-wheel` was added).
 */
export function HomeCommunityLobbyScroll({
	children,
	className,
	contentKey: _contentKey = "",
}: {
	children: ReactNode;
	className?: string;
	/** Kept for call-site stability when tabs change — no nested scroll to remeasure. */
	contentKey?: string;
}) {
	return (
		<div className={cn(HOME_COMMUNITY_LOBBY_BODY_CLASSNAME, className)}>
			{children}
		</div>
	);
}

/** Sort chips + context line above reviews/activity feeds. */
export function CommunityFeedIntro({
	title,
	headingId,
	children,
}: {
	title: string;
	headingId: string;
	children?: ReactNode;
}) {
	return (
		<header
			className={cn(
				HOME_COMMUNITY_FEED_COLUMN_CLASSNAME,
				"flex flex-col items-center gap-3 pt-1",
			)}
		>
			{children}
			<h2
				id={headingId}
				className="text-balance text-center font-semibold text-base text-foreground tracking-tight sm:text-lg"
			>
				{title}
			</h2>
		</header>
	);
}

/** Accessible wrapper for paginated community feed lists. */
export function CommunityFeedSection({
	labelledBy,
	children,
}: {
	labelledBy: string;
	children: ReactNode;
}) {
	return (
		<section aria-labelledby={labelledBy} className="min-w-0">
			{children}
		</section>
	);
}
