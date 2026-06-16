"use client";

import { cn } from "@still/ui/lib/utils";

import Link from "next/link";

import { PatronPortraitWithMetalTier } from "@/components/profile/patron-portrait-with-metal-tier";
import { DETAIL_CANVAS_ON_CARD_HOVER_CLASS } from "@/lib/detail-action-motion";
import type {
	ListingPresenceSnapshot,
	ListingPresenceViewingPatron,
} from "@/lib/fetch-listing-presence";

import {
	formatListingPresenceViewingLine,
	LISTING_PRESENCE_COMPACT_VIEWING_LABEL,
	resolveListingPresenceRowDisplay,
} from "@/lib/listing-presence-copy";

import { inferAnimatedFromProfileUrl } from "@/lib/profile-media";

/** Max overlapping avatars in the corner stack before a +N pill. */

const PRESENCE_AVATAR_STACK_MAX = 3;

const PRESENCE_AVATAR_SIZE_PX = 32;

/** Review-reader handle pill — compact corner occupancy chrome. */

const PRESENCE_PILL_CLASS =
	"inline-flex min-h-10 max-w-full items-center gap-2 rounded-full bg-background pr-3.5 pl-1 py-1.5";

type PresenceStackSlot =
	| { kind: "viewing"; patron: ListingPresenceViewingPatron }
	| { kind: "overflow"; count: number };

function buildPresenceAvatarStack(
	display: NonNullable<ReturnType<typeof resolveListingPresenceRowDisplay>>,
): PresenceStackSlot[] {
	const slots: PresenceStackSlot[] = [];

	for (const patron of display.visibleViewingPatrons) {
		if (slots.length >= PRESENCE_AVATAR_STACK_MAX) break;

		slots.push({ kind: "viewing", patron });
	}

	if (display.viewingMoreCount > 0) {
		slots.push({ kind: "overflow", count: display.viewingMoreCount });

		return slots;
	}

	if (display.unidentifiedCount > 0) {
		slots.push({ kind: "overflow", count: display.unidentifiedCount });
	}

	return slots;
}

function PresenceStackAvatar({
	slot,

	index,
}: {
	slot: PresenceStackSlot;

	index: number;
}) {
	const overlapStyle =
		index === 0
			? undefined
			: { marginLeft: -10, zIndex: PRESENCE_AVATAR_STACK_MAX - index };

	const ringClass = "ring-2 ring-background";

	if (slot.kind === "viewing") {
		const { patron } = slot;

		return (
			<Link
				href={`/profile/${patron.handle}`}
				className={cn(
					"relative block shrink-0 overflow-visible rounded-full outline-none",
					"focus-visible:ring-2 focus-visible:ring-desert-orange/55 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
					DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
				)}
				style={overlapStyle}
				aria-label={`Open @${patron.handle} profile`}
			>
				<span
					className={cn(
						"block size-8 rounded-full bg-muted",
						ringClass,
						patron.diaryMetalTier ? "overflow-visible" : "overflow-hidden",
					)}
				>
					<PatronPortraitWithMetalTier
						handle={patron.handle}
						avatarUrl={patron.image}
						name={patron.displayName || patron.handle}
						width={PRESENCE_AVATAR_SIZE_PX}
						height={PRESENCE_AVATAR_SIZE_PX}
						className="size-full rounded-full"
						showOnlineStatus
						presenceState={patron.presenceState}
						isAnimated={inferAnimatedFromProfileUrl(
							patron.image,
							patron.avatarIsAnimated,
						)}
						diaryMetalTier={patron.diaryMetalTier}
					/>
				</span>
			</Link>
		);
	}

	return (
		<span
			className={cn(
				"relative flex size-8 shrink-0 items-center justify-center rounded-full bg-muted/50 font-medium text-foreground/80 text-xs tabular-nums",

				ringClass,
			)}
			style={overlapStyle}
		>
			<span className="sr-only">{slot.count} more patrons viewing</span>

			<span aria-hidden>+{slot.count}</span>
		</span>
	);
}

/**

 * Corner occupancy pill on movie/TV detail — stacked avatars like the review reader

 * handle row, pinned to the container top-left when `layout="corner"`.

 */

export function ListingPresenceRow({
	snapshot,

	className,

	align = "start",

	layout = "corner",
	onOpenDrawer,
}: {
	snapshot: ListingPresenceSnapshot;

	className?: string;

	align?: "start" | "end";

	layout?: "corner" | "inline";

	onOpenDrawer?: () => void;
}) {
	const display = resolveListingPresenceRowDisplay(snapshot);

	if (!display) return null;

	const stack = buildPresenceAvatarStack(display);

	const occupancyLabel = formatListingPresenceViewingLine(snapshot.viewerCount);

	const countLabel = occupancyLabel;

	return (
		<section
			className={cn(
				layout === "corner"
					? "pointer-events-auto absolute top-4 left-4 z-10 w-auto"
					: cn(
							"flex w-full",

							align === "end" ? "justify-end" : "justify-start",
						),

				className,
			)}
			aria-label={
				occupancyLabel
					? `Other patrons viewing this title: ${occupancyLabel}`
					: "Other patrons viewing this title"
			}
		>
			<div className={PRESENCE_PILL_CLASS}>
				{stack.length > 0 ? (
					<div className="flex items-center pl-0.5">
						{stack.map((slot, index) => (
							<PresenceStackAvatar
								key={
									slot.kind === "viewing"
										? slot.patron.userId
										: `overflow-${slot.count}`
								}
								slot={slot}
								index={index}
							/>
						))}
					</div>
				) : null}

				{countLabel ? (
					<span className="flex shrink-0 items-baseline gap-1 pr-1 tabular-nums">
						<span className="sr-only">{countLabel}</span>
						{onOpenDrawer ? (
							<button
								type="button"
								className="inline-flex items-baseline gap-1 rounded-full px-1 py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-desert-orange/55"
								onClick={onOpenDrawer}
								aria-label="Open patrons viewing now"
							>
								<span
									aria-hidden
									className="font-semibold text-foreground text-sm leading-none"
								>
									{snapshot.viewerCount}
								</span>
								<span
									aria-hidden
									className="text-muted-foreground text-xs leading-none"
								>
									{LISTING_PRESENCE_COMPACT_VIEWING_LABEL}
								</span>
							</button>
						) : (
							<>
								<span
									aria-hidden
									className="font-semibold text-foreground text-sm leading-none"
								>
									{snapshot.viewerCount}
								</span>
								<span
									aria-hidden
									className="text-muted-foreground text-xs leading-none"
								>
									{LISTING_PRESENCE_COMPACT_VIEWING_LABEL}
								</span>
							</>
						)}
					</span>
				) : null}
			</div>
		</section>
	);
}
