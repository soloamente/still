"use client";

import { cn } from "@still/ui/lib/utils";
import { LayoutGrid } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import type { ListBoardRow } from "@/lib/list-board-row";
import { resolveListCoverImageSrc } from "@/lib/list-cover-image";

function tmdbPosterSrc(path: string | null): string | null {
	if (!path?.length) return null;
	if (path.startsWith("http")) return path;
	const fragment = path.startsWith("/") ? path : `/${path}`;
	return `https://image.tmdb.org/t/p/w185${fragment}`;
}

function listThumbSrc(list: ListBoardRow): string | null {
	const custom = resolveListCoverImageSrc(
		list.id,
		list.coverImageUrl,
		list.updatedAt,
	);
	if (custom) return custom;
	const path = list.coverPosterPaths?.[0] ?? null;
	return tmdbPosterSrc(path);
}

/**
 * List rows for the search dialog when the `lists` tag is active.
 */
export function SearchDialogListResults({
	lists,
	onPick,
}: {
	lists: ListBoardRow[];
	onPick?: (listId: string) => void;
}) {
	return (
		<ul className="mt-2 space-y-1 pb-1">
			{lists.map((row) => {
				const thumb = listThumbSrc(row);
				const href = `/lists/${row.id}`;
				return (
					<li key={row.id}>
						<Link
							href={href}
							onClick={() => onPick?.(row.id)}
							className={cn(
								"flex min-h-11 w-full items-center gap-3 rounded-2xl px-2 py-2 text-left transition-colors duration-200 ease-out motion-reduce:transition-none",
								"[@media(hover:hover)]:hover:bg-background",
								"focus-visible:bg-background focus-visible:outline-none",
							)}
						>
							<div className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-background shadow-sm">
								{thumb ? (
									<Image
										src={thumb}
										alt=""
										width={44}
										height={44}
										className="size-full object-cover"
										unoptimized
									/>
								) : (
									<LayoutGrid
										className="size-5 text-muted-foreground"
										aria-hidden
									/>
								)}
							</div>
							<div className="min-w-0 flex-1">
								<p className="truncate font-semibold text-foreground text-sm leading-snug">
									{row.title}
								</p>
								<p className="truncate text-muted-foreground text-xs tabular-nums leading-snug">
									{row.itemsCount} {row.itemsCount === 1 ? "film" : "films"}
								</p>
							</div>
						</Link>
					</li>
				);
			})}
		</ul>
	);
}
