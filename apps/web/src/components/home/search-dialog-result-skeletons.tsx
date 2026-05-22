"use client";

import { Skeleton } from "@still/ui/components/skeleton";

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

/** Empty-state browse column — matches 2×2 / 4-up poster preview grid. */
export function SearchDialogBrowsePreviewSkeleton() {
	return (
		<div className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-4" aria-hidden>
			{BROWSE_PREVIEW_SKELETON_SLOTS.map((slot) => (
				<div key={`browse-preview-skel-${slot}`} className="min-w-0">
					<Skeleton className="aspect-2/3 w-full rounded-2xl" />
					<Skeleton className="mt-2 h-3.5 w-4/5 max-w-full rounded-md" />
				</div>
			))}
		</div>
	);
}

/** Studio logo rail placeholders while TMDb companies load. */
export function SearchDialogStudioRailSkeleton() {
	return (
		<>
			{STUDIO_CHIP_SKELETON_SLOTS.map((slot) => (
				<Skeleton
					key={`studio-skel-${slot}`}
					className="size-11 shrink-0 rounded-xl"
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
