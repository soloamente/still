"use client";

import { Popover, PopoverAnchoredContent } from "@still/ui/components/popover";
import { cn } from "@still/ui/lib/utils";
import { Loader2 } from "lucide-react";
import {
	type KeyboardEvent,
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";

import { OnboardingFieldInput } from "@/components/onboarding/onboarding-form-controls";
import { ListingMentionPickerRow } from "@/components/review/review-body-with-mentions";
import type { OnboardingMovie } from "@/lib/onboarding-types";
import { tmdbPosterUrlFromPath } from "@/lib/tmdb-poster-url";
import { useSheetScrollFades } from "@/lib/use-sheet-scroll-fades";

/** Anchor popover below the search field (review `@` picker parity). */
function measureSearchInputAnchor(el: HTMLInputElement) {
	const rect = el.getBoundingClientRect();
	return { x: rect.left, y: rect.bottom, height: 0 };
}

function TasteSearchPickerScrims({
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

type TasteFilmSearchPopoverProps = {
	search: string;
	onSearchChange: (value: string) => void;
	results: OnboardingMovie[];
	loading: boolean;
	tmdbHint: string | null;
	/** Films already visible in the right catalogue (hide unless skipped elsewhere). */
	hiddenMovieIds: ReadonlySet<number>;
	onPickFilm: (movie: OnboardingMovie) => void;
};

/** Debounced film search with mention-style results popover. */
export function TasteFilmSearchPopover({
	search,
	onSearchChange,
	results,
	loading,
	tmdbHint,
	hiddenMovieIds,
	onPickFilm,
}: TasteFilmSearchPopoverProps) {
	const inputRef = useRef<HTMLInputElement>(null);
	const listScrollRef = useRef<HTMLDivElement>(null);
	const [highlightIndex, setHighlightIndex] = useState(0);
	const [inputAnchor, setInputAnchor] = useState<{
		x: number;
		y: number;
		height: number;
	} | null>(null);

	const pickerResults = results.filter(
		(movie) => !hiddenMovieIds.has(movie.id),
	);
	const trimmed = search.trim();
	const pickerOpen = trimmed.length > 0;

	const listContentKey = pickerResults.map((hit) => hit.id).join("\0");
	const { showHeaderFade, showFooterFade } = useSheetScrollFades(
		listScrollRef,
		pickerOpen && pickerResults.length > 0,
		listContentKey,
	);

	const pickerHighlightKey = `${trimmed}\0${pickerResults.length}`;
	useEffect(() => {
		void pickerHighlightKey;
		setHighlightIndex(0);
	}, [pickerHighlightKey]);

	useEffect(() => {
		if (!pickerOpen || pickerResults.length === 0) return;
		const row = listScrollRef.current?.querySelector(
			`[data-taste-search-index="${highlightIndex}"]`,
		);
		row?.scrollIntoView({ block: "nearest" });
	}, [highlightIndex, pickerOpen, pickerResults.length]);

	const syncInputAnchor = useCallback(() => {
		const el = inputRef.current;
		setInputAnchor(el ? measureSearchInputAnchor(el) : null);
	}, []);

	useLayoutEffect(() => {
		if (!pickerOpen) {
			setInputAnchor(null);
			return;
		}
		syncInputAnchor();
	}, [pickerOpen, syncInputAnchor]);

	useEffect(() => {
		if (!pickerOpen) return;
		const handleReposition = () => syncInputAnchor();
		window.addEventListener("resize", handleReposition);
		window.addEventListener("scroll", handleReposition, { capture: true });
		return () => {
			window.removeEventListener("resize", handleReposition);
			window.removeEventListener("scroll", handleReposition, true);
		};
	}, [pickerOpen, syncInputAnchor]);

	const handleSelect = (index: number) => {
		const hit = pickerResults[index];
		if (!hit) return;
		onPickFilm(hit);
		inputRef.current?.focus();
	};

	const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		if (!pickerOpen || pickerResults.length === 0) return;

		if (event.key === "ArrowDown") {
			event.preventDefault();
			setHighlightIndex((current) => (current + 1) % pickerResults.length);
			return;
		}
		if (event.key === "ArrowUp") {
			event.preventDefault();
			setHighlightIndex(
				(current) =>
					(current - 1 + pickerResults.length) % pickerResults.length,
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
			onSearchChange("");
		}
	};

	return (
		<Popover modal={false} open={pickerOpen}>
			<OnboardingFieldInput
				ref={inputRef}
				onChange={(e) => onSearchChange(e.target.value)}
				onFocus={syncInputAnchor}
				onKeyDown={handleKeyDown}
				placeholder="Search films you've seen…"
				spellCheck={false}
				type="search"
				value={search}
			/>

			<PopoverAnchoredContent
				align="start"
				anchor={inputAnchor}
				aria-label="Search films"
				className="w-[min(100vw-2rem,20rem)] overflow-visible rounded-[1.75rem] border-0 bg-popover p-2 text-popover-foreground shadow-mobbin-xl ring-1 ring-foreground/10"
				initialFocus={false}
				positionerClassName="z-[100]"
				role="listbox"
				side="bottom"
				sideOffset={8}
			>
				{loading ? (
					<div className="flex items-center justify-center gap-2 px-3 py-4 text-muted-foreground text-sm">
						<Loader2 aria-hidden className="size-4 animate-spin" />
						Searching…
					</div>
				) : pickerResults.length === 0 ? (
					<p className="px-3 py-4 text-center text-muted-foreground text-sm">
						{trimmed
							? (tmdbHint ?? `No films match “${trimmed}”`)
							: "Type a film title to add it"}
					</p>
				) : (
					<div className="relative min-h-0 overflow-hidden rounded-2xl">
						<TasteSearchPickerScrims
							showFooterFade={showFooterFade}
							showHeaderFade={showHeaderFade}
						/>
						<div
							ref={listScrollRef}
							className="scrollbar-none max-h-56 min-h-0 overflow-y-auto overscroll-y-contain [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
						>
							{pickerResults.map((hit, index) => (
								<div key={hit.id} data-taste-search-index={index}>
									<ListingMentionPickerRow
										active={index === highlightIndex}
										onMouseEnter={() => setHighlightIndex(index)}
										onSelect={() => handleSelect(index)}
										posterUrl={tmdbPosterUrlFromPath(hit.poster_url, "w92")}
										subtitle="Film"
										title={hit.title}
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
