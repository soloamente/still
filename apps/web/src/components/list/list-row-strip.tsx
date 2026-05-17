"use client";

import { Film, Lock } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { formatDistanceToNowStrict } from "@/lib/format";
import type { ListBoardRow } from "@/lib/list-board-row";

/** One list row from `GET /api/lists/*` after `coverPosterPaths` hydration (B.5.6). */
export type { ListBoardRow } from "@/lib/list-board-row";

/** Resolve a TMDb still URL from a DB path fragment (same contract as `MoviePoster`). */
function tmdbPosterSrc(path: string | null): string | null {
	if (!path?.length) return null;
	if (path.startsWith("http")) return path;
	const fragment = path.startsWith("/") ? path : `/${path}`;
	return `https://image.tmdb.org/t/p/w185${fragment}`;
}

const STRIP_MAX = 7;

/**
 * Savee-style list row: primary title + counts on the left, horizontal poster
 * “still strip” on the right (overlapping thumbs, real poster paths from API).
 */
export function ListRowStrip({ list }: { list: ListBoardRow }) {
	const paths = list.coverPosterPaths ?? list.coverMovieIds.map(() => null);
	const strip = paths.slice(0, STRIP_MAX);

	return (
		<Link
			href={`/lists/${list.id}`}
			className="group flex flex-col gap-4 border-border border-b px-4 py-4 transition-colors last:border-b-0 hover:bg-muted/25 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
		>
			<div className="min-w-0 flex-1">
				<div className="flex flex-wrap items-center gap-2">
					<h3 className="font-display font-medium text-foreground text-lg tracking-[-0.02em] sm:text-xl">
						{list.title}
					</h3>
					{!list.isPublic ? (
						<span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 font-medium text-[10px] text-muted-foreground uppercase tracking-wide">
							<Lock className="size-3" aria-hidden />
							Private
						</span>
					) : null}
				</div>
				<p className="mt-1 text-muted-foreground text-xs">
					<span className="tabular-nums">{list.itemsCount}</span>{" "}
					{list.itemsCount === 1 ? "film" : "films"}
					<span aria-hidden> · </span>
					<span className="tabular-nums">{list.likesCount}</span> likes
					<span aria-hidden> · </span>
					updated {formatDistanceToNowStrict(new Date(list.updatedAt))} ago
				</p>
				{list.description ? (
					<p className="mt-1.5 line-clamp-1 text-foreground/75 text-sm">
						{list.description}
					</p>
				) : null}
			</div>

			{/* Right rail: short posters, slight overlap — reads as a single “still stack”. */}
			<div className="relative isolate flex h-[3.25rem] shrink-0 flex-row justify-end pl-6 sm:pl-10">
				{strip.length === 0 ? (
					<div className="grid h-[3.25rem] w-11 place-items-center rounded-md border border-border border-dashed bg-muted/30">
						<Film className="size-4 text-muted-foreground" />
					</div>
				) : (
					strip.map((path, idx) => {
						const src = tmdbPosterSrc(path);
						const z = strip.length - idx;
						const movieId = list.coverMovieIds[idx];
						return (
							<div
								key={`${list.id}-m${movieId ?? "none"}`}
								className="relative aspect-[2/3] h-[3.25rem] shrink-0 overflow-hidden rounded-sm border border-border bg-card shadow-sm ring-1 ring-pure-white/10"
								style={{ marginLeft: idx === 0 ? 0 : "-0.65rem", zIndex: z }}
							>
								{src ? (
									<Image
										src={src}
										alt=""
										fill
										sizes="52px"
										className="object-cover"
									/>
								) : (
									<div className="grid size-full place-items-center bg-muted/40">
										<Film
											className="size-4 text-muted-foreground"
											aria-hidden
										/>
									</div>
								)}
							</div>
						);
					})
				)}
			</div>
		</Link>
	);
}
