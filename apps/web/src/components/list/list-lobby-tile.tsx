"use client";

import IconListPlay from "@still/ui/icons/list-play";
import { cn } from "@still/ui/lib/utils";
import { Lock } from "lucide-react";
import Link from "next/link";

import { ListCoverRail } from "@/components/list/list-cover-rail";
import { DETAIL_CANVAS_ON_CARD_HOVER_CLASS } from "@/lib/detail-action-motion";
import { formatDistanceToNowStrict } from "@/lib/format";
import type { ListBoardRow } from "@/lib/list-board-row";

/**
 * List row for `/lists` lobby and profile — raised `bg-background` tile with press
 * hover (`DETAIL_CANVAS_ON_CARD_HOVER_CLASS`), not bordered list strips.
 */
export function ListLobbyTile({ list }: { list: ListBoardRow }) {
	const isSharedList = list.listRole === "collaborator";

	return (
		<Link
			href={`/lists/${list.id}`}
			className={cn(
				"flex min-h-[10.5rem] min-w-0 items-stretch overflow-hidden rounded-[1.75rem] bg-background shadow-sm transition-[transform,colors] duration-200 ease-out active:scale-[0.98] motion-reduce:transition-none",
				DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
			)}
		>
			<div className="flex w-[5.75rem] shrink-0 items-center py-4 pl-4 sm:w-[7.25rem]">
				<ListCoverRail list={list} />
			</div>

			<div className="flex min-w-0 flex-1 flex-col justify-center gap-2 py-4 pr-4 pl-3 sm:gap-2 sm:p-5 sm:pl-4">
				<div className="flex flex-wrap items-center gap-2">
					<span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-card text-desert-orange shadow-sm">
						<IconListPlay className="size-4" aria-hidden />
					</span>
					<h3 className="min-w-0 font-medium text-base text-foreground leading-snug tracking-tight">
						{list.title}
					</h3>
					{isSharedList ? (
						<span className="inline-flex shrink-0 items-center rounded-full bg-card px-2.5 py-1 font-medium text-[10px] text-muted-foreground uppercase tracking-wide shadow-sm">
							Shared
						</span>
					) : null}
					{!list.isPublic && !isSharedList ? (
						<span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-card px-2.5 py-1 font-medium text-[10px] text-muted-foreground uppercase tracking-wide shadow-sm">
							<Lock className="size-3" aria-hidden />
							Private
						</span>
					) : null}
				</div>
				<p className="text-muted-foreground text-xs tabular-nums">
					{isSharedList && list.ownerHandle ? (
						<>
							<span>@{list.ownerHandle}</span>
							<span aria-hidden> · </span>
						</>
					) : null}
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
