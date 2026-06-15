"use client";

import { Button } from "@still/ui/components/button";
import { cn } from "@still/ui/lib/utils";
import { Bookmark, ChevronUp } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import {
	DetailMotionButton,
	DetailMotionButtonWrap,
} from "@/components/movie/detail-motion-pressable";
import { QuoteAttribution } from "@/components/quote/quote-attribution";
import { QuoteDigitPopIn } from "@/components/quote/quote-digit-pop-in";
import { api } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { DETAIL_CANVAS_ON_CARD_HOVER_CLASS } from "@/lib/detail-action-motion";
import type { ListingQuoteItem } from "@/lib/quote-types";
import { SHEET_PRIMARY_PILL_CLASS } from "@/lib/sheet-chrome";

/** Single dialogue line — body, speaker, timestamp, upvote + save actions. */
export function QuoteRow({
	quote: initialQuote,
	onQuoteChange,
}: {
	quote: ListingQuoteItem;
	onQuoteChange?: (next: ListingQuoteItem) => void;
}) {
	const { data: session } = authClient.useSession();
	const [quote, setQuote] = useState(initialQuote);
	const [upvoteBusy, setUpvoteBusy] = useState(false);
	const [saveBusy, setSaveBusy] = useState(false);
	const [saveId, setSaveId] = useState<string | null>(null);

	const publish = useCallback(
		(next: ListingQuoteItem) => {
			setQuote(next);
			onQuoteChange?.(next);
		},
		[onQuoteChange],
	);

	function requireSignedIn(action: string): boolean {
		if (session?.user) return true;
		toast.error(`Sign in to ${action}`);
		return false;
	}

	async function handleUpvote() {
		if (!requireSignedIn("upvote quotes")) return;
		setUpvoteBusy(true);
		try {
			const res = await api.api.quotes({ id: quote.id }).upvote.post({});
			if (res.error) {
				toast.error("Couldn't update upvote");
				return;
			}
			const data = res.data as {
				upvoted?: boolean;
				upvoteCount?: number;
			};
			publish({
				...quote,
				viewerHasUpvoted: data.upvoted ?? quote.viewerHasUpvoted,
				upvoteCount:
					typeof data.upvoteCount === "number"
						? data.upvoteCount
						: quote.upvoteCount,
			});
		} finally {
			setUpvoteBusy(false);
		}
	}

	async function handleSaveToggle() {
		if (!requireSignedIn("save quotes")) return;
		setSaveBusy(true);
		try {
			if (quote.viewerHasSaved) {
				let id = saveId;
				if (!id) {
					const lookup = await api.api.quotes({ id: quote.id }).save.post({});
					if (lookup.error) {
						toast.error("Couldn't remove save");
						return;
					}
					id = (lookup.data as { saveId?: string })?.saveId ?? null;
				}
				if (!id) {
					toast.error("Couldn't remove save");
					return;
				}
				const del = await api.api.quotes.saves({ id }).delete();
				if (del.error) {
					toast.error("Couldn't remove save");
					return;
				}
				setSaveId(null);
				publish({ ...quote, viewerHasSaved: false });
				toast.success("Removed from your quotes");
				return;
			}

			const res = await api.api.quotes({ id: quote.id }).save.post({});
			if (res.error) {
				toast.error("Couldn't save quote");
				return;
			}
			const data = res.data as { saveId?: string };
			if (data.saveId) setSaveId(data.saveId);
			publish({ ...quote, viewerHasSaved: true });
			toast.success("Saved to your quotes");
		} finally {
			setSaveBusy(false);
		}
	}

	return (
		<article className="rounded-2xl bg-background px-5 py-5 sm:px-6 sm:py-6">
			<blockquote className="text-pretty font-editorial text-foreground text-lg leading-relaxed sm:text-xl">
				{quote.body}
			</blockquote>
			<QuoteAttribution
				className="mt-3"
				speaker={quote.speaker}
				timestampLabel={quote.timestampLabel}
			/>
			<div className="mt-4 flex items-center gap-2">
				<DetailMotionButton
					type="button"
					disabled={upvoteBusy}
					onClick={() => void handleUpvote()}
					className={cn(
						"inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 py-2 font-medium text-sm tabular-nums transition-colors duration-200 ease-out",
						quote.viewerHasUpvoted
							? "bg-foreground text-background"
							: cn(
									"bg-card text-foreground",
									DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
								),
					)}
					aria-pressed={quote.viewerHasUpvoted}
					aria-label={quote.viewerHasUpvoted ? "Remove upvote" : "Upvote quote"}
				>
					<ChevronUp className="size-4 shrink-0" aria-hidden />
					<QuoteDigitPopIn
						value={quote.upvoteCount}
						className="t-digit-group min-w-[1ch] tabular-nums"
					/>
				</DetailMotionButton>
				<DetailMotionButton
					type="button"
					disabled={saveBusy}
					onClick={() => void handleSaveToggle()}
					className={cn(
						"inline-flex size-10 items-center justify-center rounded-full transition-colors duration-200 ease-out",
						quote.viewerHasSaved
							? "bg-foreground text-background"
							: cn(
									"bg-card text-foreground",
									DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
								),
					)}
					aria-pressed={quote.viewerHasSaved}
					aria-label={quote.viewerHasSaved ? "Remove save" : "Save quote"}
				>
					<span
						className="t-icon-swap"
						data-state={quote.viewerHasSaved ? "b" : "a"}
						aria-hidden
					>
						<span className="t-icon" data-icon="a">
							<Bookmark className="size-4" strokeWidth={2} aria-hidden />
						</span>
						<span className="t-icon" data-icon="b">
							<Bookmark className="size-4 fill-current" aria-hidden />
						</span>
					</span>
				</DetailMotionButton>
			</div>
		</article>
	);
}

/** Opens the suggest sheet — primary pill on detail Quotes tab. */
export function QuoteSuggestCta({
	onClick,
	className,
	variant = "primary",
}: {
	onClick: () => void;
	className?: string;
	variant?: "primary" | "secondary";
}) {
	return (
		<DetailMotionButtonWrap>
			<Button
				type="button"
				variant={variant === "primary" ? "default" : "ghost"}
				size="pill"
				className={cn(
					variant === "primary"
						? cn(SHEET_PRIMARY_PILL_CLASS, "min-w-0 px-6")
						: cn(
								"h-auto min-h-10 border-transparent bg-card px-5 py-2.5 font-medium text-foreground",
								DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
							),
					className,
				)}
				onClick={onClick}
			>
				Suggest a quote
			</Button>
		</DetailMotionButtonWrap>
	);
}
