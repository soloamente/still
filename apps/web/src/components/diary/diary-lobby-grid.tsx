"use client";

import { cn } from "@still/ui/lib/utils";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
	Fragment,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";

import { CataloguePosterTile } from "@/components/catalogue/catalogue-poster-tile";
import { DiaryTvGroupCell } from "@/components/diary/diary-tv-group-cell";
import type { DiaryLobbyGridItem } from "@/lib/diary-lobby-grouping";
import {
	HOME_LOBBY_CATALOGUE_GRID_CLASSNAME,
	HOME_LOBBY_CATALOGUE_POSTER_FRAME_CLASSNAME,
	HOME_LOBBY_CATALOGUE_POSTER_GRID_MONOCHROME_CLASSNAME,
	HOME_LOBBY_CATALOGUE_POSTER_LINK_CLASSNAME,
} from "@/lib/home-lobby-catalogue-layout";

/** Grayscale peers for film links and TV group poster triggers. */
const DIARY_LOBBY_POSTER_GRID_MONOCHROME_CLASSNAME = cn(
	HOME_LOBBY_CATALOGUE_POSTER_GRID_MONOCHROME_CLASSNAME,
	"[&_[data-diary-group]_.poster-art]:transition-[filter] [&_[data-diary-group]_.poster-art]:duration-200 [&_[data-diary-group]_.poster-art]:ease-out motion-reduce:[&_[data-diary-group]_.poster-art]:transition-none",
	"[@media(hover:hover)]:[&:has([data-diary-poster-trigger]:hover)_[data-diary-group]:not(:hover)_.poster-art]:grayscale",
	"[&:has([data-diary-poster-trigger]:focus-visible)_[data-diary-group]:not(:focus-within)_.poster-art]:grayscale",
);

function tmdbPosterUrl(posterPath: string | null): string | null {
	if (!posterPath?.length) return null;
	if (posterPath.startsWith("http")) return posterPath;
	const fragment = posterPath.startsWith("/") ? posterPath : `/${posterPath}`;
	return `https://image.tmdb.org/t/p/w780${fragment}`;
}

/**
 * Diary lobby poster grid — films stay one tile per log; TV logs group by series with in-place expand.
 */
export function DiaryLobbyGrid({
	items,
	waveKey,
	monochromePeersOnHover,
	signedIn = false,
}: {
	items: DiaryLobbyGridItem[];
	waveKey: string;
	monochromePeersOnHover: boolean;
	signedIn?: boolean;
}) {
	const gridRef = useRef<HTMLDivElement>(null);
	const [expandedKey, setExpandedKey] = useState<string | null>(null);
	const reduceMotion = useReducedMotion();

	const handleToggleExpand = useCallback((key: string) => {
		setExpandedKey((prev) => (prev === key ? null : key));
	}, []);

	// Collapse when patron taps outside the grid.
	useEffect(() => {
		if (!expandedKey) return;
		const onPointerDown = (event: MouseEvent) => {
			const target = event.target;
			if (!(target instanceof Node)) return;
			if (gridRef.current?.contains(target)) return;
			setExpandedKey(null);
		};
		document.addEventListener("mousedown", onPointerDown);
		return () => document.removeEventListener("mousedown", onPointerDown);
	}, [expandedKey]);

	useEffect(() => {
		if (!expandedKey) return;
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") setExpandedKey(null);
		};
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, [expandedKey]);

	// Reset expand when venue/order wave changes so stale row-span does not linger.
	useEffect(() => {
		void waveKey;
		setExpandedKey(null);
	}, [waveKey]);

	const motionCells = !reduceMotion;

	const presenceChildren = useMemo(() => {
		if (!motionCells) return null;
		return items.map((item, index) => {
			const presenceKey = `${waveKey}::${item.key}`;
			const cell = renderCell(item, index, {
				expandedKey,
				onToggleExpand: handleToggleExpand,
				signedIn,
			});
			return (
				<motion.div
					key={presenceKey}
					className="min-w-0"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{
						opacity: 0,
						transition: { duration: 0.18, ease: [0.22, 1, 0.36, 1] },
					}}
					transition={{
						duration: 0.48,
						ease: [0.22, 1, 0.36, 1],
						delay: Math.min(index, 28) * 0.055,
					}}
				>
					{cell}
				</motion.div>
			);
		});
	}, [motionCells, waveKey, items, expandedKey, handleToggleExpand, signedIn]);

	return (
		<div
			ref={gridRef}
			className={cn(
				HOME_LOBBY_CATALOGUE_GRID_CLASSNAME,
				monochromePeersOnHover && DIARY_LOBBY_POSTER_GRID_MONOCHROME_CLASSNAME,
			)}
		>
			{presenceChildren ? (
				<AnimatePresence mode="popLayout">{presenceChildren}</AnimatePresence>
			) : (
				items.map((item, index) => (
					<Fragment key={item.key}>
						{renderCell(item, index, {
							expandedKey,
							onToggleExpand: handleToggleExpand,
							signedIn,
						})}
					</Fragment>
				))
			)}
		</div>
	);
}

function renderCell(
	item: DiaryLobbyGridItem,
	index: number,
	ctx: {
		expandedKey: string | null;
		onToggleExpand: (key: string) => void;
		signedIn: boolean;
	},
) {
	if (item.kind === "tvGroup") {
		return (
			<DiaryTvGroupCell
				expanded={ctx.expandedKey === item.key}
				logs={item.logs}
				onToggleExpand={() => ctx.onToggleExpand(item.key)}
				posterPath={item.posterPath}
				priority={index < 6}
				title={item.title}
				tmdbId={item.tmdbId}
			/>
		);
	}

	const listing = item.row.movie ?? item.row.tv;
	if (!listing) return null;

	const listingKind = item.row.tv != null ? "tv" : "movie";

	return (
		<div className="min-w-0">
			<CataloguePosterTile
				className={HOME_LOBBY_CATALOGUE_POSTER_LINK_CLASSNAME}
				diaryRow={item.row}
				frameClassName={HOME_LOBBY_CATALOGUE_POSTER_FRAME_CLASSNAME}
				hoverEffect="elevation"
				listingKind={listingKind}
				posterUrl={tmdbPosterUrl(listing.posterPath)}
				priority={index < 6}
				surface="diary"
				title={listing.title}
				tmdbId={listing.tmdbId}
			/>
		</div>
	);
}
