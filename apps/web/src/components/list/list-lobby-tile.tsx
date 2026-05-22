"use client";

import IconListPlay from "@still/ui/icons/list-play";
import { cn } from "@still/ui/lib/utils";
import { Film, Lock } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { DETAIL_CANVAS_ON_CARD_HOVER_CLASS } from "@/lib/detail-action-motion";
import { formatDistanceToNowStrict } from "@/lib/format";
import type { ListBoardRow } from "@/lib/list-board-row";
import { profilePosterUrlFromPath } from "@/lib/profile-filmography-map";

const STRIP_MAX = 4;

/** Narrow left rail — poster stack on `bg-background`, no divider (matches profile lists). */
const LIST_COVER_RAIL_CLASS =
	"relative h-full w-[5.25rem] shrink-0 overflow-hidden sm:w-[6rem]";

function ListCoverRail({ list }: { list: ListBoardRow }) {
	const paths = list.coverPosterPaths ?? list.coverMovieIds.map(() => null);
	const strip = paths.slice(0, STRIP_MAX);

	if (!strip.length) {
		return (
			<div className={cn(LIST_COVER_RAIL_CLASS, "grid place-items-center")}>
				<Film
					className="size-5 text-muted-foreground"
					strokeWidth={1.5}
					aria-hidden
				/>
			</div>
		);
	}

	return (
		<div className={LIST_COVER_RAIL_CLASS} aria-hidden>
			<div className="flex h-full items-stretch justify-start pl-1">
				{strip.map((path, idx) => {
					const src = profilePosterUrlFromPath(path);
					const movieId = list.coverMovieIds[idx];
					const z = strip.length - idx;
					return (
						<div
							key={`${list.id}-cover-${movieId ?? idx}`}
							className="relative h-full shrink-0 overflow-hidden rounded-2xl bg-background shadow-sm"
							style={{
								aspectRatio: "2 / 3",
								marginLeft: idx === 0 ? 0 : "-0.85rem",
								zIndex: z,
							}}
						>
							{src ? (
								<Image
									src={src}
									alt=""
									fill
									sizes="96px"
									className="object-cover"
								/>
							) : (
								<div className="grid size-full place-items-center bg-background">
									<Film className="size-4 text-muted-foreground" aria-hidden />
								</div>
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
}

/**
 * List row for `/lists` lobby and profile — raised `bg-background` tile with press
 * hover (`DETAIL_CANVAS_ON_CARD_HOVER_CLASS`), not bordered list strips.
 */
export function ListLobbyTile({ list }: { list: ListBoardRow }) {
	return (
		<Link
			href={`/lists/${list.id}`}
			className={cn(
				"flex min-h-[10.5rem] min-w-0 overflow-hidden rounded-[1.75rem] bg-background shadow-sm transition-[transform,colors] duration-200 ease-out active:scale-[0.98] motion-reduce:transition-none",
				DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
			)}
		>
			<ListCoverRail list={list} />

			<div className="flex min-w-0 flex-1 flex-col justify-center gap-2 p-4 sm:p-5">
				<div className="flex flex-wrap items-center gap-2">
					<span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-card text-desert-orange shadow-sm">
						<IconListPlay className="size-4" aria-hidden />
					</span>
					<h3 className="min-w-0 font-medium text-base text-foreground leading-snug tracking-tight">
						{list.title}
					</h3>
					{!list.isPublic ? (
						<span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-card px-2.5 py-1 font-medium text-[10px] text-muted-foreground uppercase tracking-wide shadow-sm">
							<Lock className="size-3" aria-hidden />
							Private
						</span>
					) : null}
				</div>
				<p className="text-muted-foreground text-xs tabular-nums">
					<span>{list.itemsCount}</span>{" "}
					{list.itemsCount === 1 ? "title" : "titles"}
					<span aria-hidden> · </span>
					<span>{list.likesCount}</span> likes
					<span aria-hidden> · </span>
					updated {formatDistanceToNowStrict(new Date(list.updatedAt))} ago
				</p>
				{list.description ? (
					<p className="line-clamp-3 font-editorial text-foreground/80 text-sm leading-relaxed">
						{list.description}
					</p>
				) : null}
			</div>
		</Link>
	);
}
