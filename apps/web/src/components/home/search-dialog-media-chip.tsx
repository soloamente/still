"use client";

import {
	IconSearchDialogCinema,
	IconSearchDialogPeople,
	IconSearchDialogTv,
} from "@still/ui/icons/search-dialog-glyphs";
import { motion, useReducedMotion } from "motion/react";
import {
	cycleSearchListingKind,
	type SearchDialogListingKind,
	searchDialogListingKindLabel,
} from "@/lib/search-dialog-listing-kind";
import { SEARCH_DIALOG_RAIL_ENTER_TRANSITION } from "@/lib/search-dialog-tab-pane-motion";
import { useTextStateSwap } from "@/lib/text-state-swap";

function mediaChipIcon(kind: SearchDialogListingKind) {
	switch (kind) {
		case "movie":
			return (
				<IconSearchDialogCinema size={18} className="shrink-0" aria-hidden />
			);
		case "tv":
			return <IconSearchDialogTv size={18} className="shrink-0" aria-hidden />;
		case "people":
			return (
				<IconSearchDialogPeople size={18} className="shrink-0" aria-hidden />
			);
		default: {
			const _exhaustive: never = kind;
			return _exhaustive;
		}
	}
}

/**
 * Inline Movies / Shows / People switch — Tab cycles the next catalogue.
 */
export function SearchDialogMediaChip({
	listingKind,
	onToggle,
}: {
	listingKind: SearchDialogListingKind;
	onToggle: () => void;
}) {
	const reduceMotion = useReducedMotion();
	const currentLabel = searchDialogListingKindLabel(listingKind);
	const nextLabel = searchDialogListingKindLabel(
		cycleSearchListingKind(listingKind),
	);
	const currentLabelRef = useTextStateSwap(currentLabel);
	const nextLabelRef = useTextStateSwap(nextLabel);

	return (
		<button
			type="button"
			onClick={onToggle}
			aria-label={`${currentLabel}. Tab for ${nextLabel}`}
			className="search-dialog-media-chip inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-background py-1.5 pr-1.5 pl-3.5 font-medium text-foreground"
		>
			<motion.span
				key={listingKind}
				className="inline-flex shrink-0"
				initial={reduceMotion ? false : { opacity: 0, scale: 0.94 }}
				animate={{ opacity: 1, scale: 1 }}
				transition={SEARCH_DIALOG_RAIL_ENTER_TRANSITION}
				aria-hidden
			>
				{mediaChipIcon(listingKind)}
			</motion.span>
			<span
				ref={currentLabelRef}
				className="t-text-swap text-base leading-none"
			>
				{currentLabel}
			</span>
			<span className="inline-flex items-center gap-1 rounded-full bg-card px-2.5 py-2 text-sm leading-none">
				<kbd className="font-medium">TAB</kbd>
				<span className="text-muted-foreground">for</span>
				<span ref={nextLabelRef} className="t-text-swap">
					{nextLabel}
				</span>
			</span>
		</button>
	);
}
