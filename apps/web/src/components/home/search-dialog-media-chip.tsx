"use client";

import {
	cycleSearchListingKind,
	type SearchDialogListingKind,
	searchDialogListingKindLabel,
} from "@/lib/search-dialog-listing-kind";

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
	const currentLabel = searchDialogListingKindLabel(listingKind);
	const nextLabel = searchDialogListingKindLabel(
		cycleSearchListingKind(listingKind),
	);

	return (
		<button
			type="button"
			onClick={onToggle}
			aria-label={`${currentLabel}. Tab for ${nextLabel}`}
			className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-background py-1 pr-1.5 pl-3.5 font-medium text-foreground"
		>
			<span className="text-base leading-none">{currentLabel}</span>
			<span className="inline-flex items-center gap-1 rounded-full bg-card px-2.5 py-2 text-sm leading-none">
				<kbd className="font-medium">TAB</kbd>
				<span className="text-muted-foreground">for</span>
				<span>{nextLabel}</span>
			</span>
		</button>
	);
}
