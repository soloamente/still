"use client";

import {
	RadialToolkit,
	type RadialToolkitItem,
	useRadialToolkitAnchor,
} from "@still/ui/components/radial-toolkit";
import IconClockRotateClockwise from "@still/ui/icons/clock-rotate-clockwise";
import IconLinkFill from "@still/ui/icons/link-fill";
import IconListPlay from "@still/ui/icons/list-play";
import IconOpenExternalFill from "@still/ui/icons/open-external-fill";
import IconPen2Fill from "@still/ui/icons/pen-2-fill";
import IconPlayRotateAnticlockwise from "@still/ui/icons/play-rotate-anticlockwise";
import IconTicketFilled from "@still/ui/icons/ticket-filled";
import IconTrashXmarkFill from "@still/ui/icons/trash-xmark-fill";
import { cn } from "@still/ui/lib/utils";
import { useRouter } from "next/navigation";
import {
	type ReactNode,
	useCallback,
	useEffect,
	useMemo,
	useState,
} from "react";
import { toast } from "sonner";

import { useAddToListRadial } from "@/components/catalogue/use-add-to-list-radial";
import type { DiaryLogRow } from "@/components/diary/diary-entry";
import { useQuickLog } from "@/components/log/quick-log-sheet";
import {
	MoviePoster,
	type MoviePosterHoverEffect,
} from "@/components/movie/movie-poster";
import { authClient } from "@/lib/auth-client";
import {
	buildCatalogueRadialItemSpecs,
	type CatalogueRadialSurface,
	isCatalogueRadialGatedAction,
} from "@/lib/catalogue-radial-items";
import { diaryLogToQuickLogOpenPayload } from "@/lib/diary-open-log";
import type { MyTvLog } from "@/lib/my-tv-log";
import {
	deleteWatchlistItem,
	deleteWatchlistTvItem,
	fetchMyLogsForMovie,
	fetchMyLogsForTv,
	fetchWatchlistCheck,
	fetchWatchlistCheckTv,
	postWatchlistAdd,
} from "@/lib/still-api-fetch";
import { countTvLogsInScope } from "@/lib/tv-log-scope-prior";

/** Elevation shell — matches `ListLobbyPoster` so radial aim stacks above neighbors. */
function cataloguePosterShellClassName(
	hoverStacking: "catalogue" | "sheet",
): string {
	const elevationHoverZ =
		hoverStacking === "sheet"
			? "focus-within:z-[1] [@media(hover:hover)]:hover:z-[1]"
			: "focus-within:z-[100] [@media(hover:hover)]:hover:z-[100]";

	return cn(
		"group relative z-0 block w-full min-w-0 overflow-visible transition-[box-shadow,z-index] duration-200 ease-out",
		"motion-reduce:transition-none motion-reduce:hover:shadow-none motion-reduce:focus-within:shadow-none",
		elevationHoverZ,
		"[@media(hover:hover)]:hover:shadow-[0_0_0_1px_color-mix(in_oklab,var(--card)_92%,var(--border)),0_3vh_40vh_-12vh_color-mix(in_oklab,var(--card)_94%,transparent),0_0_74vh_0_color-mix(in_oklab,var(--card)_90%,transparent),0_14vh_112vh_-24vh_color-mix(in_oklab,var(--card)_86%,transparent),0_20vh_140vh_-34vh_color-mix(in_oklab,var(--card)_80%,transparent),0_28vh_168vh_-42vh_color-mix(in_oklab,var(--card)_72%,transparent),0_0_98vw_0_color-mix(in_oklab,var(--card)_66%,transparent)]",
		"focus-within:shadow-[0_0_0_1px_color-mix(in_oklab,var(--card)_92%,var(--border)),0_3vh_40vh_-12vh_color-mix(in_oklab,var(--card)_94%,transparent),0_0_74vh_0_color-mix(in_oklab,var(--card)_90%,transparent),0_14vh_112vh_-24vh_color-mix(in_oklab,var(--card)_86%,transparent),0_20vh_140vh_-34vh_color-mix(in_oklab,var(--card)_80%,transparent),0_28vh_168vh_-42vh_color-mix(in_oklab,var(--card)_72%,transparent),0_0_98vw_0_color-mix(in_oklab,var(--card)_66%,transparent)]",
	);
}

export type CataloguePosterTileProps = {
	surface: CatalogueRadialSurface;
	listingKind: "movie" | "tv";
	tmdbId: number;
	title: string;
	posterUrl: string | null;
	priority?: boolean;
	className?: string;
	frameClassName?: string;
	hoverEffect?: MoviePosterHoverEffect;
	/** Drawer grids keep hover lift under scroll scrims (`z-30`). */
	hoverStacking?: "catalogue" | "sheet";
	posterCaption?: string | null;
	posterCaptionSubline?: string | null;
	/** Diary film tile — row used for Edit log. */
	diaryRow?: DiaryLogRow;
	/** Diary TV group — latest log for Edit (first row in group). */
	diaryTvLogs?: DiaryLogRow[];
	/** Optional child instead of default `MoviePoster` (e.g. diary TV flip button face). */
	children?: ReactNode;
	onActionComplete?: () => void;
	/** Taste rails — forever-hide this suggestion and swap in a replacement. */
	onNotInterested?: (tmdbId: number) => void | Promise<void>;
};

function detailHref(listingKind: "movie" | "tv", tmdbId: number): string {
	return listingKind === "tv" ? `/tv/${tmdbId}` : `/movies/${tmdbId}`;
}

/**
 * Catalogue lobby poster with list-style radial toolkit (RMB hold → aim → release).
 * Left click on the inner poster/link is unchanged.
 */
export function CataloguePosterTile({
	surface,
	listingKind,
	tmdbId,
	title,
	posterUrl,
	priority = false,
	className,
	frameClassName,
	hoverEffect = "elevation",
	hoverStacking = "catalogue",
	posterCaption,
	posterCaptionSubline,
	diaryRow,
	diaryTvLogs,
	children,
	onActionComplete,
	onNotInterested,
}: CataloguePosterTileProps) {
	const isHomeLikeSurface =
		surface === "home" || surface === "taste-rail" || surface === "drawer";
	const router = useRouter();
	const { data: session } = authClient.useSession();
	const signedIn = Boolean(session?.user);
	const openQuickLog = useQuickLog((s) => s.open);

	const { open, anchor, onContextMenu, onPointerDown, onOpenChange } =
		useRadialToolkitAnchor();

	const [inWatchlist, setInWatchlist] = useState(false);
	const [priorLogCount, setPriorLogCount] = useState(0);
	/** TV radial quick log — full rows for scope-aware rewatch in the sheet. */
	const [priorTvLogs, setPriorTvLogs] = useState<MyTvLog[]>([]);
	const [watchlistBusy, setWatchlistBusy] = useState(false);

	const isMovie = listingKind === "movie";
	const href = detailHref(listingKind, tmdbId);

	const editRow = useMemo(() => {
		if (diaryRow) return diaryRow;
		if (diaryTvLogs?.length) return diaryTvLogs[0];
		return null;
	}, [diaryRow, diaryTvLogs]);

	const canEditLog = Boolean(editRow && (editRow.movie ?? editRow.tv));

	const addToList = useAddToListRadial({
		listingKind,
		tmdbId,
		title,
	});

	/** Home / watchlist — hydrate diary + (home only) watchlist when radial opens. */
	useEffect(() => {
		if (!open || !signedIn) return;
		if (!isHomeLikeSurface && surface !== "watchlist") return;
		let cancelled = false;
		(async () => {
			const logRes = isMovie
				? await fetchMyLogsForMovie(tmdbId)
				: await fetchMyLogsForTv(tmdbId);
			if (cancelled) return;
			const logRows = Array.isArray(logRes.data) ? logRes.data : [];
			if (isMovie) {
				setPriorTvLogs([]);
				setPriorLogCount(logRows.length);
			} else {
				const tvLogs = logRows as MyTvLog[];
				setPriorTvLogs(tvLogs);
				setPriorLogCount(countTvLogsInScope(tvLogs, { logScope: "show" }));
			}

			if (!isHomeLikeSurface) return;
			const wlRes = isMovie
				? await fetchWatchlistCheck(tmdbId)
				: await fetchWatchlistCheckTv(tmdbId);
			if (cancelled) return;
			const wlPayload = wlRes.data as { inWatchlist?: boolean } | null;
			setInWatchlist(Boolean(wlPayload?.inWatchlist));
		})();
		return () => {
			cancelled = true;
		};
	}, [open, isHomeLikeSurface, surface, signedIn, isMovie, tmdbId]);

	const notifySignIn = useCallback(() => {
		toast.error("Sign in to use this action");
	}, []);

	const handleCopyLink = useCallback(async () => {
		const url =
			typeof window !== "undefined" ? `${window.location.origin}${href}` : href;
		try {
			await navigator.clipboard.writeText(url);
			toast.success("Link copied");
			onOpenChange(false);
		} catch {
			toast.error("Couldn't copy link");
		}
	}, [href, onOpenChange]);

	/**
	 * Home catalogue is TMDB-backed — logging or watchlist toggles do not change the grid.
	 * `router.refresh()` there re-synced `seedMovies` and re-ran poster entrance stagger.
	 */
	const refreshAfterMutation = useCallback(() => {
		onActionComplete?.();
		if (isHomeLikeSurface) return;
		router.refresh();
	}, [isHomeLikeSurface, onActionComplete, router]);

	const handleQuickLog = useCallback(() => {
		onOpenChange(false);
		const onSuccess =
			isHomeLikeSurface || surface === "watchlist"
				? () => onActionComplete?.()
				: () => refreshAfterMutation();
		const logArgs = {
			movieTitle: title,
			posterUrl: posterUrl ?? undefined,
			priorLogCount,
			rewatch: priorLogCount > 0,
			onSuccess,
		};
		if (isMovie) {
			openQuickLog({ ...logArgs, movieId: tmdbId });
		} else {
			openQuickLog({
				...logArgs,
				tvId: tmdbId,
				logScope: "show",
				priorTvLogs,
			});
		}
	}, [
		isHomeLikeSurface,
		isMovie,
		onActionComplete,
		onOpenChange,
		openQuickLog,
		posterUrl,
		priorLogCount,
		priorTvLogs,
		refreshAfterMutation,
		surface,
		title,
		tmdbId,
	]);

	const handleEditLog = useCallback(() => {
		if (!editRow) return;
		onOpenChange(false);
		const payload = diaryLogToQuickLogOpenPayload(
			editRow,
			refreshAfterMutation,
		);
		if (payload) openQuickLog(payload);
	}, [editRow, onOpenChange, openQuickLog, refreshAfterMutation]);

	const toggleWatchlist = useCallback(async () => {
		if (watchlistBusy) return;
		setWatchlistBusy(true);
		try {
			if (inWatchlist) {
				const result = isMovie
					? await deleteWatchlistItem(tmdbId)
					: await deleteWatchlistTvItem(tmdbId);
				if (!result.ok) {
					toast.error("Couldn't remove from watchlist");
					return;
				}
				toast.success("Removed from watchlist");
				setInWatchlist(false);
			} else {
				const result = await postWatchlistAdd(
					isMovie ? { movieId: tmdbId } : { tvId: tmdbId },
				);
				if (!result.ok) {
					toast.error("Couldn't add to watchlist");
					return;
				}
				toast.success("Added to watchlist");
				setInWatchlist(true);
			}
			onOpenChange(false);
			if (surface !== "home") refreshAfterMutation();
		} catch {
			toast.error("Couldn't update watchlist");
		} finally {
			setWatchlistBusy(false);
		}
	}, [
		inWatchlist,
		isMovie,
		onOpenChange,
		refreshAfterMutation,
		surface,
		tmdbId,
		watchlistBusy,
	]);

	const removeFromWatchlist = useCallback(async () => {
		if (watchlistBusy) return;
		setWatchlistBusy(true);
		try {
			const result = isMovie
				? await deleteWatchlistItem(tmdbId)
				: await deleteWatchlistTvItem(tmdbId);
			if (!result.ok) {
				toast.error("Couldn't remove from watchlist");
				return;
			}
			toast.success("Removed from watchlist");
			onOpenChange(false);
			refreshAfterMutation();
		} catch {
			toast.error("Couldn't remove from watchlist");
		} finally {
			setWatchlistBusy(false);
		}
	}, [isMovie, onOpenChange, refreshAfterMutation, tmdbId, watchlistBusy]);

	const itemSpecs = useMemo(
		() =>
			buildCatalogueRadialItemSpecs({
				surface,
				listingKind,
				signedIn,
				canEditLog,
				hasPriorLog: priorLogCount > 0,
				inWatchlist,
			}),
		[surface, listingKind, signedIn, canEditLog, inWatchlist, priorLogCount],
	);

	const radialItems = useMemo((): RadialToolkitItem[] => {
		const handlers: Record<string, () => void> = {
			open: () => {
				onOpenChange(false);
				router.push(href);
			},
			copy: () => void handleCopyLink(),
			"quick-log": handleQuickLog,
			"edit-log": handleEditLog,
			watchlist: () => void toggleWatchlist(),
			"add-to-list": () => {
				onOpenChange(false);
				void addToList.openPicker();
			},
			"remove-watchlist": () => void removeFromWatchlist(),
			"not-interested": () => {
				if (!onNotInterested) return;
				onOpenChange(false);
				void onNotInterested(tmdbId);
			},
		};

		const hasPriorLog = priorLogCount > 0;
		const icons: Record<string, ReactNode> = {
			open: <IconOpenExternalFill className="opacity-90" aria-hidden />,
			copy: <IconLinkFill className="opacity-90" aria-hidden />,
			"quick-log": hasPriorLog ? (
				<IconPlayRotateAnticlockwise className="opacity-90" aria-hidden />
			) : (
				<IconTicketFilled className="opacity-90" aria-hidden />
			),
			"edit-log": <IconPen2Fill className="opacity-90" aria-hidden />,
			watchlist: inWatchlist ? (
				<IconTrashXmarkFill className="opacity-90" aria-hidden />
			) : (
				<IconClockRotateClockwise className="opacity-90" aria-hidden />
			),
			"add-to-list": <IconListPlay className="opacity-90" aria-hidden />,
			"remove-watchlist": (
				<IconTrashXmarkFill className="opacity-90" aria-hidden />
			),
			"not-interested": (
				<IconTrashXmarkFill className="opacity-90" aria-hidden />
			),
		};

		return itemSpecs.map((spec) => ({
			id: spec.id,
			label: spec.label,
			shortcut: spec.shortcut,
			variant: spec.variant,
			disabled:
				watchlistBusy &&
				(spec.id === "watchlist" || spec.id === "remove-watchlist"),
			icon: icons[spec.id] ?? null,
			onSelect: () => {
				if (!signedIn && isCatalogueRadialGatedAction(spec.id)) {
					notifySignIn();
					onOpenChange(false);
					return;
				}
				handlers[spec.id]?.();
			},
		}));
	}, [
		addToList,
		handleCopyLink,
		handleEditLog,
		handleQuickLog,
		href,
		inWatchlist,
		itemSpecs,
		priorLogCount,
		notifySignIn,
		onNotInterested,
		onOpenChange,
		removeFromWatchlist,
		router,
		signedIn,
		toggleWatchlist,
		tmdbId,
		watchlistBusy,
	]);

	return (
		<>
			{/* Radial anchor shell — same RMB contract as `ListLobbyPoster` (pointer on wrapper, not inner Link). */}
			<fieldset
				className={cn(
					cataloguePosterShellClassName(hoverStacking),
					"border-0 p-0",
					className,
				)}
				onContextMenu={onContextMenu}
				onPointerDown={onPointerDown}
			>
				{children ?? (
					<MoviePoster
						className="min-w-0"
						frameClassName={frameClassName}
						hoverEffect={hoverEffect}
						hoverStacking={hoverStacking}
						listingKind={listingKind}
						movieId={tmdbId}
						posterCaption={posterCaption}
						posterCaptionSubline={posterCaptionSubline}
						posterUrl={posterUrl}
						priority={priority}
						showTitle={false}
						title={title}
					/>
				)}
			</fieldset>

			<RadialToolkit
				open={open}
				anchor={anchor}
				onOpenChange={onOpenChange}
				items={radialItems}
				title={`Actions for ${title}`}
			/>

			{isMovie ? addToList.pickerHost : null}
		</>
	);
}
