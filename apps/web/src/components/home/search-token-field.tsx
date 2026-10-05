"use client";

import {
	IconSearchDialogCinema,
	IconSearchDialogCurated,
	IconSearchDialogLists,
	IconSearchDialogTv,
} from "@still/ui/icons/search-dialog-glyphs";
import { cn } from "@still/ui/lib/utils";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
	type KeyboardEvent,
	useCallback,
	useId,
	useMemo,
	useRef,
	useState,
} from "react";

import { SearchDialogGenreIcon } from "@/components/home/search-dialog-genre-icon";
import { SearchDialogStudioLogo } from "@/components/home/search-dialog-studio-logo";
import { SearchTagPill } from "@/components/home/search-tag-pill";
import { WatchlistProviderCircleLogo } from "@/components/watchlist/watchlist-provider-circle-logo";
import {
	moveSearchDialogEmptyBrowseFocus,
	type SearchDialogEmptyBrowseSection,
} from "@/lib/search-dialog-empty-browse-keyboard";
import {
	moveSearchDialogResultFocus,
	searchDialogResultArrowFromKey,
} from "@/lib/search-dialog-result-keyboard";
import type { SearchDialogStreamingProvider } from "@/lib/search-dialog-streaming-providers";
import { searchDialogStudioHasLogo } from "@/lib/search-dialog-studio-logo";
import type { SearchDialogStudio } from "@/lib/search-dialog-studios";
import {
	rankTagSuggestions,
	type SearchDialogGenre,
	type SearchTag,
	searchTagKey,
	suggestionToTag,
	type TagSuggestion,
	upsertTag,
} from "@/lib/search-query-tags";

export type SearchTokenFieldProps = {
	tags: SearchTag[];
	onTagsChange: (tags: SearchTag[]) => void;
	inputValue: string;
	onInputValueChange: (value: string) => void;
	studios: SearchDialogStudio[];
	streamingProviders?: SearchDialogStreamingProvider[];
	genres: SearchDialogGenre[];
	listingKind: "movie" | "tv";
	onSubmit?: () => void;
	/** Tab with no suggestion open — cycle Movies / Shows (Figma header chip). */
	onTabCycleListingKind?: () => void;
	/** Parent owns the tag chips (catalog search dialog header row). */
	hideTags?: boolean;
	inputId: string;
	placeholder?: string;
	inputClassName?: string;
	/** When tag suggestions are closed — arrow keys move catalogue / people results. */
	resultKeyboard?: {
		enabled: boolean;
		focusedIndex: number | null;
		resultCount: number;
		layout: "grid" | "list" | "rail";
		gridColumns: number;
		/** Stacked rails + lists when ⌘K browse is empty. */
		emptyBrowseSections?: readonly SearchDialogEmptyBrowseSection[];
		onFocusIndexChange: (index: number | null) => void;
		onPickFocused: () => void;
	};
};

/** Shared metrics so inline ghost completion lines up with the combobox input. */
const SEARCH_QUERY_INPUT_CLASS = cn(
	"m-0 w-full min-w-0 border-0 bg-transparent p-0 font-normal text-base leading-[1.25rem] md:text-sm",
	"appearance-none [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden",
);

/** Remaining suggestion characters after the typed prefix (case-insensitive). */
function inlineGhostSuffix(input: string, suggestionLabel: string): string {
	if (!input.length) return "";
	if (!suggestionLabel.toLowerCase().startsWith(input.toLowerCase())) return "";
	return suggestionLabel.slice(input.length);
}

/** Short category line under each suggestion label (scan hierarchy in the listbox). */
function suggestionKindLabel(suggestion: TagSuggestion): string {
	switch (suggestion.kind) {
		case "studio":
			return "Studio";
		case "streaming":
			return "Streaming";
		case "media":
			return "Show";
		case "genre":
			return "Genre";
		case "curated":
			return "Tag";
		case "lists":
			return "Mode";
		default: {
			const _exhaustive: never = suggestion;
			return _exhaustive;
		}
	}
}

function SuggestionKindIcon({
	suggestion,
	className,
}: {
	suggestion: TagSuggestion;
	className?: string;
}) {
	const iconClass = cn("shrink-0 opacity-80", className);
	switch (suggestion.kind) {
		case "media":
			return suggestion.listingKind === "tv" ? (
				<IconSearchDialogTv size={20} className={iconClass} aria-hidden />
			) : (
				<IconSearchDialogCinema size={20} className={iconClass} aria-hidden />
			);
		case "genre":
			return (
				<SearchDialogGenreIcon
					name={suggestion.name}
					className="size-5 opacity-80"
				/>
			);
		case "curated":
			return (
				<IconSearchDialogCurated size={18} className={iconClass} aria-hidden />
			);
		case "lists":
			return (
				<IconSearchDialogLists size={18} className={iconClass} aria-hidden />
			);
		default:
			return null;
	}
}

/**
 * Chip + inline input for the home search dialog — Tab commits ghost suggestions into pills.
 */
export function SearchTokenField({
	tags,
	onTagsChange,
	inputValue,
	onInputValueChange,
	studios,
	streamingProviders = [],
	genres,
	listingKind,
	onSubmit,
	onTabCycleListingKind,
	hideTags = false,
	inputId,
	placeholder = "Search",
	inputClassName,
	resultKeyboard,
}: SearchTokenFieldProps) {
	const reduceMotion = useReducedMotion();
	const listboxId = useId();
	const tabHintId = useId();
	const inputRef = useRef<HTMLInputElement>(null);
	const [highlightIndex, setHighlightIndex] = useState(0);
	const [panelOpen, setPanelOpen] = useState(false);

	const suggestions = useMemo(
		() =>
			rankTagSuggestions(
				inputValue,
				studios,
				genres,
				listingKind,
				tags,
				streamingProviders,
			),
		[inputValue, studios, genres, listingKind, tags, streamingProviders],
	);

	const showPanel = panelOpen && suggestions.length > 0;
	const topSuggestion = suggestions[highlightIndex] ?? suggestions[0] ?? null;

	const commitSuggestion = useCallback(
		(suggestion: TagSuggestion) => {
			onTagsChange(upsertTag(tags, suggestionToTag(suggestion)));
			onInputValueChange("");
			setHighlightIndex(0);
			setPanelOpen(false);
			requestAnimationFrame(() => inputRef.current?.focus());
		},
		[onInputValueChange, onTagsChange, tags],
	);

	const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		if (event.key === "Tab" && !event.shiftKey && showPanel && topSuggestion) {
			event.preventDefault();
			commitSuggestion(topSuggestion);
			return;
		}

		if (
			event.key === "Tab" &&
			!event.shiftKey &&
			onTabCycleListingKind &&
			!showPanel
		) {
			event.preventDefault();
			onTabCycleListingKind();
			return;
		}

		if (event.key === "Escape") {
			if (showPanel) {
				event.preventDefault();
				setPanelOpen(false);
			}
			return;
		}

		if (event.key === "ArrowDown" && suggestions.length > 0) {
			event.preventDefault();
			setPanelOpen(true);
			setHighlightIndex((i) => (i + 1) % suggestions.length);
			return;
		}

		if (event.key === "ArrowUp" && suggestions.length > 0) {
			event.preventDefault();
			setPanelOpen(true);
			setHighlightIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
			return;
		}

		const resultArrow = searchDialogResultArrowFromKey(event.key);
		if (
			resultArrow &&
			resultKeyboard?.enabled &&
			suggestions.length === 0 &&
			resultKeyboard.resultCount > 0
		) {
			event.preventDefault();
			setPanelOpen(false);
			const emptySections = resultKeyboard.emptyBrowseSections;
			const nextIndex =
				emptySections && emptySections.length > 0
					? moveSearchDialogEmptyBrowseFocus(
							resultKeyboard.focusedIndex,
							emptySections,
							resultArrow,
						)
					: moveSearchDialogResultFocus(
							resultKeyboard.focusedIndex,
							resultKeyboard.resultCount,
							resultArrow,
							resultKeyboard.gridColumns,
							resultKeyboard.layout,
						);
			resultKeyboard.onFocusIndexChange(nextIndex);
			return;
		}

		if (event.key === "Enter") {
			if (showPanel && topSuggestion) {
				event.preventDefault();
				commitSuggestion(topSuggestion);
				return;
			}
			if (
				resultKeyboard?.enabled &&
				resultKeyboard.focusedIndex != null &&
				suggestions.length === 0
			) {
				event.preventDefault();
				resultKeyboard.onPickFocused();
				return;
			}
			// Enter commits the catalogue query — Tab alone inserts suggestion pills.
			event.preventDefault();
			setPanelOpen(false);
			onSubmit?.();
			return;
		}

		if (event.key === "Backspace" && inputValue === "" && tags.length > 0) {
			onTagsChange(tags.slice(0, -1));
		}
	};

	const ghostSuffix = useMemo(() => {
		if (!topSuggestion || inputValue.length === 0) return "";
		return inlineGhostSuffix(inputValue, topSuggestion.label);
	}, [topSuggestion, inputValue]);

	const showGhost = Boolean(ghostSuffix && showPanel);

	return (
		<div
			className={cn(
				"catalog-search-query relative min-w-0",
				hideTags ? "w-auto max-w-[min(100%,20rem)] shrink-0" : "flex-1",
			)}
		>
			<p id={tabHintId} className="sr-only">
				Type to filter. Press Tab to accept the highlighted suggestion. Press
				Enter to search.
			</p>
			<div
				className={cn(
					"flex min-w-0 items-center gap-1.5",
					hideTags ? "min-h-[27px]" : "min-h-10 min-w-0 flex-1 flex-wrap",
				)}
			>
				{hideTags ? null : (
					<AnimatePresence initial={false}>
						{tags.map((tag) => (
							<motion.span
								key={searchTagKey(tag)}
								initial={reduceMotion ? false : { opacity: 0, scale: 0.92 }}
								animate={{ opacity: 1, scale: 1 }}
								exit={
									reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.92 }
								}
								transition={
									reduceMotion
										? { duration: 0 }
										: { duration: 0.12, ease: [0.165, 0.84, 0.44, 1] }
								}
								className="inline-flex"
							>
								<SearchTagPill
									tag={tag}
									onRemove={() =>
										onTagsChange(
											tags.filter((t) => searchTagKey(t) !== searchTagKey(tag)),
										)
									}
								/>
							</motion.span>
						))}
					</AnimatePresence>
				)}

				<div
					className={cn(
						"relative",
						hideTags
							? "min-h-[27px] min-w-[5.5rem]"
							: "min-h-10 min-w-20 flex-1",
					)}
				>
					<div
						className={cn(
							"grid min-w-0 *:col-start-1 *:row-start-1",
							hideTags ? "min-h-[27px]" : "min-h-10",
						)}
					>
						{showGhost ? (
							<p
								aria-hidden
								className={cn(
									SEARCH_QUERY_INPUT_CLASS,
									"pointer-events-none z-0 self-center whitespace-pre text-foreground",
									hideTags && "text-[18px] leading-[21px] md:text-[18px]",
								)}
							>
								<span className="invisible">{inputValue}</span>
								<span className="text-muted-foreground/45">{ghostSuffix}</span>
							</p>
						) : null}
						<input
							ref={inputRef}
							id={inputId}
							type="search"
							name="q"
							role="combobox"
							value={inputValue}
							autoComplete="off"
							spellCheck={false}
							aria-autocomplete="list"
							aria-expanded={showPanel}
							aria-controls={showPanel ? listboxId : undefined}
							aria-haspopup="listbox"
							aria-activedescendant={
								showPanel ? `${listboxId}-option-${highlightIndex}` : undefined
							}
							aria-describedby={tabHintId}
							placeholder={tags.length === 0 ? placeholder : undefined}
							className={cn(
								SEARCH_QUERY_INPUT_CLASS,
								"relative z-10 self-center text-foreground caret-foreground outline-none selection:bg-muted selection:text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:outline-none focus-visible:ring-0",
								hideTags &&
									"field-sizing-content w-auto min-w-[5.5rem] max-w-[min(100%,20rem)] text-[18px] leading-[21px] md:text-[18px]",
								inputClassName,
							)}
							onChange={(e) => {
								onInputValueChange(e.target.value);
								setHighlightIndex(0);
								setPanelOpen(true);
							}}
							onFocus={() => {
								if (suggestions.length > 0) setPanelOpen(true);
							}}
							onBlur={() => {
								// Dismiss when focus leaves the field (click elsewhere, tab away).
								// Suggestion buttons preventDefault on mousedown, so selecting one
								// keeps focus and never triggers this blur.
								setPanelOpen(false);
							}}
							onKeyDown={handleKeyDown}
						/>
					</div>
				</div>
			</div>

			<AnimatePresence initial={false}>
				{showPanel ? (
					<motion.div
						id={listboxId}
						role="listbox"
						aria-label="Search suggestions"
						initial={reduceMotion ? false : { opacity: 0, y: 6, scale: 0.98 }}
						animate={{ opacity: 1, y: 0, scale: 1 }}
						exit={
							reduceMotion ? { opacity: 0 } : { opacity: 0, y: 4, scale: 0.99 }
						}
						transition={
							reduceMotion
								? { duration: 0 }
								: { duration: 0.16, ease: [0.165, 0.84, 0.44, 1] }
						}
						className={cn(
							"absolute top-full right-0 left-0 z-30 mt-2 overflow-hidden rounded-[1.25rem] p-1.5",
							"border-0 bg-popover text-popover-foreground shadow-mobbin-xl ring-1 ring-foreground/10",
						)}
					>
						<motion.ul
							className="flex flex-col gap-0.5"
							initial={reduceMotion ? false : "hidden"}
							animate="show"
							exit="hidden"
							variants={{
								hidden: {},
								show: {
									transition: {
										staggerChildren: reduceMotion ? 0 : 0.04,
									},
								},
							}}
						>
							{suggestions.map((suggestion, index) => {
								const active = index === highlightIndex;
								return (
									<motion.li
										key={
											suggestion.kind === "studio"
												? `studio-${suggestion.id}`
												: suggestion.kind === "streaming"
													? `streaming-${suggestion.id}`
													: `${suggestion.kind}-${suggestion.label}`
										}
										variants={
											reduceMotion
												? undefined
												: {
														hidden: { opacity: 0, y: 4 },
														show: { opacity: 1, y: 0 },
													}
										}
									>
										<button
											type="button"
											id={`${listboxId}-option-${index}`}
											role="option"
											aria-selected={active}
											className={cn(
												"flex min-h-11 w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-[transform,background-color,color] duration-200 ease-out active:scale-[0.98] motion-reduce:transition-none",
												active
													? "bg-background text-foreground shadow-sm"
													: "text-muted-foreground [@media(hover:hover)]:hover:bg-background [@media(hover:hover)]:hover:text-foreground",
											)}
											onMouseDown={(e) => e.preventDefault()}
											onClick={() => commitSuggestion(suggestion)}
											onMouseEnter={() => setHighlightIndex(index)}
										>
											{suggestion.kind === "studio" &&
											searchDialogStudioHasLogo(
												suggestion.id,
												suggestion.logoUrl,
												suggestion.name,
											) ? (
												<SearchDialogStudioLogo
													studioId={suggestion.id}
													studioName={suggestion.name}
													fallbackLogoUrl={suggestion.logoUrl}
													variant="suggestion"
												/>
											) : suggestion.kind === "streaming" &&
												suggestion.logoUrl ? (
												<WatchlistProviderCircleLogo
													src={suggestion.logoUrl}
													name={suggestion.name}
													className="size-9 shrink-0 shadow-sm"
													providerId={suggestion.id}
												/>
											) : (
												<span
													className={cn(
														"inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-background text-muted-foreground shadow-sm",
														active && "text-foreground",
													)}
													aria-hidden
												>
													{suggestion.kind === "studio" ||
													suggestion.kind === "streaming" ? (
														<span className="font-semibold text-[10px] text-foreground uppercase tracking-wide">
															{suggestion.name.slice(0, 2)}
														</span>
													) : (
														<SuggestionKindIcon suggestion={suggestion} />
													)}
												</span>
											)}
											<span className="min-w-0 flex-1">
												<span className="block truncate font-medium text-foreground text-sm">
													{suggestion.label}
												</span>
												<span className="block font-semibold text-[10px] text-muted-foreground uppercase tracking-wider">
													{suggestionKindLabel(suggestion)}
												</span>
											</span>
											{index === 0 ? (
												<kbd className="hidden shrink-0 rounded-lg bg-background px-2 py-1 font-medium text-[10px] text-muted-foreground tabular-nums shadow-sm sm:inline">
													Tab
												</kbd>
											) : null}
										</button>
									</motion.li>
								);
							})}
						</motion.ul>
					</motion.div>
				) : null}
			</AnimatePresence>
		</div>
	);
}
