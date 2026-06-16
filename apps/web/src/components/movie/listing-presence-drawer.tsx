"use client";

import { cn } from "@still/ui/lib/utils";
import Link from "next/link";
import { useRef } from "react";

import { DetailDrawerScrollBody } from "@/components/movie/detail-drawer-scroll-body";
import { DetailVaulSheet } from "@/components/movie/detail-vaul-sheet";
import { SheetScrollScrims } from "@/components/movie/sheet-scroll-scrims";
import { PatronPortraitWithMetalTier } from "@/components/profile/patron-portrait-with-metal-tier";
import type { ListingPresenceViewingPatron } from "@/lib/fetch-listing-presence";
import { buildListingPresenceDrawerCopy } from "@/lib/listing-presence-copy";
import { inferAnimatedFromProfileUrl } from "@/lib/profile-media";
import { useSheetScrollFades } from "@/lib/use-sheet-scroll-fades";

/** Drawer rows for patrons currently visible in listing presence. */
function ListingPresenceDrawerRow({
	patron,
}: {
	patron: ListingPresenceViewingPatron;
}) {
	return (
		<article className="rounded-2xl bg-background p-4">
			<Link
				href={`/profile/${patron.handle}`}
				className="flex min-w-0 items-center gap-3 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-desert-orange/55"
				aria-label={`Open @${patron.handle} profile`}
			>
				<span className="block size-11 shrink-0 rounded-full bg-muted">
					<PatronPortraitWithMetalTier
						handle={patron.handle}
						avatarUrl={patron.image}
						name={patron.displayName || patron.handle}
						className="size-full rounded-full"
						width={44}
						height={44}
						showOnlineStatus
						presenceState={patron.presenceState}
						isAnimated={inferAnimatedFromProfileUrl(
							patron.image,
							patron.avatarIsAnimated,
						)}
						diaryMetalTier={patron.diaryMetalTier}
					/>
				</span>
				<div className="min-w-0">
					<p className="truncate font-medium text-foreground text-sm">
						{patron.displayName}
					</p>
					<p className="truncate text-muted-foreground text-xs">
						@{patron.handle}
					</p>
				</div>
			</Link>
		</article>
	);
}

export function ListingPresenceDrawer({
	open,
	onOpenChange,
	viewerCount,
	viewingPatrons,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	viewerCount: number;
	viewingPatrons: ListingPresenceViewingPatron[];
}) {
	const scrollRef = useRef<HTMLDivElement>(null);
	const contentKey = `presence:${viewingPatrons.length}`;
	const { showHeaderFade, showFooterFade } = useSheetScrollFades(
		scrollRef,
		open,
		contentKey,
	);
	const drawerCopy = buildListingPresenceDrawerCopy({
		viewerCount,
		visibleCount: viewingPatrons.length,
	});

	return (
		<DetailVaulSheet
			open={open}
			onOpenChange={onOpenChange}
			title={drawerCopy.title}
			description={drawerCopy.description}
			appStack
		>
			<div className="relative isolate flex min-h-0 w-full flex-1 flex-col">
				<DetailDrawerScrollBody scrollRef={scrollRef}>
					<div className="mx-auto w-full max-w-lg px-4 pt-2 pb-10 sm:max-w-xl">
						{viewingPatrons.length > 0 ? (
							<ul className="space-y-3">
								{viewingPatrons.map((patron) => (
									<li key={patron.userId}>
										<ListingPresenceDrawerRow patron={patron} />
									</li>
								))}
							</ul>
						) : (
							<p
								className={cn(
									"rounded-2xl bg-muted/25 p-8 text-center text-muted-foreground text-sm",
								)}
							>
								No visible patrons right now.
							</p>
						)}
					</div>
				</DetailDrawerScrollBody>
				<SheetScrollScrims
					showHeaderFade={showHeaderFade}
					showFooterFade={showFooterFade}
					footerTone="subtle"
				/>
			</div>
		</DetailVaulSheet>
	);
}
