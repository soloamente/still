"use client";

import {
	RadialToolkit,
	type RadialToolkitItem,
	useRadialToolkitAnchor,
} from "@still/ui/components/radial-toolkit";
import IconHeartFilled from "@still/ui/icons/heart-filled";
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
import { useQuickLog } from "@/components/log/quick-log-sheet";
import {
	MoviePoster,
	type MoviePosterHoverEffect,
} from "@/components/movie/movie-poster";
import type { MyMovieLog } from "@/components/movie/use-movie-detail-user-state";
import { authClient } from "@/lib/auth-client";
import {
	buildListRadialItemSpecs,
	isListRadialGatedAction,
} from "@/lib/list-radial-items";
import type { MyTvLog } from "@/lib/my-tv-log";
import {
	deleteListItem,
	fetchMyLogsForMovie,
	fetchMyLogsForTv,
	patchLog,
} from "@/lib/still-api-fetch";
import { countTvLogsInScope } from "@/lib/tv-log-scope-prior";

/** Elevation shell — matches catalogue lobby tiles so radial aim stacks above neighbors. */
const LIST_DETAIL_POSTER_SHELL_CLASSNAME = cn(
	"group relative z-0 block w-full min-w-0 overflow-visible transition-[box-shadow,z-index] duration-200 ease-out",
	"motion-reduce:transition-none motion-reduce:hover:shadow-none motion-reduce:focus-within:shadow-none",
	"focus-within:z-[100] [@media(hover:hover)]:hover:z-[100]",
	"[@media(hover:hover)]:hover:shadow-[0_0_0_1px_color-mix(in_oklab,var(--card)_92%,var(--border)),0_3vh_40vh_-12vh_color-mix(in_oklab,var(--card)_94%,transparent),0_0_74vh_0_color-mix(in_oklab,var(--card)_90%,transparent),0_14vh_112vh_-24vh_color-mix(in_oklab,var(--card)_86%,transparent),0_20vh_140vh_-34vh_color-mix(in_oklab,var(--card)_80%,transparent),0_28vh_168vh_-42vh_color-mix(in_oklab,var(--card)_72%,transparent),0_0_98vw_0_color-mix(in_oklab,var(--card)_66%,transparent)]",
	"focus-within:shadow-[0_0_0_1px_color-mix(in_oklab,var(--card)_92%,var(--border)),0_3vh_40vh_-12vh_color-mix(in_oklab,var(--card)_94%,transparent),0_0_74vh_0_color-mix(in_oklab,var(--card)_90%,transparent),0_14vh_112vh_-24vh_color-mix(in_oklab,var(--card)_86%,transparent),0_20vh_140vh_-34vh_color-mix(in_oklab,var(--card)_80%,transparent),0_28vh_168vh_-42vh_color-mix(in_oklab,var(--card)_72%,transparent),0_0_98vw_0_color-mix(in_oklab,var(--card)_66%,transparent)]",
);

export type ListDetailPosterTileProps = {
	listId: string;
	itemId: string;
	systemKind?: string | null;
	viewerCanEdit: boolean;
	listingKind: "movie" | "tv";
	tmdbId: number;
	title: string;
	posterUrl: string | null;
	priority?: boolean;
	className?: string;
	frameClassName?: string;
	hoverEffect?: MoviePosterHoverEffect;
	posterCaption?: string | null;
	posterCaptionSubline?: string | null;
	linkable?: boolean;
	/** Drop row after list membership or favorites sync removes the title. */
	onMembershipRemoved?: (itemId: string) => void;
};

function detailHref(listingKind: "movie" | "tv", tmdbId: number): string {
	return listingKind === "tv" ? `/tv/${tmdbId}` : `/movies/${tmdbId}`;
}

/**
 * List-detail title tile with radial toolkit — catalogue parity plus list/favorites actions.
 */
export function ListDetailPosterTile({
	listId,
	itemId,
	systemKind = null,
	viewerCanEdit,
	listingKind,
	tmdbId,
	title,
	posterUrl,
	priority = false,
	className,
	frameClassName,
	hoverEffect = "elevation",
	posterCaption,
	posterCaptionSubline,
	linkable = true,
	onMembershipRemoved,
}: ListDetailPosterTileProps) {
	const router = useRouter();
	const { data: session } = authClient.useSession();
	const signedIn = Boolean(session?.user);
	const openQuickLog = useQuickLog((s) => s.open);

	const { open, anchor, onContextMenu, onPointerDown, onOpenChange } =
		useRadialToolkitAnchor();

	const [priorLogCount, setPriorLogCount] = useState(0);
	const [priorTvLogs, setPriorTvLogs] = useState<MyTvLog[]>([]);
	const [latestLogId, setLatestLogId] = useState<string | null>(null);
	const [latestLog, setLatestLog] = useState<MyMovieLog | MyTvLog | null>(null);
	const [liked, setLiked] = useState(false);
	const [favoriteBusy, setFavoriteBusy] = useState(false);
	const [removeBusy, setRemoveBusy] = useState(false);

	const isMovie = listingKind === "movie";
	const isFavoritesList = systemKind === "favorites";
	const href = detailHref(listingKind, tmdbId);
	const hasPriorLog = priorLogCount > 0;

	const addToList = useAddToListRadial({
		listingKind,
		tmdbId,
		title,
	});

	/** Hydrate patron diary state when the radial opens — log id powers edit + heart toggle. */
	useEffect(() => {
		if (!open || !signedIn) return;
		let cancelled = false;
		(async () => {
			const logRes = isMovie
				? await fetchMyLogsForMovie(tmdbId)
				: await fetchMyLogsForTv(tmdbId);
			if (cancelled) return;
			const logRows = Array.isArray(logRes.data) ? logRes.data : [];
			if (isMovie) {
				const movieLogs = logRows as MyMovieLog[];
				setPriorTvLogs([]);
				setPriorLogCount(movieLogs.length);
				setLatestLog(movieLogs[0] ?? null);
				setLatestLogId(movieLogs[0]?.id ?? null);
				setLiked(Boolean(movieLogs[0]?.liked));
			} else {
				const tvLogs = logRows as MyTvLog[];
				setPriorTvLogs(tvLogs);
				setPriorLogCount(countTvLogsInScope(tvLogs, { logScope: "show" }));
				setLatestLog(tvLogs[0] ?? null);
				setLatestLogId(tvLogs[0]?.id ?? null);
				setLiked(Boolean(tvLogs[0]?.liked));
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [open, signedIn, isMovie, tmdbId]);

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

	const refreshAfterMutation = useCallback(() => {
		router.refresh();
	}, [router]);

	const handleQuickLog = useCallback(() => {
		onOpenChange(false);
		const logArgs = {
			movieTitle: title,
			posterUrl: posterUrl ?? undefined,
			priorLogCount,
			rewatch: priorLogCount > 0,
			onSuccess: refreshAfterMutation,
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
		isMovie,
		onOpenChange,
		openQuickLog,
		posterUrl,
		priorLogCount,
		priorTvLogs,
		refreshAfterMutation,
		title,
		tmdbId,
	]);

	const handleEditLog = useCallback(() => {
		if (!latestLogId || !latestLog) return;
		onOpenChange(false);
		openQuickLog({
			logId: latestLogId,
			...(isMovie ? { movieId: tmdbId } : { tvId: tmdbId }),
			movieTitle: title,
			posterUrl: posterUrl ?? undefined,
			watchedAt: latestLog.watchedAt ?? undefined,
			rating: latestLog.rating,
			note: latestLog.note,
			liked: latestLog.liked,
			rewatch: latestLog.rewatch,
			...(isMovie
				? {}
				: {
						logScope: (latestLog as MyTvLog).logScope ?? "show",
						seasonNumber: (latestLog as MyTvLog).seasonNumber ?? undefined,
						episodeNumber: (latestLog as MyTvLog).episodeNumber ?? undefined,
						priorTvLogs,
					}),
			onSuccess: refreshAfterMutation,
		});
	}, [
		isMovie,
		latestLog,
		latestLogId,
		onOpenChange,
		openQuickLog,
		posterUrl,
		priorTvLogs,
		refreshAfterMutation,
		title,
		tmdbId,
	]);

	const handleToggleFavorite = useCallback(async () => {
		if (favoriteBusy || !latestLogId) {
			if (!latestLogId) toast.error("Log this title first");
			return;
		}
		const nextLiked = !liked;
		setFavoriteBusy(true);
		try {
			const result = await patchLog(latestLogId, { liked: nextLiked });
			if (!result.ok) {
				toast.error("Couldn't update favorite");
				return;
			}
			setLiked(nextLiked);
			toast.success(
				nextLiked ? "Added to favorites" : "Removed from favorites",
			);
			onOpenChange(false);
			if (!nextLiked && isFavoritesList) {
				onMembershipRemoved?.(itemId);
			}
			refreshAfterMutation();
		} catch {
			toast.error("Couldn't update favorite");
		} finally {
			setFavoriteBusy(false);
		}
	}, [
		favoriteBusy,
		isFavoritesList,
		itemId,
		latestLogId,
		liked,
		onMembershipRemoved,
		onOpenChange,
		refreshAfterMutation,
	]);

	const handleRemoveFromList = useCallback(async () => {
		if (removeBusy || isFavoritesList) return;
		setRemoveBusy(true);
		try {
			const result = await deleteListItem(
				listId,
				isMovie
					? { listingKind: "movie", tmdbId }
					: { listingKind: "tv", tmdbId },
			);
			if (!result.ok) {
				toast.error("Couldn't remove from list");
				return;
			}
			toast.success("Removed from list");
			onOpenChange(false);
			onMembershipRemoved?.(itemId);
			refreshAfterMutation();
		} catch {
			toast.error("Couldn't remove from list");
		} finally {
			setRemoveBusy(false);
		}
	}, [
		isFavoritesList,
		isMovie,
		itemId,
		listId,
		onMembershipRemoved,
		onOpenChange,
		refreshAfterMutation,
		removeBusy,
		tmdbId,
	]);

	const itemSpecs = useMemo(
		() =>
			buildListRadialItemSpecs({
				signedIn,
				listingKind,
				hasPriorLog,
				liked,
				canEditMembership: viewerCanEdit,
				isFavoritesList,
			}),
		[signedIn, listingKind, hasPriorLog, liked, viewerCanEdit, isFavoritesList],
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
			"add-to-list": () => {
				onOpenChange(false);
				void addToList.openPicker();
			},
			"toggle-favorite": () => void handleToggleFavorite(),
			"remove-from-list": () => void handleRemoveFromList(),
		};

		const icons: Record<string, ReactNode> = {
			open: <IconOpenExternalFill className="opacity-90" aria-hidden />,
			copy: <IconLinkFill className="opacity-90" aria-hidden />,
			"quick-log": hasPriorLog ? (
				<IconPlayRotateAnticlockwise className="opacity-90" aria-hidden />
			) : (
				<IconTicketFilled className="opacity-90" aria-hidden />
			),
			"edit-log": <IconPen2Fill className="opacity-90" aria-hidden />,
			"add-to-list": <IconListPlay className="opacity-90" aria-hidden />,
			"toggle-favorite": liked ? (
				<IconTrashXmarkFill className="opacity-90" aria-hidden />
			) : (
				<IconHeartFilled className="opacity-90" aria-hidden />
			),
			"remove-from-list": (
				<IconTrashXmarkFill className="opacity-90" aria-hidden />
			),
		};

		return itemSpecs.map((spec) => ({
			id: spec.id,
			label: spec.label,
			shortcut: spec.shortcut,
			variant: spec.variant,
			disabled:
				(favoriteBusy && spec.id === "toggle-favorite") ||
				(removeBusy && spec.id === "remove-from-list"),
			icon: icons[spec.id] ?? null,
			onSelect: () => {
				if (!signedIn && isListRadialGatedAction(spec.id)) {
					notifySignIn();
					onOpenChange(false);
					return;
				}
				handlers[spec.id]?.();
			},
		}));
	}, [
		addToList,
		favoriteBusy,
		handleCopyLink,
		handleEditLog,
		handleQuickLog,
		handleRemoveFromList,
		handleToggleFavorite,
		hasPriorLog,
		href,
		itemSpecs,
		liked,
		notifySignIn,
		onOpenChange,
		removeBusy,
		router,
		signedIn,
	]);

	return (
		<>
			<fieldset
				className={cn(
					LIST_DETAIL_POSTER_SHELL_CLASSNAME,
					"border-0 p-0",
					className,
				)}
				onContextMenu={onContextMenu}
				onPointerDown={onPointerDown}
			>
				<MoviePoster
					className="min-w-0"
					frameClassName={frameClassName}
					hoverEffect={hoverEffect}
					linkable={linkable}
					listingKind={listingKind}
					movieId={tmdbId}
					posterCaption={posterCaption}
					posterCaptionSubline={posterCaptionSubline}
					posterUrl={posterUrl}
					priority={priority}
					showTitle={false}
					title={title}
				/>
			</fieldset>

			<RadialToolkit
				open={open}
				anchor={anchor}
				onOpenChange={onOpenChange}
				items={radialItems}
				title={`Actions for ${title}`}
			/>

			{addToList.pickerHost}
		</>
	);
}
