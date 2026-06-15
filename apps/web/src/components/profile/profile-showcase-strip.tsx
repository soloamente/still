"use client";

import { cn } from "@still/ui/lib/utils";
import { Plus, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
	type RefObject,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { toast } from "sonner";

import { PersonCreditPortrait } from "@/components/movie/person-credit-portrait";
import { ProfileShowcaseListingPickerPopover } from "@/components/profile/profile-showcase-listing-picker-popover";
import { useReviewDetail } from "@/components/review/review-detail-sheet";
import { api } from "@/lib/api";
import {
	MAX_SHOWCASE_ITEMS,
	type ProfileShowcaseTile,
	showcaseFilledCount,
	showcaseItemKey,
	showcaseListingHref,
	showcasePosterUrl,
	tilesToShowcaseItems,
} from "@/lib/profile-showcase";
import { useAvatarGroupHover } from "@/lib/use-avatar-group-hover";
import {
	HORIZONTAL_OVERFLOW_RAIL_CLASSNAME,
	useHorizontalScrollFades,
} from "@/lib/use-horizontal-scroll-fades";
import type { ListingMentionSearchHit } from "@/lib/use-listing-mention-search";

const TILE_POSTER_CLASSNAME =
	"relative w-20 shrink-0 overflow-hidden rounded-2xl outline outline-1 outline-black/10 transition-transform duration-150 active:scale-[0.96] motion-reduce:transition-none sm:w-24 dark:outline-white/10";

const TILE_ASPECT_CLASSNAME = "aspect-2/3";

function ShowcasePoster({
	title,
	posterUrl,
}: {
	title: string;
	posterUrl: string | null;
}) {
	if (posterUrl) {
		return (
			<Image
				src={posterUrl}
				alt=""
				fill
				unoptimized
				sizes="(max-width: 640px) 80px, 96px"
				className="object-cover"
			/>
		);
	}
	return (
		<PersonCreditPortrait
			name={title}
			profilePath={null}
			grayscale
			sizes="96px"
			className="size-full"
		/>
	);
}

function listingHitToTile(hit: ListingMentionSearchHit): ProfileShowcaseTile {
	return {
		kind: hit.listingKind,
		id: hit.id,
		title: hit.title,
		posterPath: hit.poster_url,
		reviewHeadline: null,
	};
}

function ShowcaseTileButton({
	tile,
	isMe,
	saving,
	onOpenReview,
	onRemove,
	onHoverEnter,
}: {
	tile: ProfileShowcaseTile;
	isMe: boolean;
	saving: boolean;
	onOpenReview: (tile: ProfileShowcaseTile) => void;
	onRemove: (tile: ProfileShowcaseTile) => void;
	onHoverEnter?: () => void;
}) {
	const posterUrl = showcasePosterUrl(tile);
	const href = showcaseListingHref(tile);
	const isReview = tile.kind === "review";

	if (isReview) {
		const headline = tile.reviewHeadline?.trim() || tile.title;
		return (
			<li
				className="t-avatar relative flex w-20 shrink-0 flex-col gap-1.5 sm:w-24"
				onMouseEnter={onHoverEnter}
			>
				<button
					type="button"
					className={cn(TILE_POSTER_CLASSNAME, TILE_ASPECT_CLASSNAME, "w-full")}
					onClick={() => onOpenReview(tile)}
					aria-label={`Read review: ${headline}`}
				>
					<ShowcasePoster title={tile.title} posterUrl={posterUrl} />
				</button>
				{isMe ? (
					<button
						type="button"
						className="absolute -top-1 -right-1 flex size-7 items-center justify-center rounded-full bg-card text-muted-foreground transition-transform duration-150 active:scale-[0.96] motion-reduce:transition-none [@media(hover:hover)]:hover:text-foreground"
						aria-label={`Remove ${headline} from showcase`}
						disabled={saving}
						onClick={() => onRemove(tile)}
					>
						<X className="size-3" aria-hidden />
					</button>
				) : null}
				<p className="line-clamp-1 text-center text-foreground text-xs">
					{headline}
				</p>
			</li>
		);
	}

	return (
		<li className="t-avatar relative shrink-0" onMouseEnter={onHoverEnter}>
			<Link
				href={href ?? "#"}
				className={cn(TILE_POSTER_CLASSNAME, TILE_ASPECT_CLASSNAME, "block")}
				aria-label={`${tile.kind === "tv" ? "TV show" : "Film"}: ${tile.title}`}
			>
				<ShowcasePoster title={tile.title} posterUrl={posterUrl} />
			</Link>
			{isMe ? (
				<button
					type="button"
					className="absolute -top-1 -right-1 flex size-7 items-center justify-center rounded-full bg-card text-muted-foreground transition-transform duration-150 active:scale-[0.96] motion-reduce:transition-none [@media(hover:hover)]:hover:text-foreground"
					aria-label={`Remove ${tile.title} from showcase`}
					disabled={saving}
					onClick={() => onRemove(tile)}
				>
					<X className="size-3" aria-hidden />
				</button>
			) : null}
		</li>
	);
}

/** Stable slot ids for the four owner add affordances. */
const SHOWCASE_SLOT_IDS = ["slot-a", "slot-b", "slot-c", "slot-d"] as const;

/**
 * Up to four patron-chosen film · TV · review tiles under the taste signature.
 * Owners add films/TV via the same mention-style search popover as review composer.
 */
export function ProfileShowcaseStrip({
	handle,
	isMe,
	items: itemsProp,
	className,
}: {
	handle: string;
	isMe: boolean;
	items: ProfileShowcaseTile[];
	className?: string;
}) {
	const router = useRouter();
	const scrollRef = useRef<HTMLUListElement>(null);
	const setAvatarShifts = useAvatarGroupHover(scrollRef);
	const [tiles, setTiles] = useState(itemsProp);
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		setTiles(itemsProp);
	}, [itemsProp]);

	const reservedKeys = useMemo(
		() =>
			new Set(
				tiles.map((tile) => showcaseItemKey({ kind: tile.kind, id: tile.id })),
			),
		[tiles],
	);

	const filled = showcaseFilledCount(tiles);
	const contentKey = tiles
		.map((tile) => showcaseItemKey({ kind: tile.kind, id: tile.id }))
		.join("\0");
	const showOwnerSlots = isMe;
	const { showStartFade, showEndFade } = useHorizontalScrollFades(
		scrollRef as RefObject<HTMLDivElement | null>,
		filled > 0 || showOwnerSlots,
		`${contentKey}:${showOwnerSlots ? "owner" : "visitor"}`,
	);
	const openReviewDetail = useReviewDetail((s) => s.open);

	const persistTiles = useCallback(
		async (nextTiles: ProfileShowcaseTile[]) => {
			setSaving(true);
			try {
				const res = await api.api.profiles.me.showcase.patch({
					items: tilesToShowcaseItems(nextTiles),
				});
				if (res.error) {
					const message =
						typeof (res.error as { value?: { error?: string } }).value
							?.error === "string"
							? (res.error as { value: { error: string } }).value.error
							: "Could not update showcase";
					toast.error(message);
					return false;
				}
				setTiles(nextTiles);
				toast.success("Showcase updated");
				router.refresh();
				return true;
			} catch {
				toast.error("Could not update showcase");
				return false;
			} finally {
				setSaving(false);
			}
		},
		[router],
	);

	const handlePickListing = useCallback(
		async (hit: ListingMentionSearchHit) => {
			const key = showcaseItemKey({ kind: hit.listingKind, id: hit.id });
			if (reservedKeys.has(key)) {
				toast.error("Already in your showcase");
				return;
			}
			if (tiles.length >= MAX_SHOWCASE_ITEMS) {
				toast.error(`You can showcase up to ${MAX_SHOWCASE_ITEMS} items`);
				return;
			}
			const nextTiles = [...tiles, listingHitToTile(hit)];
			await persistTiles(nextTiles);
		},
		[persistTiles, reservedKeys, tiles],
	);

	const handleRemove = useCallback(
		async (tile: ProfileShowcaseTile) => {
			const key = showcaseItemKey({ kind: tile.kind, id: tile.id });
			const nextTiles = tiles.filter(
				(row) => showcaseItemKey({ kind: row.kind, id: row.id }) !== key,
			);
			await persistTiles(nextTiles);
		},
		[persistTiles, tiles],
	);

	// Visitors see nothing when the patron has not curated any slots.
	if (!isMe && filled === 0) return null;

	const handleOpenReview = (tile: ProfileShowcaseTile) => {
		const reviewId = String(tile.id);
		openReviewDetail({
			reviewId,
			preview: {
				id: reviewId,
				title: tile.reviewHeadline,
				body: "",
				rating: null,
				likesCount: 0,
				commentsCount: 0,
				publishedAt: new Date().toISOString(),
				author: {
					handle,
					displayName: handle,
					image: null,
				},
			},
		});
	};

	const canAddMore = tiles.length < MAX_SHOWCASE_ITEMS;

	return (
		<section
			className={cn(
				"profile-showcase-strip mx-auto w-full max-w-lg text-left",
				className,
			)}
			aria-label="Showcase"
		>
			<p className="mb-2 text-center font-medium text-[10px] text-muted-foreground uppercase tracking-[0.12em]">
				Showcase
			</p>

			<div className="relative min-w-0 overflow-hidden">
				<div
					aria-hidden
					className={cn(
						"pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-linear-to-r from-card via-card/80 to-transparent transition-opacity duration-200 motion-reduce:transition-none",
						showStartFade ? "opacity-100" : "opacity-0",
					)}
				/>
				<div
					aria-hidden
					className={cn(
						"pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-linear-to-l from-card via-card/85 to-transparent transition-opacity duration-200 motion-reduce:transition-none",
						showEndFade ? "opacity-100" : "opacity-0",
					)}
				/>
				<ul
					ref={scrollRef}
					data-lenis-prevent-wheel
					className={cn(
						"t-avatar-group",
						HORIZONTAL_OVERFLOW_RAIL_CLASSNAME,
						"items-start justify-center gap-3 px-1 pb-0.5",
					)}
				>
					{isMe
						? SHOWCASE_SLOT_IDS.map((slotId, slotIndex) => {
								const tile = tiles[slotIndex];
								if (tile) {
									return (
										<ShowcaseTileButton
											key={slotId}
											tile={tile}
											isMe
											saving={saving}
											onOpenReview={handleOpenReview}
											onRemove={handleRemove}
											onHoverEnter={() => setAvatarShifts(slotIndex, "in")}
										/>
									);
								}
								if (!canAddMore) return null;
								return (
									<li
										key={slotId}
										className="t-avatar shrink-0"
										onMouseEnter={() => setAvatarShifts(slotIndex, "in")}
									>
										<ProfileShowcaseListingPickerPopover
											trigger={
												<button
													type="button"
													className={cn(
														TILE_POSTER_CLASSNAME,
														TILE_ASPECT_CLASSNAME,
														"flex min-h-10 min-w-10 flex-col items-center justify-center gap-1 border border-muted-foreground/30 border-dashed bg-background/70 text-muted-foreground",
													)}
													aria-label="Add showcase item"
													disabled={saving}
												>
													<Plus className="size-5" aria-hidden />
													<span className="font-medium text-[9px] uppercase tracking-[0.12em]">
														Add
													</span>
												</button>
											}
											disabled={saving}
											reservedKeys={reservedKeys}
											onPick={(hit) => void handlePickListing(hit)}
										/>
									</li>
								);
							})
						: tiles.map((tile, index) => (
								<ShowcaseTileButton
									key={showcaseItemKey({ kind: tile.kind, id: tile.id })}
									tile={tile}
									isMe={false}
									saving={false}
									onOpenReview={handleOpenReview}
									onRemove={handleRemove}
									onHoverEnter={() => setAvatarShifts(index, "in")}
								/>
							))}
				</ul>
			</div>
		</section>
	);
}
