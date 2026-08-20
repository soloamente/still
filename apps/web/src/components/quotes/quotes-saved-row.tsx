"use client";

import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@still/ui/components/popover";
import IconLockFill from "@still/ui/icons/lock-fill";
import { cn } from "@still/ui/lib/utils";
import { Check, ChevronDown } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ReviewQuoteMarkLeft } from "@/components/movie/review-quote-mark";
import { QuoteAttribution } from "@/components/quote/quote-attribution";
import { QuotePinToProfileButton } from "@/components/quote/quote-pin-to-profile-button";
import {
	QUOTES_LOBBY_CARD_CLASSNAME,
	QuotesLobbyListingMeta,
} from "@/components/quotes/quotes-lobby-listing-meta";
import type { ContentVisibility } from "@/components/review/visibility-select";
import { api } from "@/lib/api";
import { DETAIL_CANVAS_ON_CARD_HOVER_CLASS } from "@/lib/detail-action-motion";
import { formatTimeAgoLabel } from "@/lib/format";
import type { SavedQuoteLobbyItem } from "@/lib/quote-saved-types";

/** @deprecated Prefer `QUOTES_LOBBY_CARD_CLASSNAME` — kept for existing imports. */
export const QUOTES_SAVED_CARD_CLASSNAME = QUOTES_LOBBY_CARD_CLASSNAME;

const VISIBILITY_OPTIONS: readonly {
	value: ContentVisibility;
	label: string;
	description: string;
}[] = [
	{ value: "public", label: "Public", description: "Anyone can see this save" },
	{
		value: "followers",
		label: "Followers",
		description: "People who follow you",
	},
	{
		value: "friends",
		label: "Friends",
		description: "People you follow back",
	},
	{ value: "private", label: "Private", description: "Only you" },
] as const;

const VISIBILITY_SHORT_LABEL: Record<ContentVisibility, string> = {
	public: "Public",
	followers: "Followers",
	friends: "Friends",
	private: "Only you",
};

/** Compact popover — change who can see a saved quote without a full-width field. */
function QuoteSaveVisibilityControl({
	value,
	disabled,
	onChange,
}: {
	value: ContentVisibility;
	disabled: boolean;
	onChange: (next: ContentVisibility) => void;
}) {
	const [open, setOpen] = useState(false);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger
				type="button"
				disabled={disabled}
				className={cn(
					"inline-flex min-h-10 items-center gap-1.5 rounded-full bg-card px-3 py-2 font-medium text-muted-foreground text-xs transition-[transform,color] duration-200 ease-out active:scale-[0.96] motion-reduce:transition-none motion-reduce:active:scale-100",
					DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
					disabled && "pointer-events-none opacity-50",
				)}
				aria-label={`Visibility: ${VISIBILITY_SHORT_LABEL[value]}. Change who can see this saved quote.`}
			>
				{value === "private" ? (
					<IconLockFill size="10px" className="shrink-0" aria-hidden />
				) : null}
				<span>{VISIBILITY_SHORT_LABEL[value]}</span>
				<ChevronDown className="size-3 shrink-0 opacity-70" aria-hidden />
			</PopoverTrigger>
			<PopoverContent
				align="end"
				className="w-[min(calc(100vw-2rem),18rem)] rounded-2xl border-0 bg-card p-1.5 shadow-none"
			>
				<div
					role="listbox"
					aria-label="Choose who can see this saved quote"
					className="flex flex-col gap-0.5"
				>
					{VISIBILITY_OPTIONS.map((option) => {
						const selected = option.value === value;
						return (
							<button
								key={option.value}
								type="button"
								role="option"
								aria-selected={selected}
								className={cn(
									"flex w-full items-start gap-2 rounded-xl px-3 py-2.5 text-left transition-colors duration-200 ease-out motion-reduce:transition-none",
									selected
										? "bg-foreground/10 text-foreground"
										: cn("text-foreground", DETAIL_CANVAS_ON_CARD_HOVER_CLASS),
								)}
								onClick={() => {
									setOpen(false);
									onChange(option.value);
								}}
							>
								<span className="mt-0.5 flex size-4 shrink-0 items-center justify-center">
									{selected ? <Check className="size-3.5" aria-hidden /> : null}
								</span>
								<span className="min-w-0">
									<span className="block font-medium text-sm">
										{option.label}
									</span>
									<span className="mt-0.5 block text-muted-foreground text-xs leading-snug">
										{option.description}
									</span>
								</span>
							</button>
						);
					})}
				</div>
			</PopoverContent>
		</Popover>
	);
}

/** Saved quote card — quote body first; listing + owner actions in a quiet footer. */
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

	return (
		<article className={QUOTES_LOBBY_CARD_CLASSNAME}>
			{/* Quote is the apex — mark + body + speaker before any chrome. */}
			<div>
				<ReviewQuoteMarkLeft className="mb-3 opacity-70" />
				<blockquote className="text-pretty font-editorial text-foreground text-xl leading-relaxed sm:text-2xl">
					{item.quote.body}
				</blockquote>
				<QuoteAttribution
					className="mt-4"
					size="detail"
					speaker={item.quote.speaker}
					timestampLabel={item.quote.timestampLabel}
				/>
			</div>

			<footer className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
				<QuotesLobbyListingMeta listing={item.listing} />
				<div className="flex flex-wrap items-center gap-2 sm:justify-end">
					<span className="text-muted-foreground text-xs tabular-nums">
						Saved {savedLabel}
					</span>
					{isOwner ? (
						<>
							<QuoteSaveVisibilityControl
								value={item.visibility}
								disabled={visibilityBusy}
								onChange={(next) => void handleVisibilityChange(next)}
							/>
							<QuotePinToProfileButton saveId={item.saveId} variant="compact" />
						</>
					) : null}
				</div>
			</footer>
		</article>
	);
}
