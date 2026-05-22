"use client";

import { cn } from "@still/ui/lib/utils";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useMemo } from "react";

import { ListLobbyPoster } from "@/components/list/list-lobby-poster";
import {
	HOME_LOBBY_CATALOGUE_GRID_CLASSNAME,
	HOME_LOBBY_CATALOGUE_POSTER_FRAME_CLASSNAME,
	HOME_LOBBY_CATALOGUE_POSTER_GRID_MONOCHROME_CLASSNAME,
	HOME_LOBBY_CATALOGUE_POSTER_LINK_CLASSNAME,
} from "@/lib/home-lobby-catalogue-layout";
import type { ListLobbySeed } from "@/lib/lists-lobby-order";

/**
 * `/lists` poster wall — mirrors `WatchlistLobbyCatalogue` / `PopularMoviesInfinite` static mode.
 */
export function ListsLobbyCatalogue({
	seeds,
	catalogueWaveKeyOverride,
	monochromePeersOnHover,
}: {
	seeds: ListLobbySeed[];
	catalogueWaveKeyOverride: string;
	monochromePeersOnHover: boolean;
}) {
	const reduceMotion = useReducedMotion();
	const motionPosterCells = !reduceMotion;

	const presenceChildren = useMemo(() => {
		if (!motionPosterCells) return null;
		return seeds.map((list, index) => {
			const presenceKey = `${catalogueWaveKeyOverride}::${list.id}`;
			return (
				<motion.div
					key={presenceKey}
					className="min-w-0"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{
						opacity: 0,
						transition: {
							duration: 0.18,
							ease: [0.22, 1, 0.36, 1],
						},
					}}
					transition={{
						duration: 0.48,
						ease: [0.22, 1, 0.36, 1],
						delay: Math.min(index, 28) * 0.055,
					}}
				>
					<ListLobbyPoster
						list={list}
						priority={index < 6}
						className={HOME_LOBBY_CATALOGUE_POSTER_LINK_CLASSNAME}
						frameClassName={HOME_LOBBY_CATALOGUE_POSTER_FRAME_CLASSNAME}
					/>
				</motion.div>
			);
		});
	}, [motionPosterCells, catalogueWaveKeyOverride, seeds]);

	return (
		<div
			className={cn(
				HOME_LOBBY_CATALOGUE_GRID_CLASSNAME,
				monochromePeersOnHover &&
					HOME_LOBBY_CATALOGUE_POSTER_GRID_MONOCHROME_CLASSNAME,
			)}
		>
			{presenceChildren ? (
				<AnimatePresence mode="popLayout">{presenceChildren}</AnimatePresence>
			) : (
				seeds.map((list, index) => (
					<ListLobbyPoster
						key={list.id}
						list={list}
						priority={index < 6}
						className={HOME_LOBBY_CATALOGUE_POSTER_LINK_CLASSNAME}
						frameClassName={HOME_LOBBY_CATALOGUE_POSTER_FRAME_CLASSNAME}
					/>
				))
			)}
		</div>
	);
}
