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
	useMemo,
	useRef,
	useState,
} from "react";

import {
	ListingMentionPickerRow,
	PatronMentionPickerRow,
	PersonMentionPickerRow,
} from "@/components/review/review-body-with-mentions";
import { castCrewMetaLine } from "@/lib/cast-crew-search-query";
import {
	getActiveListingMentionQuery,
	getActivePeopleMentionQuery,
	insertListingMention,
	insertPatronMention,
	insertPersonMention,
	isPatronMentionQuery,
	listingMentionPickerSubtitle,
} from "@/lib/content-mentions";
import {
	measureTextareaCaretViewportAnchor,
	type TextareaCaretViewportAnchor,
} from "@/lib/textarea-caret-viewport";
import { tmdbPosterUrlFromPath } from "@/lib/tmdb-poster-url";
import { useListingMentionSearch } from "@/lib/use-listing-mention-search";
import { usePatronMentionSearch } from "@/lib/use-patron-mention-search";
import { usePeopleMentionSearch } from "@/lib/use-people-mention-search";
import { useSheetScrollFades } from "@/lib/use-sheet-scroll-fades";

export const MENTION_TEXTAREA_DEFAULT_PLACEHOLDER =
	"Use # for films and @ for people";

type MentionPickerKind = "listing" | "people";

/** Top + bottom edge fades on mention picker lists — matches notifications inbox scrims. */
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
	/** Title under review — title cast/crew rail for `@` when set. */
	listingContext?: MentionTextareaListingContext | null;
	className?: string;
	rows?: number;
	maxLength?: number;
	placeholder?: string;
};

/**
 * Review/comment body field with `#` film/TV and `@` people/patron autocomplete.
 */
export function MentionTextarea({
	id,
	value,
	onChange,
	listingContext = null,
	className,
	rows = 6,
	maxLength,
	placeholder = MENTION_TEXTAREA_DEFAULT_PLACEHOLDER,
}: MentionTextareaProps) {
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const listScrollRef = useRef<HTMLDivElement>(null);
	const [pickerKind, setPickerKind] = useState<MentionPickerKind | null>(null);
	const [mentionRange, setMentionRange] = useState<{
		start: number;
		end: number;
	} | null>(null);
	const [mentionQuery, setMentionQuery] = useState("");
	const [highlightIndex, setHighlightIndex] = useState(0);
	const [caretAnchor, setCaretAnchor] =
		useState<TextareaCaretViewportAnchor | null>(null);

	const pickerOpen = pickerKind != null && mentionRange != null;
	// Cast/crew search always runs; patrons are merged when the query looks handle-like.
	const includePatronSearch =
		pickerKind === "people" && isPatronMentionQuery(mentionQuery);

	const { results: listingResults, loading: listingLoading } =
		useListingMentionSearch(pickerKind === "listing" ? mentionQuery : "");
	const { results: peopleResults, loading: peopleLoading } =
		usePeopleMentionSearch({
			query: mentionQuery,
			listingContext,
			enabled: pickerKind === "people",
		});
	const { hits: patronResults, loading: patronLoading } =
		usePatronMentionSearch(mentionQuery, includePatronSearch);

	const resultCount = useMemo(() => {
		if (pickerKind === "listing") return listingResults.length;
		return peopleResults.length + patronResults.length;
	}, [
		listingResults.length,
		patronResults.length,
		peopleResults.length,
		pickerKind,
	]);

	const loading =
		pickerKind === "listing"
			? listingLoading
			: peopleLoading || (includePatronSearch && patronLoading);

	const listContentKey = useMemo(() => {
		if (pickerKind === "listing") {
			return listingResults
				.map((hit) => `${hit.listingKind}-${hit.id}`)
				.join("\0");
		}
		return [
			...peopleResults.map((hit) =>
				hit.source === "credit" ? `c-${hit.row.id}` : `s-${hit.row.id}`,
			),
			...patronResults.map((hit) => `p-${hit.userId}`),
		].join("\0");
	}, [listingResults, patronResults, peopleResults, pickerKind]);

	const { showHeaderFade, showFooterFade } = useSheetScrollFades(
		listScrollRef,
		pickerOpen && resultCount > 0,
		listContentKey,
	);

	const mentionHighlightKey = `${pickerKind}\0${mentionQuery}\0${resultCount}`;
	useEffect(() => {
		void mentionHighlightKey;
		setHighlightIndex(0);
	}, [mentionHighlightKey]);

	useEffect(() => {
		if (!pickerOpen || resultCount === 0) return;
		const row = listScrollRef.current?.querySelector(
			`[data-mention-index="${highlightIndex}"]`,
		);
		row?.scrollIntoView({ block: "nearest" });
	}, [highlightIndex, pickerOpen, resultCount]);

	const clearPicker = useCallback(() => {
		setPickerKind(null);
		setMentionRange(null);
		setMentionQuery("");
		setCaretAnchor(null);
	}, []);

	const syncMentionState = useCallback(
		(body: string, cursor: number) => {
			const listingActive = getActiveListingMentionQuery(body, cursor);
			if (listingActive) {
				setPickerKind("listing");
				setMentionRange({ start: listingActive.start, end: listingActive.end });
				setMentionQuery(listingActive.query);
				return;
			}

			const peopleActive = getActivePeopleMentionQuery(body, cursor);
			if (peopleActive) {
				setPickerKind("people");
				setMentionRange({ start: peopleActive.start, end: peopleActive.end });
				setMentionQuery(peopleActive.query);
				return;
			}

			clearPicker();
		},
		[clearPicker],
	);

	const syncCaretAnchor = useCallback(() => {
		const el = textareaRef.current;
		if (!el || mentionRange == null) {
			setCaretAnchor(null);
			return;
		}
		const cursor = el.selectionStart ?? mentionRange.end;
		setCaretAnchor(measureTextareaCaretViewportAnchor(el, cursor));
	}, [mentionRange]);

	const caretAnchorKey = `${value.length}\0${mentionQuery}\0${pickerKind}\0${mentionRange?.start ?? ""}:${mentionRange?.end ?? ""}`;
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
		const range = mentionRange;
		const el = textareaRef.current;
		if (!range || !el || pickerKind == null) return;

		let nextBody = value;
		let nextCursor = range.end;

		if (pickerKind === "listing") {
			const hit = listingResults[index];
			if (!hit) return;
			({ nextBody, nextCursor } = insertListingMention(value, range, {
				title: hit.title,
				listingKind: hit.listingKind,
				tmdbId: hit.id,
			}));
		} else if (index < peopleResults.length) {
			const hit = peopleResults[index];
			if (!hit) return;
			const name = hit.source === "credit" ? hit.row.name : hit.row.name;
			const tmdbPersonId = hit.source === "credit" ? hit.row.id : hit.row.id;
			({ nextBody, nextCursor } = insertPersonMention(value, range, {
				name,
				tmdbPersonId,
			}));
		} else {
			const hit = patronResults[index - peopleResults.length];
			if (!hit) return;
			({ nextBody, nextCursor } = insertPatronMention(value, range, {
				displayName: hit.displayName,
				handle: hit.handle,
			}));
		}

		onChange(nextBody);
		clearPicker();
		requestAnimationFrame(() => {
			el.focus();
			el.setSelectionRange(nextCursor, nextCursor);
		});
	};

	const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
		if (!pickerOpen || resultCount === 0) return;

		if (event.key === "ArrowDown") {
			event.preventDefault();
			setHighlightIndex((current) => (current + 1) % resultCount);
			return;
		}
		if (event.key === "ArrowUp") {
			event.preventDefault();
			setHighlightIndex((current) => (current - 1 + resultCount) % resultCount);
			return;
		}
		if (event.key === "Enter" || event.key === "Tab") {
			event.preventDefault();
			handleSelect(highlightIndex);
			return;
		}
		if (event.key === "Escape") {
			event.preventDefault();
			clearPicker();
		}
	};

	const pickerAriaLabel =
		pickerKind === "listing"
			? "Tag a film or show"
			: "Tag cast, crew, or patrons";

	const emptyCopy = (() => {
		if (pickerKind === "listing") {
			return mentionQuery
				? `No matches for #${mentionQuery}`
				: "Type # and a film or TV title to tag it";
		}
		return mentionQuery
			? `No matches for @${mentionQuery.replace(/^@+/, "")}`
			: listingContext
				? "Type @ to tag cast, crew, or patrons"
				: "Type @ and a name to tag someone";
	})();

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
				aria-label={pickerAriaLabel}
			>
				{loading ? (
					<div className="flex items-center justify-center gap-2 px-3 py-4 text-muted-foreground text-sm">
						<Loader2 className="size-4 animate-spin" aria-hidden />
						Searching…
					</div>
				) : resultCount === 0 ? (
					<p className="px-3 py-4 text-center text-muted-foreground text-sm">
						{emptyCopy}
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
							{pickerKind === "listing"
								? listingResults.map((hit, index) => (
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
									))
								: null}
							{pickerKind === "people"
								? peopleResults.map((hit, index) => {
										const name = hit.row.name;
										const subtitle =
											hit.source === "credit"
												? hit.row.role
												: castCrewMetaLine(hit.row);
										const profileUrl =
											hit.source === "credit"
												? hit.row.profileUrl
												: hit.row.profileUrl;
										return (
											<div
												key={
													hit.source === "credit"
														? `credit-${hit.row.id}`
														: `search-${hit.row.id}`
												}
												data-mention-index={index}
											>
												<PersonMentionPickerRow
													name={name}
													subtitle={subtitle}
													profileUrl={profileUrl}
													active={index === highlightIndex}
													onMouseEnter={() => setHighlightIndex(index)}
													onSelect={() => handleSelect(index)}
												/>
											</div>
										);
									})
								: null}
							{pickerKind === "people" && includePatronSearch
								? patronResults.map((hit, patronIndex) => {
										const index = peopleResults.length + patronIndex;
										return (
											<div key={hit.userId} data-mention-index={index}>
												<PatronMentionPickerRow
													displayName={hit.displayName}
													handle={hit.handle}
													portraitUrl={hit.image}
													active={index === highlightIndex}
													onMouseEnter={() => setHighlightIndex(index)}
													onSelect={() => handleSelect(index)}
												/>
											</div>
										);
									})
								: null}
						</div>
					</div>
				)}
			</PopoverAnchoredContent>
		</Popover>
	);
}
