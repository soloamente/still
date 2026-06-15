"use client";

import { Input } from "@still/ui/components/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@still/ui/components/popover";
import { cn } from "@still/ui/lib/utils";
import { Loader2, Search } from "lucide-react";
import {
	type KeyboardEvent,
	type ReactElement,
	useEffect,
	useRef,
	useState,
} from "react";

import { ListingMentionPickerRow } from "@/components/review/review-body-with-mentions";
import { showcaseItemKey } from "@/lib/profile-showcase";
import { listingMentionPickerSubtitle } from "@/lib/review-listing-mentions";
import { tmdbPosterUrlFromPath } from "@/lib/tmdb-poster-url";
import {
	type ListingMentionSearchHit,
	useListingMentionSearch,
} from "@/lib/use-listing-mention-search";
import { useSheetScrollFades } from "@/lib/use-sheet-scroll-fades";

/** Edge fades on the listing search list — matches review `@` mention picker. */
function ListingPickerMenuScrims({
	showHeaderFade,
	showFooterFade,
}: {
	showHeaderFade: boolean;
	showFooterFade: boolean;
}) {
	return (
		<>
			<div
				aria-hidden
				className={cn(
					"pointer-events-none absolute inset-x-0 top-0 z-10 h-12 bg-linear-to-b from-25% from-popover via-popover/85 to-transparent motion-reduce:transition-none",
					showHeaderFade ? "opacity-100" : "opacity-0",
				)}
			/>
			<div
				aria-hidden
				className={cn(
					"pointer-events-none absolute inset-x-0 bottom-0 z-10 h-14 bg-linear-to-t from-15% from-popover/95 via-popover/25 to-transparent motion-reduce:transition-none",
					showFooterFade ? "opacity-100" : "opacity-0",
				)}
			/>
		</>
	);
}

/**
 * Films & TV search popover — same row UI as review `@` mentions.
 * Anchored to the showcase **Add** slot trigger.
 */
export function ProfileShowcaseListingPickerPopover({
	trigger,
	disabled,
	reservedKeys,
	onPick,
}: {
	trigger: ReactElement;
	disabled?: boolean;
	/** Already in the patron showcase — rows stay visible but not selectable. */
	reservedKeys: ReadonlySet<string>;
	onPick: (hit: ListingMentionSearchHit) => void;
}) {
	const searchInputRef = useRef<HTMLInputElement>(null);
	const listScrollRef = useRef<HTMLDivElement>(null);
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [highlightIndex, setHighlightIndex] = useState(0);

	const { results, loading } = useListingMentionSearch(query, 200);

	const listContentKey = results
		.map((hit) => `${hit.listingKind}-${hit.id}`)
		.join("\0");
	const { showHeaderFade, showFooterFade } = useSheetScrollFades(
		listScrollRef,
		open && results.length > 0,
		listContentKey,
	);

	useEffect(() => {
		if (!open) {
			setQuery("");
			setHighlightIndex(0);
			return;
		}
		const timer = window.setTimeout(() => searchInputRef.current?.focus(), 50);
		return () => window.clearTimeout(timer);
	}, [open]);

	useEffect(() => {
		void listContentKey;
		setHighlightIndex(0);
	}, [listContentKey]);

	useEffect(() => {
		if (!open || results.length === 0) return;
		listScrollRef.current
			?.querySelector(`[data-showcase-picker-index="${highlightIndex}"]`)
			?.scrollIntoView({ block: "nearest" });
	}, [highlightIndex, open, results.length]);

	const handlePick = (index: number) => {
		const hit = results[index];
		if (!hit) return;
		const key = showcaseItemKey({ kind: hit.listingKind, id: hit.id });
		if (reservedKeys.has(key)) return;
		onPick(hit);
		setOpen(false);
	};

	const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		if (results.length === 0) return;

		if (event.key === "ArrowDown") {
			event.preventDefault();
			setHighlightIndex((current) => (current + 1) % results.length);
			return;
		}
		if (event.key === "ArrowUp") {
			event.preventDefault();
			setHighlightIndex(
				(current) => (current - 1 + results.length) % results.length,
			);
			return;
		}
		if (event.key === "Enter" || event.key === "Tab") {
			const hit = results[highlightIndex];
			if (!hit) return;
			const key = showcaseItemKey({ kind: hit.listingKind, id: hit.id });
			if (reservedKeys.has(key)) return;
			event.preventDefault();
			handlePick(highlightIndex);
		}
	};

	return (
		<Popover open={open} onOpenChange={setOpen} modal={false}>
			<PopoverTrigger render={trigger} disabled={disabled} />
			<PopoverContent
				side="bottom"
				align="center"
				sideOffset={10}
				initialFocus={false}
				positionerClassName="z-[250]"
				className="w-[min(100vw-2rem,20rem)] overflow-visible rounded-[1.75rem] border-0 bg-popover p-2 text-popover-foreground shadow-mobbin-xl ring-1 ring-foreground/10"
			>
				<div className="relative mb-2">
					<Search
						className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
						aria-hidden
					/>
					<Input
						ref={searchInputRef}
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						onKeyDown={handleSearchKeyDown}
						placeholder="Search films and TV…"
						autoComplete="off"
						spellCheck={false}
						className="h-10 rounded-2xl border-0 bg-background pl-10 text-sm"
						role="combobox"
						aria-expanded={results.length > 0}
						aria-controls="showcase-listing-picker-listbox"
					/>
				</div>

				{loading ? (
					<div className="flex items-center justify-center gap-2 px-3 py-4 text-muted-foreground text-sm">
						<Loader2 className="size-4 animate-spin" aria-hidden />
						Searching…
					</div>
				) : results.length === 0 ? (
					<p className="px-3 py-4 text-center text-muted-foreground text-sm">
						{query.trim()
							? `No matches for “${query.trim()}”`
							: "Type a film or TV title"}
					</p>
				) : (
					<div className="relative min-h-0 overflow-hidden rounded-2xl">
						<ListingPickerMenuScrims
							showHeaderFade={showHeaderFade}
							showFooterFade={showFooterFade}
						/>
						<div
							ref={listScrollRef}
							id="showcase-listing-picker-listbox"
							role="listbox"
							aria-label="Films and TV shows"
							className="scrollbar-none max-h-56 min-h-0 overflow-y-auto overscroll-y-contain [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
						>
							{results.map((hit, index) => {
								const key = showcaseItemKey({
									kind: hit.listingKind,
									id: hit.id,
								});
								const taken = reservedKeys.has(key);
								return (
									<div
										key={`${hit.listingKind}-${hit.id}`}
										data-showcase-picker-index={index}
									>
										<ListingMentionPickerRow
											title={hit.title}
											subtitle={
												taken
													? "Already in showcase"
													: listingMentionPickerSubtitle(hit)
											}
											posterUrl={tmdbPosterUrlFromPath(hit.poster_url, "w92")}
											active={index === highlightIndex && !taken}
											onMouseEnter={() => setHighlightIndex(index)}
											onSelect={() => {
												if (!taken) handlePick(index);
											}}
										/>
									</div>
								);
							})}
						</div>
					</div>
				)}
			</PopoverContent>
		</Popover>
	);
}
