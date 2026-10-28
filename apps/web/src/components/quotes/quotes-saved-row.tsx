"use client";

import { cn } from "@still/ui/lib/utils";
import { Film, Tv } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { resolveQuoteAttribution } from "@/lib/quote-attribution";
import type { SavedQuoteLobbyItem } from "@/lib/quote-saved-types";
import { savedQuoteListingHref } from "@/lib/quotes-lobby";

/**
 * Figma 4523:486 — one lighter tile on the lobby panel.
 * Canvas (`bg-background`) sits above the darker `bg-card` shell.
 */
export const QUOTES_SAVED_OUTER_SHELL_CLASSNAME =
	"flex min-h-[16.5rem] items-stretch gap-1.5 rounded-[1.5625rem] bg-background p-3.5";

/** @deprecated Prefer `QUOTES_SAVED_OUTER_SHELL_CLASSNAME`. */
export const QUOTES_SAVED_CARD_CLASSNAME = QUOTES_SAVED_OUTER_SHELL_CLASSNAME;

/** Poster + quote share one tile in this frame — no nested card. */
export const QUOTES_SAVED_INNER_CARD_CLASSNAME = "contents";

function QuotesSavedSpeakerPill({ speaker }: { speaker: string }) {
	const initial = speaker.trim().charAt(0).toUpperCase() || "?";
	return (
		<div className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full bg-card py-1.5 pr-3.5 pl-1.5">
			<span
				className="grid size-[1.4rem] shrink-0 place-items-center rounded-full bg-background font-medium text-[0.65rem] text-foreground"
				aria-hidden
			>
				{initial}
			</span>
			<span className="truncate font-medium text-[0.825rem] text-foreground">
				{speaker}
			</span>
		</div>
	);
}

/** Saved quote tile — Figma 4523:485 (poster, line, speaker, in-film time). */
export function QuotesSavedRow({ item }: { item: SavedQuoteLobbyItem }) {
	const listingHref = savedQuoteListingHref(item.listing);
	const attribution = resolveQuoteAttribution({
		speaker: item.quote.speaker,
		timestampLabel: item.quote.timestampLabel,
	});

	return (
		<article className={QUOTES_SAVED_OUTER_SHELL_CLASSNAME}>
			<Link
				href={listingHref}
				className={cn(
					"relative aspect-2/3 w-[7.75rem] shrink-0 self-stretch overflow-hidden rounded-[0.9375rem] bg-muted/20 sm:w-[9.5rem]",
					"transition-transform duration-150 active:scale-[0.98] motion-reduce:active:scale-100",
				)}
				aria-label={`Open ${item.listing.title}`}
			>
				{item.listing.posterUrl ? (
					<Image
						src={item.listing.posterUrl}
						alt=""
						fill
						sizes="190px"
						className="object-cover"
						unoptimized
					/>
				) : (
					<div
						className="grid size-full place-items-center text-muted-foreground"
						aria-hidden
					>
						{item.listing.kind === "tv" ? (
							<Tv className="size-6 opacity-70" />
						) : (
							<Film className="size-6 opacity-70" />
						)}
					</div>
				)}
			</Link>

			<div className="flex min-h-0 min-w-0 flex-1 flex-col justify-between px-2 py-0.5">
				<blockquote className="text-pretty font-medium text-[1.125rem] text-foreground leading-normal">
					&ldquo;{item.quote.body}&rdquo;
				</blockquote>

				<div className="mt-4 flex w-full min-w-0 items-center justify-between gap-3">
					{attribution.speaker ? (
						<QuotesSavedSpeakerPill speaker={attribution.speaker} />
					) : (
						<span className="min-w-0" />
					)}
					{attribution.timestampLabel ? (
						<time
							className="shrink-0 font-medium text-[0.825rem] text-foreground tabular-nums opacity-50"
							dateTime={attribution.timestampLabel}
						>
							{attribution.timestampLabel}
						</time>
					) : null}
				</div>
			</div>
		</article>
	);
}
