"use client";

import { useState } from "react";
import { ListingPresenceDrawer } from "@/components/movie/listing-presence-drawer";
import { ListingPresenceRow } from "@/components/movie/listing-presence-row";
import {
	type ListingPresenceSurface,
	useListingPresence,
} from "@/hooks/use-listing-presence";

/**
 * Runs listing presence heartbeat + SSE subscription for one title detail page.
 */
export function ListingPresenceProvider({
	listingKind,
	listingId,
	enabled = true,
	className,
	align = "start",
	layout = "corner",
}: {
	listingKind: ListingPresenceSurface;
	listingId: number | string;
	enabled?: boolean;
	className?: string;
	align?: "start" | "end";
	layout?: "corner" | "inline";
}) {
	const [drawerOpen, setDrawerOpen] = useState(false);
	const snapshot = useListingPresence({
		listingKind,
		listingId,
		enabled,
	});

	return (
		<>
			<ListingPresenceRow
				snapshot={snapshot}
				className={className}
				align={align}
				layout={layout}
				onOpenDrawer={() => setDrawerOpen(true)}
			/>
			<ListingPresenceDrawer
				open={drawerOpen}
				onOpenChange={setDrawerOpen}
				viewerCount={snapshot.viewerCount}
				viewingPatrons={snapshot.viewingPatrons}
			/>
		</>
	);
}
