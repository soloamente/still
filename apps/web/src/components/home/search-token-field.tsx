"use client";

import { cn } from "@still/ui/lib/utils";
import { Clapperboard, List, Sparkles, Tag, Tv } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import {
	type KeyboardEvent,
	useCallback,
	useId,
	useMemo,
	useRef,
	useState,
} from "react";

import { SearchTagPill } from "@/components/home/search-tag-pill";
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
	genres: SearchDialogGenre[];
	listingKind: "movie" | "tv";
	onSubmit?: () => void;
	inputId: string;
	placeholder?: string;
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
	const iconClass = cn("size-4 shrink-0 opacity-80", className);
	switch (suggestion.kind) {
		case "media":
			return suggestion.listingKind === "tv" ? (
				<Tv className={iconClass} aria-hidden />
			) : (
				<Clapperboard className={iconClass} aria-hidden />
			);
		case "genre":
			return <Tag className={iconClass} aria-hidden />;
		case "curated":
			return <Sparkles className={iconClass} aria-hidden />;
		case "lists":
			return <List className={iconClass} aria-hidden />;
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
	genres,
	listingKind,
	onSubmit,
	inputId,
	placeholder = "Films, TV shows, people…",
}: SearchTokenFieldProps) {
	const reduceMotion = useReducedMotion();
	const listboxId = useId();
	const tabHintId = useId();
	const inputRef = useRef<HTMLInputElement>(null);
	const [highlightIndex, setHighlightIndex] = useState(0);
	const [panelOpen, setPanelOpen] = useState(false);

	const suggestions = useMemo(
		() => rankTagSuggestions(inputValue, studios, genres, listingKind, tags),
		[inputValue, studios, genres, listingKind, tags],
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
		if (event.key === "Tab" && showPanel && topSuggestion) {
			event.preventDefault();
			commitSuggestion(topSuggestion);
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

		if (event.key === "Enter") {
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
		<div className="catalog-search-query relative min-w-0 flex-1">
			<p id={tabHintId} className="sr-only">
				Type to filter. Press Tab to accept the highlighted suggestion. Press
				Enter to search.
			</p>
			<div className="flex min-h-10 min-w-0 flex-1 flex-wrap items-center gap-1.5">
				<AnimatePresence initial={false}>
					{tags.map((tag) => (
						<motion.span
							key={searchTagKey(tag)}
							initial={reduceMotion ? false : { opacity: 0, scale: 0.92 }}
							animate={{ opacity: 1, scale: 1 }}
							exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.92 }}
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

				<div className="relative min-h-10 min-w-20 flex-1">
					<div className="grid min-h-10 min-w-0 *:col-start-1 *:row-start-1">
						{showGhost ? (
							<p
								aria-hidden
								className={cn(
									SEARCH_QUERY_INPUT_CLASS,
									"pointer-events-none z-0 self-center whitespace-pre text-foreground",
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
							)}
							onChange={(e) => {
								onInputValueChange(e.target.value);
								setHighlightIndex(0);
								setPanelOpen(true);
							}}
							onFocus={() => {
								if (suggestions.length > 0) setPanelOpen(true);
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
										key={`${suggestion.kind}-${suggestion.label}`}
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
											{suggestion.kind === "studio" && suggestion.logoUrl ? (
												<span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-background shadow-sm outline-1 outline-foreground/10">
													<Image
														src={suggestion.logoUrl}
														alt=""
														width={28}
														height={28}
														className="size-7 object-contain p-0.5"
														unoptimized
													/>
												</span>
											) : (
												<span
													className={cn(
														"inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-background text-muted-foreground shadow-sm",
														active && "text-foreground",
													)}
													aria-hidden
												>
													{suggestion.kind === "studio" ? (
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
