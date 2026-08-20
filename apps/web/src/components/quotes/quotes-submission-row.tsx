"use client";

import { cn } from "@still/ui/lib/utils";
import Link from "next/link";

import { ReviewQuoteMarkLeft } from "@/components/movie/review-quote-mark";
import { QuoteAttribution } from "@/components/quote/quote-attribution";
import {
	QUOTES_LOBBY_CARD_CLASSNAME,
	QuotesLobbyListingMeta,
} from "@/components/quotes/quotes-lobby-listing-meta";
import { DETAIL_CANVAS_ON_CARD_HOVER_CLASS } from "@/lib/detail-action-motion";
import { formatTimeAgoLabel } from "@/lib/format";
import type {
	QuoteSubmissionLobbyItem,
	QuoteSubmissionStatus,
} from "@/lib/quote-submission-types";
import { savedQuoteListingHref } from "@/lib/quotes-lobby";

const STATUS_LABEL: Record<QuoteSubmissionStatus, string> = {
	pending: "Pending review",
	approved: "Approved",
	rejected: "Declined",
};

const STATUS_PILL_CLASS: Record<QuoteSubmissionStatus, string> = {
	pending: "bg-card text-muted-foreground",
	approved: "bg-foreground/10 text-foreground",
	rejected: "bg-destructive/10 text-destructive",
};

/** Patron submission card — quote first; status + title live in the footer. */
export function QuotesSubmissionRow({
	item,
}: {
	item: QuoteSubmissionLobbyItem;
}) {
	const listingHref = savedQuoteListingHref(item.listing);
	const submittedLabel = formatTimeAgoLabel(item.createdAt);
	const reviewedLabel = item.reviewedAt
		? formatTimeAgoLabel(item.reviewedAt)
		: null;

	return (
		<article className={QUOTES_LOBBY_CARD_CLASSNAME}>
			<div>
				<ReviewQuoteMarkLeft className="mb-3 opacity-70" />
				<blockquote className="text-pretty font-editorial text-foreground text-xl leading-relaxed sm:text-2xl">
					{item.body}
				</blockquote>
				<QuoteAttribution
					className="mt-4"
					size="detail"
					speaker={item.speaker}
					timestampLabel={item.timestampLabel}
				/>
			</div>

			<footer className="mt-6 flex flex-col gap-3">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
					<QuotesLobbyListingMeta listing={item.listing} />
					<div className="flex flex-wrap items-center gap-2 sm:justify-end">
						<span
							className={cn(
								"inline-flex min-h-10 items-center rounded-full px-3 py-2 font-medium text-xs",
								STATUS_PILL_CLASS[item.status],
							)}
						>
							{STATUS_LABEL[item.status]}
						</span>
						{item.status === "approved" && item.resolvedQuoteId ? (
							<Link
								href={listingHref}
								className={cn(
									"inline-flex min-h-10 items-center rounded-full bg-card px-3 py-2 font-medium text-foreground text-xs",
									DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
								)}
							>
								View on title
							</Link>
						) : null}
					</div>
				</div>
				<p className="text-muted-foreground text-xs tabular-nums">
					Submitted {submittedLabel}
					{reviewedLabel ? ` · Reviewed ${reviewedLabel}` : null}
				</p>
				{item.status === "rejected" && item.staffNote ? (
					<p className="text-pretty text-muted-foreground text-sm leading-relaxed">
						<span className="font-medium text-foreground">Staff note:</span>{" "}
						{item.staffNote}
					</p>
				) : null}
			</footer>
		</article>
	);
}
