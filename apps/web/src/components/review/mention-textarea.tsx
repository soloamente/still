"use client";

import { Popover, PopoverAnchoredContent } from "@still/ui/components/popover";
import { Textarea } from "@still/ui/components/textarea";
import { cn } from "@still/ui/lib/utils";
import { Loader2 } from "lucide-react";
import {
	type ChangeEvent,
	type KeyboardEvent,
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";

import { ListingMentionPickerRow } from "@/components/review/review-body-with-mentions";
import {
	getActiveListingMentionQuery,
	insertListingMention,
	listingMentionPickerSubtitle,
} from "@/lib/content-mentions";
import {
	measureTextareaCaretViewportAnchor,
	type TextareaCaretViewportAnchor,
} from "@/lib/textarea-caret-viewport";
import { tmdbPosterUrlFromPath } from "@/lib/tmdb-poster-url";
import { useListingMentionSearch } from "@/lib/use-listing-mention-search";
import { useSheetScrollFades } from "@/lib/use-sheet-scroll-fades";

export const MENTION_TEXTAREA_DEFAULT_PLACEHOLDER =
	"Use # for films and @ for people";

/** Top + bottom edge fades on the `#` picker list — matches notifications inbox scrims. */
function MentionPickerMenuScrims({
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

export type MentionTextareaListingContext = {
	kind: "movie" | "tv";
	tmdbId: number;
};

type MentionTextareaProps = {
	id: string;
	value: string;
	onChange: (next: string) => void;
	/** Title under review — used by `@` people picker (Task 5). */
	listingContext?: MentionTextareaListingContext | null;
	className?: string;
	rows?: number;
	maxLength?: number;
	placeholder?: string;
};

/**
 * Review/comment body field with `#` autocomplete for films and TV shows.
 * Inserts `#[Title](/movies|tv/id)` tokens readers can tap later.
 */
export function MentionTextarea({
	id,
	value,
	onChange,
	listingContext: _listingContext,
	className,
	rows = 6,
	maxLength,
	placeholder = MENTION_TEXTAREA_DEFAULT_PLACEHOLDER,
}: MentionTextareaProps) {
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const listScrollRef = useRef<HTMLDivElement>(null);
	const [mentionRange, setMentionRange] = useState<{
		start: number;
		end: number;
	} | null>(null);
	const [mentionQuery, setMentionQuery] = useState("");
	const [highlightIndex, setHighlightIndex] = useState(0);
	const [caretAnchor, setCaretAnchor] =
		useState<TextareaCaretViewportAnchor | null>(null);

	const { results, loading } = useListingMentionSearch(mentionQuery);
	const pickerOpen = mentionRange != null;
	const listContentKey = results
		.map((hit) => `${hit.listingKind}-${hit.id}`)
		.join("\0");
	const { showHeaderFade, showFooterFade } = useSheetScrollFades(
		listScrollRef,
		pickerOpen && results.length > 0,
		listContentKey,
	);

	const mentionHighlightKey = `${mentionQuery}\0${results.length}`;
	useEffect(() => {
		void mentionHighlightKey;
		setHighlightIndex(0);
	}, [mentionHighlightKey]);

	// Keep keyboard-highlighted row visible inside the faded scrollport.
	useEffect(() => {
		if (!pickerOpen || results.length === 0) return;
		const row = listScrollRef.current?.querySelector(
			`[data-mention-index="${highlightIndex}"]`,
		);
		row?.scrollIntoView({ block: "nearest" });
	}, [highlightIndex, pickerOpen, results.length]);

	const syncMentionState = useCallback((body: string, cursor: number) => {
		const active = getActiveListingMentionQuery(body, cursor);
		if (!active) {
			setMentionRange(null);
			setMentionQuery("");
			return;
		}
		setMentionRange({ start: active.start, end: active.end });
		setMentionQuery(active.query);
	}, []);

	const syncCaretAnchor = useCallback(() => {
		const el = textareaRef.current;
		if (!el || mentionRange == null) {
			setCaretAnchor(null);
			return;
		}
		const cursor = el.selectionStart ?? mentionRange.end;
		setCaretAnchor(measureTextareaCaretViewportAnchor(el, cursor));
	}, [mentionRange]);

	const caretAnchorKey = `${value.length}\0${mentionQuery}\0${mentionRange?.start ?? ""}:${mentionRange?.end ?? ""}`;
	useLayoutEffect(() => {
		void caretAnchorKey;
		syncCaretAnchor();
	}, [syncCaretAnchor, caretAnchorKey]);

	useEffect(() => {
		if (!pickerOpen) return;
		const el = textareaRef.current;
		if (!el) return;

		const handleReposition = () => syncCaretAnchor();
		el.addEventListener("scroll", handleReposition, { passive: true });
		window.addEventListener("resize", handleReposition);
		return () => {
			el.removeEventListener("scroll", handleReposition);
			window.removeEventListener("resize", handleReposition);
		};
	}, [pickerOpen, syncCaretAnchor]);

	const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
		const next = event.target.value;
		onChange(next);
		syncMentionState(next, event.target.selectionStart ?? next.length);
	};

	const handleSelect = (index: number) => {
		const hit = results[index];
		const range = mentionRange;
		const el = textareaRef.current;
		if (!hit || !range || !el) return;

		const { nextBody, nextCursor } = insertListingMention(value, range, {
			title: hit.title,
			listingKind: hit.listingKind,
			tmdbId: hit.id,
		});
		onChange(nextBody);
		setMentionRange(null);
		setMentionQuery("");
		setCaretAnchor(null);
		requestAnimationFrame(() => {
			el.focus();
			el.setSelectionRange(nextCursor, nextCursor);
		});
	};

	const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
		if (!pickerOpen || results.length === 0) return;

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
			event.preventDefault();
			handleSelect(highlightIndex);
			return;
		}
		if (event.key === "Escape") {
			event.preventDefault();
			setMentionRange(null);
			setMentionQuery("");
			setCaretAnchor(null);
		}
	};

	return (
		<Popover open={pickerOpen} modal={false}>
			<Textarea
				ref={textareaRef}
				id={id}
				value={value}
				onChange={handleChange}
				onKeyDown={handleKeyDown}
				onClick={(event) =>
					syncMentionState(
						value,
						event.currentTarget.selectionStart ?? value.length,
					)
				}
				onKeyUp={(event) =>
					syncMentionState(
						value,
						event.currentTarget.selectionStart ?? value.length,
					)
				}
				rows={rows}
				maxLength={maxLength}
				placeholder={placeholder}
				spellCheck
				className={className}
			/>

			<PopoverAnchoredContent
				anchor={caretAnchor}
				side="top"
				align="start"
				sideOffset={8}
				initialFocus={false}
				positionerClassName="z-[100]"
				className="w-[min(100vw-2rem,20rem)] overflow-visible rounded-[1.75rem] border-0 bg-popover p-2 text-popover-foreground shadow-mobbin-xl ring-1 ring-foreground/10"
				role="listbox"
				aria-label="Tag a film or show"
			>
				{loading ? (
					<div className="flex items-center justify-center gap-2 px-3 py-4 text-muted-foreground text-sm">
						<Loader2 className="size-4 animate-spin" aria-hidden />
						Searching…
					</div>
				) : results.length === 0 ? (
					<p className="px-3 py-4 text-center text-muted-foreground text-sm">
						{mentionQuery
							? `No matches for #${mentionQuery}`
							: "Type # and a film or TV title to tag it"}
					</p>
				) : (
					<div className="relative min-h-0 overflow-hidden rounded-2xl">
						<MentionPickerMenuScrims
							showHeaderFade={showHeaderFade}
							showFooterFade={showFooterFade}
						/>
						<div
							ref={listScrollRef}
							className="scrollbar-none max-h-56 min-h-0 overflow-y-auto overscroll-y-contain [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
						>
							{results.map((hit, index) => (
								<div
									key={`${hit.listingKind}-${hit.id}`}
									data-mention-index={index}
								>
									<ListingMentionPickerRow
										title={hit.title}
										subtitle={listingMentionPickerSubtitle(hit)}
										posterUrl={tmdbPosterUrlFromPath(hit.poster_url, "w92")}
										active={index === highlightIndex}
										onMouseEnter={() => setHighlightIndex(index)}
										onSelect={() => handleSelect(index)}
									/>
								</div>
							))}
						</div>
					</div>
				)}
			</PopoverAnchoredContent>
		</Popover>
	);
}
