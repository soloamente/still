"use client";

import { Skeleton } from "@still/ui/components/skeleton";
import { cn } from "@still/ui/lib/utils";

import { SEARCH_DIALOG_STUDIO_RAIL_CHIP_CLASS } from "@/lib/search-dialog-studios";

const POSTER_SKELETON_SLOTS = [
	"one",
	"two",
	"three",
	"four",
	"five",
	"six",
	"seven",
	"eight",
] as const;

const LIST_SKELETON_SLOTS = ["one", "two", "three", "four"] as const;

const BROWSE_PREVIEW_SKELETON_SLOTS = ["a", "b", "c", "d"] as const;

const STUDIO_CHIP_SKELETON_SLOTS = ["a", "b", "c", "d", "e", "f"] as const;

const GENRE_CHIP_SKELETON_SLOTS = [
	"a",
	"b",
	"c",
	"d",
	"e",
	"f",
	"g",
	"h",
] as const;

const POSTER_RAIL_SKELETON_SLOTS = ["a", "b", "c", "d", "e"] as const;

const POSTER_GRID_SKELETON_SLOTS = [
	"a",
	"b",
	"c",
	"d",
	"e",
	"f",
	"g",
	"h",
	"i",
	"j",
] as const;

const PEOPLE_RAIL_SKELETON_SLOTS = [
	"a",
	"b",
	"c",
	"d",
	"e",
	"f",
	"g",
	"h",
] as const;

/** Poster grid placeholder — same track layout as search results (no layout shift). */
export function SearchDialogPosterSkeletonGrid({
	count = 8,
}: {
	count?: number;
}) {
	const slots = POSTER_SKELETON_SLOTS.slice(
		0,
		Math.min(count, POSTER_SKELETON_SLOTS.length),
	);
	return (
		<div
			className="mt-2 grid auto-rows-min grid-cols-3 gap-3 pb-1 sm:grid-cols-4"
			aria-hidden
		>
			{slots.map((slot) => (
				<div key={`poster-skel-${slot}`} className="min-w-0">
					<Skeleton className="aspect-2/3 w-full rounded-2xl" />
					<Skeleton className="mt-2 h-3.5 w-full max-w-full rounded-md" />
				</div>
			))}
		</div>
	);
}

/** Empty-state browse column — matches the horizontal poster rail. */
export function SearchDialogBrowsePreviewSkeleton() {
	return (
		<div className="flex gap-2.5 overflow-hidden" aria-hidden>
			{BROWSE_PREVIEW_SKELETON_SLOTS.map((slot) => (
				<Skeleton
					key={`browse-preview-skel-${slot}`}
					className="aspect-2/3 w-[9.4rem] shrink-0 rounded-2xl"
				/>
			))}
		</div>
	);
}

/** Genre chip placeholders while TMDb genres load. */
export function SearchDialogGenreRailSkeleton() {
	return (
		<>
			{GENRE_CHIP_SKELETON_SLOTS.map((slot) => (
				<Skeleton
					key={`genre-skel-${slot}`}
					className="h-[26px] w-[4.75rem] shrink-0 rounded-full"
				/>
			))}
		</>
	);
}

/** Wrapping poster placeholders matching the Figma search-results grid. */
export function SearchDialogPosterGridSkeleton() {
	return (
		<>
			{POSTER_GRID_SKELETON_SLOTS.map((slot) => (
				<Skeleton
					key={`poster-grid-skel-${slot}`}
					className="aspect-2/3 w-full rounded-[10px]"
				/>
			))}
		</>
	);
}

/** Horizontal poster placeholders matching the Figma title rail. */
export function SearchDialogPosterRailSkeleton() {
	return (
		<>
			{POSTER_RAIL_SKELETON_SLOTS.map((slot) => (
				<Skeleton
					key={`poster-rail-skel-${slot}`}
					className="aspect-2/3 w-[9.4rem] shrink-0 rounded-2xl"
				/>
			))}
		</>
	);
}

/** Square portrait placeholders for the people rail. */
export function SearchDialogPeopleRailSkeleton() {
	return (
		<>
			{PEOPLE_RAIL_SKELETON_SLOTS.map((slot) => (
				<Skeleton
					key={`people-rail-skel-${slot}`}
					className="size-16 shrink-0 rounded-2xl"
				/>
			))}
		</>
	);
}

/** Studio logo rail placeholders while TMDb companies load. */
export function SearchDialogStudioRailSkeleton() {
	return (
		<>
			{STUDIO_CHIP_SKELETON_SLOTS.map((slot) => (
				<Skeleton
					key={`studio-skel-${slot}`}
					className={cn("shrink-0", SEARCH_DIALOG_STUDIO_RAIL_CHIP_CLASS)}
				/>
			))}
		</>
	);
}

/** List rows placeholder while patron list search runs. */
export function SearchDialogListSkeleton({ count = 4 }: { count?: number }) {
	const slots = LIST_SKELETON_SLOTS.slice(
		0,
		Math.min(count, LIST_SKELETON_SLOTS.length),
	);
	return (
		<ul className="mt-2 space-y-1 pb-1" aria-hidden>
			{slots.map((slot) => (
				<li
					key={`list-skel-${slot}`}
					className="flex min-h-11 items-center gap-3 px-2 py-2"
				>
					<Skeleton className="size-11 shrink-0 rounded-xl" />
					<div className="min-w-0 flex-1 space-y-1.5">
						<Skeleton className="h-3.5 w-3/4 max-w-48 rounded-md" />
						<Skeleton className="h-3 w-1/3 max-w-20 rounded-md" />
					</div>
				</li>
			))}
		</ul>
	);
}
