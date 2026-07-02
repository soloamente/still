"use client";

import { cn } from "@still/ui/lib/utils";
import { Film, Tv } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { QuoteAttribution } from "@/components/quote/quote-attribution";
import { VisibilityChip } from "@/components/review/visibility-chip";
import { api } from "@/lib/api";
import { normalizeSavedQuotesPage } from "@/lib/normalize-saved-quotes-page";
import { QUOTE_PINS_CHANGED_EVENT } from "@/lib/quote-pins-events";
import type { SavedQuoteLobbyItem } from "@/lib/quote-saved-types";
import { savedQuoteListingHref } from "@/lib/quotes-lobby";

function ProfileSavedQuoteCard({
	item,
	isMe,
}: {
	item: SavedQuoteLobbyItem;
	isMe: boolean;
}) {
	const listingHref = savedQuoteListingHref(item.listing);

	return (
		<Link
			href={listingHref}
			className={cn(
				"group flex w-full items-stretch gap-3 rounded-2xl bg-background p-3 text-left sm:gap-3.5 sm:p-3.5",
				"transition-transform duration-150 active:scale-[0.96] motion-reduce:active:scale-100",
			)}
		>
			<div
				className={cn(
					"relative w-16 shrink-0 self-stretch overflow-hidden rounded-xl bg-muted/20 sm:w-[4.5rem]",
					"outline outline-1 outline-black/10 dark:outline-white/10",
				)}
			>
				{item.listing.posterUrl ? (
					<Image
						src={item.listing.posterUrl}
						alt=""
						fill
						sizes="72px"
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
			</div>

			<div className="min-w-0 flex-1 py-0.5">
				<div className="flex flex-wrap items-center gap-x-2 gap-y-1">
					<p className="truncate font-medium text-foreground text-sm">
						{item.listing.title}
					</p>
					{isMe && item.visibility !== "public" ? (
						<VisibilityChip visibility={item.visibility} />
					) : null}
				</div>
				<p className="mt-1 line-clamp-2 text-pretty font-editorial text-foreground/90 text-sm leading-relaxed">
					{item.quote.body}
				</p>
				<QuoteAttribution
					className="mt-1.5"
					size="compact"
					speaker={item.quote.speaker}
					timestampLabel={item.quote.timestampLabel}
				/>
			</div>
		</Link>
	);
}

/** Up to three pinned quotes under showcase — only explicit pins from `/quotes`. */
export function ProfileSavedQuotesStrip({
	handle,
	items: initialItems,
	isMe,
	showViewAll = false,
	className,
}: {
	handle: string;
	items: SavedQuoteLobbyItem[];
	isMe: boolean;
	showViewAll?: boolean;
	className?: string;
}) {
	const [items, setItems] = useState(initialItems);

	useEffect(() => {
		setItems(initialItems);
	}, [initialItems]);

	const refreshPinnedQuotes = useCallback(async () => {
		if (!isMe) return;
		const res = await api.api.profiles({ handle }).quotes.get({
			query: { page: "1", limit: "3" },
		});
		if (res.error != null) return;
		setItems(normalizeSavedQuotesPage(res.data).items);
	}, [handle, isMe]);

	useEffect(() => {
		if (!isMe) return;
		const onChanged = () => void refreshPinnedQuotes();
		window.addEventListener(QUOTE_PINS_CHANGED_EVENT, onChanged);
		return () =>
			window.removeEventListener(QUOTE_PINS_CHANGED_EVENT, onChanged);
	}, [isMe, refreshPinnedQuotes]);

	if (items.length === 0) return null;

	return (
		<section
			className={cn("mx-auto mt-4 w-full max-w-lg text-left", className)}
			aria-label="Pinned quotes"
		>
			<div className="mb-2 flex items-center justify-center gap-3">
				<p className="font-medium text-[10px] text-muted-foreground uppercase tracking-[0.12em]">
					Pinned quotes
				</p>
				{showViewAll ? (
					<Link
						href="/quotes"
						className="font-medium text-[10px] text-muted-foreground uppercase tracking-[0.12em] transition-[color,transform] duration-200 ease-out active:scale-[0.96] motion-reduce:transition-none motion-reduce:active:scale-100 [@media(hover:hover)]:hover:text-foreground"
					>
						Manage quotes
					</Link>
				) : null}
			</div>
			<ul className="flex flex-col gap-2">
				{items.map((item) => (
					<li key={item.saveId}>
						<ProfileSavedQuoteCard item={item} isMe={isMe} />
					</li>
				))}
			</ul>
		</section>
	);
}
