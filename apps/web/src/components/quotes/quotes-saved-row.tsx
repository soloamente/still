"use client";

import { cn } from "@still/ui/lib/utils";
import { Film, Tv } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { QuoteAttribution } from "@/components/quote/quote-attribution";
import { VisibilityChip } from "@/components/review/visibility-chip";
import type { ContentVisibility } from "@/components/review/visibility-select";
import { StillPopoverSelect } from "@/components/ui/still-popover-select";
import { api } from "@/lib/api";
import { DETAIL_CANVAS_ON_CARD_HOVER_CLASS } from "@/lib/detail-action-motion";
import { formatTimeAgoLabel } from "@/lib/format";
import type { SavedQuoteLobbyItem } from "@/lib/quote-saved-types";
import { savedQuoteListingHref } from "@/lib/quotes-lobby";

/** Saved quote row — poster, title, excerpt, optional visibility control (owner). */
export function QuotesSavedRow({
	item: initialItem,
	isOwner = true,
	onItemChange,
}: {
	item: SavedQuoteLobbyItem;
	isOwner?: boolean;
	onItemChange?: (next: SavedQuoteLobbyItem) => void;
}) {
	const [item, setItem] = useState(initialItem);
	const [visibilityBusy, setVisibilityBusy] = useState(false);
	const listingHref = savedQuoteListingHref(item.listing);
	const titleHref = listingHref;
	const savedLabel = formatTimeAgoLabel(item.savedAt);

	function publish(next: SavedQuoteLobbyItem) {
		setItem(next);
		onItemChange?.(next);
	}

	async function handleVisibilityChange(next: ContentVisibility) {
		if (!isOwner || next === item.visibility) return;
		setVisibilityBusy(true);
		try {
			const res = await api.api.quotes.saves({ id: item.saveId }).patch({
				visibility: next,
			});
			if (res.error) {
				toast.error("Couldn't update visibility");
				return;
			}
			publish({ ...item, visibility: next });
		} finally {
			setVisibilityBusy(false);
		}
	}

	const episodeMeta =
		item.listing.kind === "tv" &&
		item.listing.seasonNumber != null &&
		item.listing.episodeNumber != null
			? `S${item.listing.seasonNumber} · E${item.listing.episodeNumber}`
			: null;

	return (
		<article className="rounded-2xl bg-background px-4 py-4 sm:px-5 sm:py-5">
			<div className="flex items-start gap-3 sm:gap-4">
				<Link
					href={titleHref}
					className={cn(
						"relative aspect-2/3 w-16 shrink-0 overflow-hidden rounded-xl bg-muted/20 outline outline-black/10 dark:outline-white/10",
						"transition-transform duration-150 active:scale-[0.96] motion-reduce:active:scale-100",
					)}
					aria-label={`Open ${item.listing.title}`}
				>
					{item.listing.posterUrl ? (
						<Image
							src={item.listing.posterUrl}
							alt=""
							fill
							sizes="64px"
							className="object-cover"
							unoptimized
						/>
					) : (
						<div
							className="grid size-full place-items-center text-muted-foreground"
							aria-hidden
						>
							{item.listing.kind === "tv" ? (
								<Tv className="size-5 opacity-70" />
							) : (
								<Film className="size-5 opacity-70" />
							)}
						</div>
					)}
				</Link>

				<div className="min-w-0 flex-1">
					<div className="flex flex-wrap items-center gap-x-2 gap-y-1">
						<Link
							href={titleHref}
							className={cn(
								"font-medium text-foreground text-sm hover:underline sm:text-base",
								DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
							)}
						>
							{item.listing.title}
						</Link>
						{item.listing.year != null ? (
							<span className="text-muted-foreground text-xs tabular-nums">
								{item.listing.year}
							</span>
						) : null}
						{episodeMeta ? (
							<span className="font-mono text-muted-foreground text-xs tabular-nums">
								{episodeMeta}
							</span>
						) : null}
					</div>

					<blockquote className="mt-2 line-clamp-3 text-pretty font-editorial text-foreground text-sm leading-relaxed sm:text-base">
						{item.quote.body}
					</blockquote>

					<QuoteAttribution
						className="mt-2"
						size="compact"
						speaker={item.quote.speaker}
						timestampLabel={item.quote.timestampLabel}
					/>

					<div className="mt-3 flex flex-wrap items-center gap-2">
						<span className="text-muted-foreground text-xs tabular-nums">
							Saved {savedLabel}
						</span>
						{isOwner ? (
							item.visibility === "public" ? (
								<span className="rounded-full bg-card px-2 py-0.5 text-muted-foreground text-xs">
									Public
								</span>
							) : (
								<VisibilityChip visibility={item.visibility} />
							)
						) : null}
					</div>

					{isOwner ? (
						<div className="mt-3 max-w-xs">
							<StillPopoverSelect
								id={`quote-save-visibility-${item.saveId}`}
								value={item.visibility}
								onChange={(next) =>
									void handleVisibilityChange(next as ContentVisibility)
								}
								options={[
									{ value: "public", label: "Public — anyone" },
									{
										value: "followers",
										label: "Followers — people who follow you",
									},
									{
										value: "friends",
										label: "Friends — people you follow back",
									},
									{ value: "private", label: "Private — only you" },
								]}
								placeholder="Who can see this save"
								listAriaLabel="Choose who can see this saved quote"
								disabled={visibilityBusy}
							/>
						</div>
					) : null}
				</div>
			</div>
		</article>
	);
}
