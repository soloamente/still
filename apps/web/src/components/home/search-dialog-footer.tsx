"use client";

import { cn } from "@still/ui/lib/utils";
import {
	ArrowDown,
	ArrowLeft,
	ArrowRight,
	ArrowUp,
	CornerDownLeft,
} from "lucide-react";
import type { ReactNode } from "react";

import type { SearchDialogListingKind } from "@/lib/search-dialog-listing-kind";
import {
	searchDialogEmptyFoundCopy,
	searchDialogFoundCopy,
	type SearchDialogResultMode,
	searchDialogTabHint,
} from "@/lib/search-dialog-results-copy";

/** Tiny kbd well — inset `bg-background` on the raised dialog shell. */
function FooterKey({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<span
			className={cn(
				"inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-background px-[5px] font-medium text-[10px] text-foreground leading-none",
				className,
			)}
		>
			{children}
		</span>
	);
}

/**
 * Result count + desktop keyboard legend — pinned under the search-dialog body.
 */
export function SearchDialogFooter({
	resultCount,
	listingKind,
	resultMode,
	isEmptyDraft,
	studioFound = false,
}: {
	resultCount: number;
	listingKind: SearchDialogListingKind;
	resultMode: SearchDialogResultMode;
	isEmptyDraft: boolean;
	studioFound?: boolean;
}) {
	const copy = isEmptyDraft
		? searchDialogEmptyFoundCopy(resultCount)
		: searchDialogFoundCopy(resultMode, resultCount);
	const tabHint = searchDialogTabHint(listingKind, { empty: isEmptyDraft });

	return (
		<div className="flex min-w-0 shrink-0 items-center gap-2.5 px-5 pt-1 pb-2.5">
			<div className="flex min-w-0 items-center gap-[5px]">
				<FooterKey className="tabular-nums">{copy.countLabel}</FooterKey>
				<p className="truncate font-medium text-[12px] text-muted-foreground">
					{copy.foundLabel}
				</p>
				{studioFound ? (
					<>
						<p className="font-medium text-[12px] text-muted-foreground">
							&amp;
						</p>
						<FooterKey className="tabular-nums">1</FooterKey>
						<p className="truncate font-medium text-[12px] text-muted-foreground">
							studio found
						</p>
					</>
				) : null}
			</div>
			<div className="ml-auto hidden min-w-0 items-center justify-end gap-8 sm:flex">
				<div className="flex items-center gap-[5px]">
					<FooterKey>TAB</FooterKey>
					<p className="whitespace-nowrap font-medium text-[12px] text-muted-foreground">
						{tabHint}
					</p>
				</div>
				<div className="flex items-center gap-[5px]">
					<FooterKey className="w-[23px]">
						<CornerDownLeft className="size-2.5" aria-hidden />
					</FooterKey>
					<p className="whitespace-nowrap font-medium text-[12px] text-muted-foreground">
						to open
					</p>
				</div>
				<div className="flex items-center gap-[5px]">
					<FooterKey>
						<ArrowLeft className="size-2.5" aria-hidden />
					</FooterKey>
					<FooterKey>
						<ArrowDown className="size-2.5" aria-hidden />
					</FooterKey>
					<FooterKey>
						<ArrowUp className="size-2.5" aria-hidden />
					</FooterKey>
					<FooterKey>
						<ArrowRight className="size-2.5" aria-hidden />
					</FooterKey>
					<p className="whitespace-nowrap font-medium text-[12px] text-muted-foreground">
						to select
					</p>
				</div>
			</div>
		</div>
	);
}
