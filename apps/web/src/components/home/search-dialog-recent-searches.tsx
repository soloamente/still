"use client";

import { IconSearchDialogMagnifier } from "@still/ui/icons/search-dialog-glyphs";
import { cn } from "@still/ui/lib/utils";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { useRef, useState } from "react";

import { SearchDialogHorizontalScrollEdges } from "@/components/home/search-dialog-horizontal-scroll-edges";
import { SearchDialogStudioLogo } from "@/components/home/search-dialog-studio-logo";
import {
	SEARCH_DIALOG_RECENT_CHIP_SHELL_CLASS,
	SEARCH_DIALOG_RECENT_LEADING_CONTROL_CLASS,
	SEARCH_DIALOG_RECENT_STUDIO_LOGO_VARIANT,
	SearchDialogChipLeadingRemoveControl,
	SearchTagLeadingMark,
} from "@/components/home/search-tag-pill";
import type { RecentSearchEntryV2 } from "@/lib/home-search-recent-storage";
import { searchDialogKeyboardFocusActive } from "@/lib/search-dialog-keyboard-focus";
import {
	SEARCH_DIALOG_RECENT_CHIP_EXIT_TRANSITION,
	searchDialogRecentChipExit,
} from "@/lib/search-dialog-tab-pane-motion";
import {
	displayTagSegmentLabel,
	type SearchTag,
} from "@/lib/search-query-tags";
import {
	HORIZONTAL_OVERFLOW_RAIL_CLASSNAME,
	useHorizontalScrollFades,
} from "@/lib/use-horizontal-scroll-fades";

/** Same vertical rhythm as the gap between search field and the scroll well. */
const SEARCH_DIALOG_RECENT_RAIL_CLASSNAME = "shrink-0 px-2.5";

/**
 * Horizontal recent-search chip rail under the catalog search field (on `bg-card`).
 * Edge fades match the card shell; chips render structured tags like the reference mocks.
 */
export function SearchDialogRecentSearches({
	entries,
	headingId,
	onPick,
	onRemove,
	keyboardFocusedIndex = null,
	resultIndexBase = 0,
}: {
	entries: RecentSearchEntryV2[];
	headingId: string;
	onPick: (entry: RecentSearchEntryV2) => void;
	onRemove: (entry: RecentSearchEntryV2) => void;
	keyboardFocusedIndex?: number | null;
	resultIndexBase?: number;
}) {
	const reduceMotion = useReducedMotion();
	const scrollRef = useRef<HTMLDivElement>(null);
	const contentKey = entries.map((entry) => entry.label).join("\0");
	const { showStartFade, showEndFade } = useHorizontalScrollFades(
		scrollRef,
		entries.length > 0,
		contentKey,
	);

	if (entries.length === 0) return null;

	return (
		<div className={SEARCH_DIALOG_RECENT_RAIL_CLASSNAME}>
			<h3 id={headingId} className="sr-only">
				Recent searches
			</h3>
			<div className="relative min-w-0 overflow-x-clip overflow-y-visible">
				<div
					ref={scrollRef}
					data-lenis-prevent-wheel
					role="toolbar"
					aria-labelledby={headingId}
					className={cn(
						HORIZONTAL_OVERFLOW_RAIL_CLASSNAME,
						"relative z-0 items-center overflow-y-visible pb-0.5",
					)}
				>
					<div className="flex w-max flex-nowrap items-center gap-2">
						<AnimatePresence initial={false} mode="popLayout">
							{entries.map((entry, index) => (
								<motion.span
									key={entry.label}
									layout="position"
									className="inline-flex shrink-0"
									style={{ transformOrigin: "left center" }}
									animate={{ opacity: 1, scale: 1 }}
									exit={searchDialogRecentChipExit(reduceMotion)}
									transition={SEARCH_DIALOG_RECENT_CHIP_EXIT_TRANSITION}
								>
									<RecentSearchChip
										entry={entry}
										resultIndex={resultIndexBase + index}
										keyboardFocused={
											keyboardFocusedIndex === resultIndexBase + index
										}
										onPick={() => onPick(entry)}
										onRemove={() => onRemove(entry)}
									/>
								</motion.span>
							))}
						</AnimatePresence>
					</div>
				</div>
				<SearchDialogHorizontalScrollEdges
					showStartFade={showStartFade}
					showEndFade={showEndFade}
					tint="card"
				/>
			</div>
		</div>
	);
}

function pickLeadingTag(tags: SearchTag[]): SearchTag | null {
	const genreLike = tags.find(
		(tag) => tag.kind === "genre" || tag.kind === "curated",
	);
	if (genreLike) return genreLike;
	const studio = tags.find((tag) => tag.kind === "studio");
	if (studio) return studio;
	return tags[0] ?? null;
}

function RecentSearchChipCopy({ entry }: { entry: RecentSearchEntryV2 }) {
	const studio = entry.tags.find((tag) => tag.kind === "studio");
	const genreLike = entry.tags.find(
		(tag) => tag.kind === "genre" || tag.kind === "curated",
	);
	const freeText = entry.freeText.trim();

	if (entry.tags.length === 0) {
		return <span className="truncate">{freeText}</span>;
	}

	if (genreLike && studio) {
		return (
			<span className="flex min-w-0 items-center gap-1.5 truncate">
				<span className="shrink-0 font-medium">
					{displayTagSegmentLabel(genreLike)}
				</span>
				<span className="shrink-0 text-muted-foreground">in</span>
				<span className="inline-flex min-w-0 items-center gap-1.5">
					<span
						className={cn(
							"inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-background",
							SEARCH_DIALOG_RECENT_LEADING_CONTROL_CLASS,
						)}
					>
						<SearchDialogStudioLogo
							studioId={studio.id}
							studioName={studio.name}
							fallbackLogoUrl={studio.logoUrl}
							variant={SEARCH_DIALOG_RECENT_STUDIO_LOGO_VARIANT}
							className="size-full max-h-none max-w-none"
						/>
					</span>
					<span className="truncate font-medium">{studio.name}</span>
				</span>
				{freeText ? (
					<>
						<span className="shrink-0 text-muted-foreground">·</span>
						<span className="truncate">{freeText}</span>
					</>
				) : null}
			</span>
		);
	}

	const parts: ReactNode[] = [];
	const tagLabels = entry.tags.map(displayTagSegmentLabel);
	for (let i = 0; i < tagLabels.length; i++) {
		if (i > 0) {
			parts.push(
				<span key={`sep-${i}`} className="shrink-0 text-muted-foreground">
					·
				</span>,
			);
		}
		parts.push(
			<span key={`tag-${i}`} className="shrink-0 truncate font-medium">
				{tagLabels[i]}
			</span>,
		);
	}
	if (freeText) {
		if (parts.length > 0) {
			parts.push(
				<span key="ft-sep" className="shrink-0 text-muted-foreground">
					·
				</span>,
			);
		}
		parts.push(
			<span key="ft" className="truncate">
				{freeText}
			</span>,
		);
	}

	return (
		<span className="flex min-w-0 items-center gap-1.5 truncate">{parts}</span>
	);
}

function RecentSearchChip({
	entry,
	onPick,
	onRemove,
	resultIndex,
	keyboardFocused = false,
}: {
	entry: RecentSearchEntryV2;
	onPick: () => void;
	onRemove: () => void;
	resultIndex: number;
	keyboardFocused?: boolean;
}) {
	const leadingTag = pickLeadingTag(entry.tags);
	const [iconSwapState, setIconSwapState] = useState<"a" | "b">("a");

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: hover swaps the leading remove icon on the chip shell
		<span
			className={cn(
				"search-recent-chip group relative z-0 select-none",
				SEARCH_DIALOG_RECENT_CHIP_SHELL_CLASS,
				searchDialogKeyboardFocusActive(keyboardFocused),
			)}
			onMouseEnter={() => setIconSwapState("b")}
			onMouseLeave={() => setIconSwapState("a")}
		>
			<SearchDialogChipLeadingRemoveControl
				tag={leadingTag}
				iconSwapState={iconSwapState}
				ariaLabel={`Remove “${entry.label}” from recent searches`}
				onRemove={() => onRemove()}
				fallbackLeading={<IconSearchDialogMagnifier size={20} aria-hidden />}
			/>
			<button
				type="button"
				data-search-dialog-result-index={resultIndex}
				onClick={onPick}
				title={`Search for “${entry.label}”`}
				className="min-w-0 flex-1 truncate text-left text-sm outline-none"
			>
				<RecentSearchChipCopy entry={entry} />
			</button>
		</span>
	);
}
