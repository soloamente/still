import { cn } from "@still/ui/lib/utils";
import { Film, Tv } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { DETAIL_CANVAS_ON_CARD_HOVER_CLASS } from "@/lib/detail-action-motion";
import type { SavedQuoteListingThumb } from "@/lib/quote-saved-types";
import { savedQuoteListingHref } from "@/lib/quotes-lobby";

/** Shared tile — flat `bg-background` on the lobby `bg-card` shell. */
export const QUOTES_LOBBY_CARD_CLASSNAME =
	"rounded-2xl bg-background px-5 py-6 sm:px-8 sm:py-8";

/** Year · S# · E# under the source title. */
export function quotesLobbyListingMetaLine(
	listing: SavedQuoteListingThumb,
): string | null {
	const episodeMeta =
		listing.kind === "tv" &&
		listing.seasonNumber != null &&
		listing.episodeNumber != null
			? `S${listing.seasonNumber} · E${listing.episodeNumber}`
			: null;
	const line = [listing.year != null ? String(listing.year) : null, episodeMeta]
		.filter(Boolean)
		.join(" · ");
	return line || null;
}

/** Quiet source footer — poster + title under the quote body. */
export function QuotesLobbyListingMeta({
	listing,
}: {
	listing: SavedQuoteListingThumb;
}) {
	const href = savedQuoteListingHref(listing);
	const meta = quotesLobbyListingMetaLine(listing);

	return (
		<div className="flex min-w-0 items-center gap-3">
			<Link
				href={href}
				className={cn(
					"relative aspect-2/3 w-10 shrink-0 overflow-hidden rounded-lg bg-muted/20 outline-1 outline-black/10 sm:w-11 dark:outline-white/10",
					"transition-transform duration-150 active:scale-[0.96] motion-reduce:active:scale-100",
				)}
				aria-label={`Open ${listing.title}`}
			>
				{listing.posterUrl ? (
					<Image
						src={listing.posterUrl}
						alt=""
						fill
						sizes="44px"
						className="object-cover"
						unoptimized
					/>
				) : (
					<div
						className="grid size-full place-items-center text-muted-foreground"
						aria-hidden
					>
						{listing.kind === "tv" ? (
							<Tv className="size-4 opacity-70" />
						) : (
							<Film className="size-4 opacity-70" />
						)}
					</div>
				)}
			</Link>
			<div className="min-w-0">
				<Link
					href={href}
					className={cn(
						"line-clamp-2 font-medium text-foreground text-sm leading-snug",
						DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
					)}
				>
					{listing.title}
				</Link>
				{meta ? (
					<p className="mt-0.5 text-muted-foreground text-xs tabular-nums">
						{meta}
					</p>
				) : null}
			</div>
		</div>
	);
}
