"use client";

import { cn } from "@still/ui/lib/utils";
import type { CastCrewSearchHit } from "@/lib/cast-crew-search-query";
import { castCrewMetaLine } from "@/lib/cast-crew-search-query";

/** One TMDb person row in the unified search dialog "Cast & Crew" section. */
export function SearchDialogCastCrewRow({
	hit,
	rank,
	onSelect,
}: {
	hit: CastCrewSearchHit;
	/** 1-based popularity rank among the current results, shown left of the avatar. */
	rank: number;
	onSelect: () => void;
}) {
	const meta = castCrewMetaLine(hit);
	const initial = hit.name.trim().charAt(0).toUpperCase() || "?";
	return (
		<li>
			<button
				type="button"
				onClick={onSelect}
				className={cn(
					"flex min-h-11 w-full items-center gap-3 rounded-2xl px-2 py-2 text-left transition-colors duration-200 ease-out motion-reduce:transition-none",
					"[@media(hover:hover)]:hover:bg-background",
					"focus-visible:bg-background focus-visible:outline-none",
				)}
			>
				<span className="w-4 shrink-0 text-right font-semibold text-muted-foreground text-xs tabular-nums">
					{rank}
				</span>
				{hit.profileUrl ? (
					// biome-ignore lint/performance/noImgElement: remote TMDb host, small avatar
					<img
						src={hit.profileUrl}
						alt=""
						width={44}
						height={44}
						className="size-11 shrink-0 rounded-full object-cover"
						loading="lazy"
					/>
				) : (
					<span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted font-semibold text-muted-foreground text-sm">
						{initial}
					</span>
				)}
				<div className="min-w-0 flex-1">
					<p className="truncate font-semibold text-foreground text-sm leading-snug">
						{hit.name}
					</p>
					{meta ? (
						<p className="truncate text-muted-foreground text-xs leading-snug">
							{meta}
						</p>
					) : null}
				</div>
			</button>
		</li>
	);
}
