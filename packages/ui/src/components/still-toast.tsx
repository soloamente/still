"use client";

import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps, ReactNode } from "react";
import { toast } from "sonner";
import { cn } from "../lib/utils";
import { stillToastLeadingIcons } from "./sonner";

/**
 * Inline “chip” segments inside Still narrative toasts — matches Mobbin-style
 * pill tags (neutral entity vs destination accent) from the product reference.
 */
const stillToastChipVariants = cva(
	"inline-flex max-w-[14rem] shrink-0 select-none items-center truncate rounded-full px-2 py-0.5 font-medium text-[12px] leading-none tracking-tight",
	{
		variants: {
			variant: {
				/** Primary subject (e.g. “Movie”, “TV”, a person name). */
				entity: "bg-neutral-100 text-neutral-900",
				/** Destination emphasis (e.g. list title) — cool accent on the light pill. */
				destination: "bg-sky-100 text-sky-700",
			},
		},
		defaultVariants: {
			variant: "entity",
		},
	},
);

export interface StillToastChipProps
	extends ComponentProps<"span">,
		VariantProps<typeof stillToastChipVariants> {}

export function StillToastChip({
	className,
	variant,
	...rest
}: StillToastChipProps) {
	return (
		<span
			className={cn(stillToastChipVariants({ variant }), className)}
			{...rest}
		/>
	);
}

export interface StillToastAddedCopyProps {
	/** Short label for what was added — “Movie”, “TV”, “Episode”, etc. */
	entityLabel: string;
	/** When set, renders the blue destination chip (“Top 10 Movies”). */
	destinationName?: string;
}

/**
 * Sentence body for “added to list” success — wires copy + chip variants so
 * call sites only pass structured props instead of hand-rolling JSX each time.
 */
export function StillToastAddedCopy({
	entityLabel,
	destinationName,
}: StillToastAddedCopyProps) {
	return (
		<span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-1">
			<span className="text-neutral-500">Added</span>
			<StillToastChip variant="entity">{entityLabel}</StillToastChip>
			{destinationName ? (
				<>
					<span className="text-neutral-500">to</span>
					<StillToastChip variant="destination">
						{destinationName}
					</StillToastChip>
				</>
			) : (
				<span className="text-neutral-500">to the collection</span>
			)}
		</span>
	);
}

export interface StillToastAlreadyInCopyProps {
	entityLabel: string;
	listTitle: string;
}

/** Neutral copy for duplicate list membership — keeps the same chip language. */
export function StillToastAlreadyInCopy({
	entityLabel,
	listTitle,
}: StillToastAlreadyInCopyProps) {
	return (
		<span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-1">
			<StillToastChip variant="entity">{entityLabel}</StillToastChip>
			<span className="text-neutral-500">is already in</span>
			<StillToastChip variant="destination">{listTitle}</StillToastChip>
		</span>
	);
}

const defaultDuration = 3800;

/** Shared Sonner options so narrative toasts inherit the same lifetime + leading mark. */
function narrativeToastOptions(
	icon: ReactNode,
	options?: {
		duration?: number;
		id?: string | number;
	},
): Parameters<typeof toast.success>[1] {
	return {
		duration: options?.duration ?? defaultDuration,
		id: options?.id,
		icon,
	};
}

/**
 * Opinionated toast helpers for Still — composes `sonner` with the pill + chip
 * narrative pattern. Prefer these for list/media flows; keep `toast.*` for
 * one-off strings elsewhere until migrated.
 */
export const stillToast = {
	addedToCollection(
		args: StillToastAddedCopyProps & {
			duration?: number;
			id?: string | number;
		},
	) {
		const { duration, id, ...copy } = args;
		return toast.success(<StillToastAddedCopy {...copy} />, {
			...narrativeToastOptions(stillToastLeadingIcons.added, { duration, id }),
		});
	},

	alreadyInCollection(
		args: StillToastAlreadyInCopyProps & {
			duration?: number;
			id?: string | number;
		},
	) {
		const { duration, id, ...copy } = args;
		return toast.info(<StillToastAlreadyInCopy {...copy} />, {
			...narrativeToastOptions(stillToastLeadingIcons.info, { duration, id }),
		});
	},

	/** Edit / patch flows — pencil leading mark. */
	updated(message: ReactNode, options?: Parameters<typeof toast.success>[1]) {
		return toast.success(message, {
			duration: defaultDuration,
			icon: stillToastLeadingIcons.updated,
			...options,
		});
	},

	/** New diary log — plus leading mark. */
	logged(message: ReactNode, options?: Parameters<typeof toast.success>[1]) {
		return toast.success(message, {
			duration: defaultDuration,
			icon: stillToastLeadingIcons.added,
			...options,
		});
	},

	/** Plain success line — plus mark by default (added / created). */
	success(message: ReactNode, options?: Parameters<typeof toast.success>[1]) {
		return toast.success(message, {
			duration: defaultDuration,
			icon: stillToastLeadingIcons.added,
			...options,
		});
	},

	error(message: ReactNode, options?: Parameters<typeof toast.error>[1]) {
		return toast.error(message, {
			duration: defaultDuration,
			...options,
		});
	},

	info(message: ReactNode, options?: Parameters<typeof toast.info>[1]) {
		return toast.info(message, {
			duration: defaultDuration,
			...options,
		});
	},
};
