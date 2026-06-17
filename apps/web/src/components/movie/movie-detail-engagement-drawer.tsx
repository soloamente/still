"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { DetailDrawerScrollBody } from "@/components/movie/detail-drawer-scroll-body";
import { DetailVaulSheet } from "@/components/movie/detail-vaul-sheet";
import {
	ListingEngagementListRow,
	ListingEngagementPatronRow,
	ListingEngagementWatchRow,
} from "@/components/movie/movie-detail-engagement-drawer-rows";
import { SheetScrollScrims } from "@/components/movie/sheet-scroll-scrims";
import {
	fetchListingEngagementByKind,
	formatListingEngagementPrivateGapFooter,
	type ListingEngagementListItem,
	type ListingEngagementPatronItem,
	type ListingEngagementWatchItem,
} from "@/lib/fetch-listing-engagement";
import type { ListingEngagementChipKind } from "@/lib/listing-engagement-chip-copy";
import {
	listingEngagementDrawerDescription,
	listingEngagementDrawerEmptyCopy,
	listingEngagementDrawerTitle,
} from "@/lib/listing-engagement-drawer-copy";
import { useSheetScrollFades } from "@/lib/use-sheet-scroll-fades";

type DrawerPayload =
	| {
			kind: "watched" | "favorited";
			items: ListingEngagementWatchItem[];
	  }
	| { kind: "lists"; items: ListingEngagementListItem[] }
	| { kind: "watchlist"; items: ListingEngagementPatronItem[] };

function isWatchKind(
	kind: ListingEngagementChipKind,
): kind is "watched" | "favorited" {
	return kind === "watched" || kind === "favorited";
}

/**
 * Letterboxd-style engagement drawer — paginated patron/list rows scoped to the viewer.
 */
export function MovieDetailEngagementDrawer({
	open,
	onOpenChange,
	listingKind,
	listingId,
	kind,
	movieId,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	listingKind: "movie" | "tv";
	listingId: number;
	kind: ListingEngagementChipKind | null;
	movieId?: number;
}) {
	const scrollRef = useRef<HTMLDivElement>(null);
	const contentKey = kind ? `${listingKind}:${listingId}:${kind}` : "closed";
	const { showHeaderFade, showFooterFade } = useSheetScrollFades(
		scrollRef,
		open,
		contentKey,
	);

	const [items, setItems] = useState<DrawerPayload["items"]>([]);
	const [page, setPage] = useState(1);
	const [hasMore, setHasMore] = useState(false);
	const [totalVisible, setTotalVisible] = useState(0);
	const [totalGlobal, setTotalGlobal] = useState(0);
	const [loading, setLoading] = useState(false);
	const [loadingMore, setLoadingMore] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const reset = useCallback(() => {
		setItems([]);
		setPage(1);
		setHasMore(false);
		setTotalVisible(0);
		setTotalGlobal(0);
		setError(null);
	}, []);

	const loadPage = useCallback(
		async (targetPage: number, append: boolean, signal?: AbortSignal) => {
			if (!kind) return;

			if (targetPage === 1) setLoading(true);
			else setLoadingMore(true);
			setError(null);

			try {
				const payload = await fetchListingEngagementByKind({
					listingKind,
					listingId,
					kind,
					page: targetPage,
					signal,
				});

				if (signal?.aborted) return;

				if (!payload) {
					setError("Could not load engagement details.");
					if (!append) setItems([]);
					return;
				}

				setPage(payload.page);
				setHasMore(payload.hasMore);
				setTotalVisible(payload.totalVisible);
				setTotalGlobal(payload.totalGlobal);
				setItems((prev) => {
					if (!append) return payload.items as DrawerPayload["items"];
					return [...prev, ...payload.items] as DrawerPayload["items"];
				});
			} catch {
				if (!signal?.aborted) {
					setError("Could not load engagement details.");
				}
			} finally {
				if (!signal?.aborted) {
					setLoading(false);
					setLoadingMore(false);
				}
			}
		},
		[kind, listingId, listingKind],
	);

	// Stable dependency list — always includes `loadPage` so React never sees a resized array (HMR-safe).
	useEffect(() => {
		if (!open || !kind) return;

		const controller = new AbortController();
		reset();
		void loadPage(1, false, controller.signal);

		return () => controller.abort();
	}, [open, kind, listingId, listingKind, reset, loadPage]);

	const privateGapFooter =
		kind != null
			? formatListingEngagementPrivateGapFooter({
					kind,
					totalVisible,
					totalGlobal,
				})
			: null;

	const title = kind ? listingEngagementDrawerTitle(kind) : "Engagement";
	const description = kind
		? listingEngagementDrawerDescription(kind)
		: undefined;
	const emptyCopy = kind ? listingEngagementDrawerEmptyCopy(kind) : null;

	return (
		<DetailVaulSheet
			open={open}
			onOpenChange={onOpenChange}
			title={title}
			description={description}
			appStack
		>
			<div className="relative isolate flex min-h-0 w-full flex-1 flex-col">
				<DetailDrawerScrollBody scrollRef={scrollRef}>
					<div className="mx-auto w-full max-w-lg px-4 pt-2 pb-10 sm:max-w-xl">
						{loading ? (
							<div
								className="flex justify-center py-16"
								role="status"
								aria-live="polite"
							>
								<Loader2 className="size-8 animate-spin text-muted-foreground" />
							</div>
						) : null}

						{error ? (
							<p
								className="rounded-2xl bg-muted/25 p-8 text-center text-muted-foreground text-sm"
								role="alert"
							>
								{error}
							</p>
						) : null}

						{!loading && !error && items.length === 0 ? (
							<p
								className="rounded-2xl bg-muted/25 p-8 text-center text-muted-foreground text-sm"
								role="status"
							>
								{emptyCopy}
							</p>
						) : null}

						{!loading && !error && items.length > 0 && kind ? (
							<ul className="space-y-3">
								{isWatchKind(kind)
									? (items as ListingEngagementWatchItem[]).map((item) => (
											<li key={item.userId}>
												<ListingEngagementWatchRow
													item={item}
													movieId={movieId}
												/>
											</li>
										))
									: null}
								{kind === "lists"
									? (items as ListingEngagementListItem[]).map((item) => (
											<li key={item.id}>
												<ListingEngagementListRow item={item} />
											</li>
										))
									: null}
								{kind === "watchlist"
									? (items as ListingEngagementPatronItem[]).map((item) => (
											<li key={item.userId}>
												<ListingEngagementPatronRow item={item} />
											</li>
										))
									: null}
							</ul>
						) : null}

						{!loading && !error && hasMore ? (
							<div className="mt-6 flex justify-center">
								<button
									type="button"
									disabled={loadingMore}
									className="inline-flex min-h-10 items-center justify-center rounded-full bg-card px-5 py-2 font-medium text-foreground text-sm disabled:opacity-60"
									onClick={() => void loadPage(page + 1, true)}
								>
									{loadingMore ? (
										<Loader2 className="size-4 animate-spin" aria-hidden />
									) : (
										"Load more"
									)}
								</button>
							</div>
						) : null}

						{privateGapFooter ? (
							<p className="mt-8 text-center text-muted-foreground text-xs leading-relaxed">
								{privateGapFooter}
							</p>
						) : null}
					</div>
				</DetailDrawerScrollBody>
				<SheetScrollScrims
					showHeaderFade={showHeaderFade}
					showFooterFade={showFooterFade}
					footerTone="filmography"
				/>
			</div>
		</DetailVaulSheet>
	);
}
