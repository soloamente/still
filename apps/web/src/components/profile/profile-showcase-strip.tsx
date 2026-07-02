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

import { useQuickLog } from "@/components/log/quick-log-sheet";
import { PersonCreditPortrait } from "@/components/movie/person-credit-portrait";
import { ProfileShowcaseListingPickerPopover } from "@/components/profile/profile-showcase-listing-picker-popover";
import { useReviewDetail } from "@/components/review/review-detail-sheet";
import { api } from "@/lib/api";
import {
	MAX_SHOWCASE_ITEMS,
	type ProfileShowcaseTile,
	type ShowcaseItem,
	showcaseFilledCount,
	showcaseItemKey,
	showcaseItemToTile,
	showcaseListingHref,
	showcasePosterUrl,
	tilesToShowcaseItems,
} from "@/lib/profile-showcase";
import {
	distinctShowcaseTvScopeOptions,
	type ShowcaseDiaryLogRow,
	type ShowcaseTvScopeOption,
} from "@/lib/profile-showcase-scopes";
import { fetchMyLogsForMovie, fetchMyLogsForTv } from "@/lib/still-api-fetch";
import { tmdbPosterUrlFromPath } from "@/lib/tmdb-poster-url";
import { useAvatarGroupHover } from "@/lib/use-avatar-group-hover";
import {
	HORIZONTAL_OVERFLOW_RAIL_CLASSNAME,
	useHorizontalScrollFades,
} from "@/lib/use-horizontal-scroll-fades";
import type { ListingMentionSearchHit } from "@/lib/use-listing-mention-search";

const TILE_POSTER_CLASSNAME =
	"relative w-20 shrink-0 overflow-hidden rounded-2xl outline outline-1 outline-black/10 transition-transform duration-150 active:scale-[0.96] motion-reduce:transition-none sm:w-24 dark:outline-white/10";

const TILE_ASPECT_CLASSNAME = "aspect-2/3";

function tileToKey(tile: ProfileShowcaseTile): string {
	return showcaseItemKey({
		kind: tile.kind,
		id: tile.id,
		logScope: tile.logScope ?? undefined,
		seasonNumber: tile.seasonNumber ?? undefined,
		episodeNumber: tile.episodeNumber ?? undefined,
	});
}

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
	const scopeLabel = tile.tvScopeLabel?.trim() || null;

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

	const ariaTitle =
		scopeLabel != null ? `${tile.title} · ${scopeLabel}` : tile.title;

	return (
		<li
			className="t-avatar relative flex w-20 shrink-0 flex-col gap-1.5 sm:w-24"
			onMouseEnter={onHoverEnter}
		>
			<Link
				href={href ?? "#"}
				className={cn(
					TILE_POSTER_CLASSNAME,
					TILE_ASPECT_CLASSNAME,
					"block w-full",
				)}
				aria-label={`${tile.kind === "tv" ? "TV show" : "Film"}: ${ariaTitle}`}
			>
				<ShowcasePoster title={tile.title} posterUrl={posterUrl} />
			</Link>
			{isMe ? (
				<button
					type="button"
					className="absolute -top-1 -right-1 flex size-7 items-center justify-center rounded-full bg-card text-muted-foreground transition-transform duration-150 active:scale-[0.96] motion-reduce:transition-none [@media(hover:hover)]:hover:text-foreground"
					aria-label={`Remove ${ariaTitle} from showcase`}
					disabled={saving}
					onClick={() => onRemove(tile)}
				>
					<X className="size-3" aria-hidden />
				</button>
			) : null}
			<div className="text-center">
				<p className="line-clamp-1 text-foreground text-xs">{tile.title}</p>
				{scopeLabel ? (
					<p className="line-clamp-1 text-[10px] text-muted-foreground">
						{scopeLabel}
					</p>
				) : null}
			</div>
		</li>
	);
}

/** Stable slot ids for the four owner add affordances. */
const SHOWCASE_SLOT_IDS = ["slot-a", "slot-b", "slot-c", "slot-d"] as const;

type TvScopePickState = {
	hit: ListingMentionSearchHit;
	options: ShowcaseTvScopeOption[];
};

async function fetchDiaryLogsForListing(
	hit: ListingMentionSearchHit,
): Promise<ShowcaseDiaryLogRow[]> {
	if (hit.listingKind === "movie") {
		const res = await fetchMyLogsForMovie(hit.id);
		if (!res.data || !Array.isArray(res.data)) return [];
		return res.data as ShowcaseDiaryLogRow[];
	}
	const res = await fetchMyLogsForTv(hit.id);
	if (!res.data || !Array.isArray(res.data)) return [];
	return res.data as ShowcaseDiaryLogRow[];
}

/**
 * Up to four patron-chosen film · TV · review tiles under the taste signature.
 * Films and TV must exist in the patron diary — unwatched picks open inline Quick Log.
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
	const openQuickLog = useQuickLog((s) => s.open);
	const [tiles, setTiles] = useState(itemsProp);
	const [saving, setSaving] = useState(false);
	const [tvScopePick, setTvScopePick] = useState<TvScopePickState | null>(null);

	useEffect(() => {
		setTiles(itemsProp);
	}, [itemsProp]);

	const reservedKeys = useMemo(
		() => new Set(tiles.map((tile) => tileToKey(tile))),
		[tiles],
	);

	const filled = showcaseFilledCount(tiles);
	const contentKey = tiles.map((tile) => tileToKey(tile)).join("\0");
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

	const appendShowcaseFromItem = useCallback(
		async (item: ShowcaseItem, hit: ListingMentionSearchHit) => {
			const key = showcaseItemKey(item);
			if (reservedKeys.has(key)) {
				toast.error("Already in your showcase");
				return;
			}
			if (tiles.length >= MAX_SHOWCASE_ITEMS) {
				toast.error(`You can showcase up to ${MAX_SHOWCASE_ITEMS} items`);
				return;
			}
			const nextTiles = [
				...tiles,
				showcaseItemToTile(item, {
					title: hit.title,
					posterPath: hit.poster_url,
				}),
			];
			await persistTiles(nextTiles);
		},
		[persistTiles, reservedKeys, tiles],
	);

	const openQuickLogForShowcase = useCallback(
		(hit: ListingMentionSearchHit) => {
			const posterUrl = tmdbPosterUrlFromPath(hit.poster_url, "w342");
			const onLogged = () => {
				void (async () => {
					const logs = await fetchDiaryLogsForListing(hit);
					if (hit.listingKind === "movie") {
						if (logs.length === 0) {
							toast.error("Log this title before adding it to your showcase");
							return;
						}
						await appendShowcaseFromItem({ kind: "movie", id: hit.id }, hit);
						return;
					}
					const options = distinctShowcaseTvScopeOptions(hit.id, logs);
					if (options.length === 0) {
						toast.error("Log this show before adding it to your showcase");
						return;
					}
					if (options.length === 1) {
						await appendShowcaseFromItem(
							options[0]?.item ?? { kind: "tv", id: hit.id, logScope: "show" },
							hit,
						);
						return;
					}
					setTvScopePick({ hit, options });
				})();
			};

			if (hit.listingKind === "movie") {
				openQuickLog({
					movieId: hit.id,
					movieTitle: hit.title,
					posterUrl,
					onSuccess: onLogged,
				});
				return;
			}

			openQuickLog({
				tvId: hit.id,
				movieTitle: hit.title,
				posterUrl,
				onSuccess: onLogged,
			});
		},
		[appendShowcaseFromItem, openQuickLog],
	);

	const handlePickListing = useCallback(
		async (hit: ListingMentionSearchHit) => {
			const logs = await fetchDiaryLogsForListing(hit);

			if (hit.listingKind === "movie") {
				if (logs.length === 0) {
					openQuickLogForShowcase(hit);
					return;
				}
				await appendShowcaseFromItem({ kind: "movie", id: hit.id }, hit);
				return;
			}

			const options = distinctShowcaseTvScopeOptions(hit.id, logs);
			if (options.length === 0) {
				openQuickLogForShowcase(hit);
				return;
			}
			if (options.length === 1) {
				const only = options[0];
				if (!only) return;
				await appendShowcaseFromItem(only.item, hit);
				return;
			}
			setTvScopePick({ hit, options });
		},
		[appendShowcaseFromItem, openQuickLogForShowcase],
	);

	const handlePickTvScope = useCallback(
		async (option: ShowcaseTvScopeOption) => {
			if (!tvScopePick) return;
			const { hit } = tvScopePick;
			setTvScopePick(null);
			await appendShowcaseFromItem(option.item, hit);
		},
		[appendShowcaseFromItem, tvScopePick],
	);

	const handleRemove = useCallback(
		async (tile: ProfileShowcaseTile) => {
			const key = tileToKey(tile);
			const nextTiles = tiles.filter((row) => tileToKey(row) !== key);
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

			{tvScopePick ? (
				<div
					className="fixed inset-0 z-[250] flex items-end justify-center bg-background/80 p-4 sm:items-center"
					role="dialog"
					aria-modal="true"
					aria-label="Pick diary scope for showcase"
				>
					<div className="w-full max-w-sm rounded-[1.75rem] bg-popover p-3 shadow-mobbin-xl ring-1 ring-foreground/10">
						<p className="px-2 pb-2 text-center font-medium text-muted-foreground text-xs">
							Which part of {tvScopePick.hit.title}?
						</p>
						<ul className="flex flex-col gap-1">
							{tvScopePick.options.map((option) => (
								<li key={showcaseItemKey(option.item)}>
									<button
										type="button"
										className="flex w-full items-center rounded-2xl bg-background px-4 py-3 text-left text-foreground text-sm transition-transform duration-150 active:scale-[0.98] motion-reduce:transition-none [@media(hover:hover)]:hover:bg-card"
										onClick={() => void handlePickTvScope(option)}
									>
										{option.label}
									</button>
								</li>
							))}
						</ul>
						<button
							type="button"
							className="mt-2 w-full rounded-2xl px-4 py-2 text-center text-muted-foreground text-sm"
							onClick={() => setTvScopePick(null)}
						>
							Cancel
						</button>
					</div>
				</div>
			) : null}

			<div className="relative min-w-0">
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
						"items-start justify-center gap-3 px-2 pt-3 pb-1",
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
									key={tileToKey(tile)}
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
