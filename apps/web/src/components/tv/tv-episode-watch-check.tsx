"use client";

import { cn } from "@still/ui/lib/utils";
import { Check } from "lucide-react";

import { DETAIL_CANVAS_ON_CARD_HOVER_CLASS } from "@/lib/detail-action-motion";

/** Full-row episode toggle — native checkbox + custom circular indicator. */
export function TvEpisodeWatchCheckRow({
	episodeNumber,
	episodeName,
	airDate,
	checked,
	disabled,
	onCheckedChange,
}: {
	episodeNumber: number;
	episodeName: string | null;
	airDate: string | null;
	checked: boolean;
	disabled?: boolean;
	onCheckedChange: (checked: boolean) => void;
}) {
	const title = episodeName
		? `Episode ${episodeNumber}: ${episodeName}`
		: `Episode ${episodeNumber}`;
	const ariaLabel = checked
		? `Mark ${title} as unwatched`
		: `Mark ${title} as watched`;

	return (
		<label
			className={cn(
				"group flex min-h-11 w-full cursor-pointer select-none items-center gap-3 rounded-xl px-2 py-2",
				"transition-[background-color] duration-200 ease-out motion-reduce:transition-none",
				DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
				disabled && "pointer-events-none opacity-50",
			)}
		>
			<input
				type="checkbox"
				className="sr-only"
				checked={checked}
				disabled={disabled}
				aria-label={ariaLabel}
				onChange={(event) => onCheckedChange(event.target.checked)}
			/>

			{/* Circular indicator — matches quote upvote / save pill language on detail. */}
			<span
				className={cn(
					"inline-flex size-10 shrink-0 items-center justify-center rounded-full transition-[transform,background-color,color] duration-200 ease-out motion-reduce:transition-none",
					"group-active:scale-[0.96] motion-reduce:group-active:scale-100",
					checked
						? "bg-foreground text-background"
						: "bg-card text-transparent",
				)}
				aria-hidden
			>
				<Check
					className={cn(
						"size-4 shrink-0 stroke-[2.5] transition-opacity duration-200 ease-out motion-reduce:transition-none",
						checked ? "opacity-100" : "opacity-0",
					)}
					aria-hidden
				/>
			</span>

			<span className="flex min-w-0 flex-1 flex-col gap-0.5">
				<span
					className={cn(
						"font-medium text-sm tabular-nums transition-colors duration-200 ease-out motion-reduce:transition-none",
						checked ? "text-muted-foreground" : "text-foreground",
					)}
				>
					E{episodeNumber}
					{episodeName ? ` · ${episodeName}` : ""}
				</span>
				{airDate ? (
					<span className="text-muted-foreground text-xs tabular-nums">
						{airDate}
					</span>
				) : null}
			</span>
		</label>
	);
}
