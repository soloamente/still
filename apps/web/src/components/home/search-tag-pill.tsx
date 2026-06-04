"use client";

import { cn } from "@still/ui/lib/utils";
import { X } from "lucide-react";
import Image from "next/image";

import type { SearchTag } from "@/lib/search-query-tags";

function pillLabel(tag: SearchTag): string {
	if (tag.kind === "studio") return tag.name;
	if (tag.kind === "media") {
		return tag.listingKind === "movie" ? "Films" : "TV shows";
	}
	if (tag.kind === "genre") return tag.name;
	if (tag.kind === "curated") return tag.label;
	return "Lists";
}

/** Committed filter chip — canvas surface on the search dialog card, no rings. */
export function SearchTagPill({
	tag,
	onRemove,
	variant = "editable",
	density = "default",
}: {
	tag: SearchTag;
	onRemove?: () => void;
	/** Display-only chips omit the remove control (sticky pill summary). */
	variant?: "editable" | "display";
	/** Compact density fits the sticky search pill without growing its height. */
	density?: "default" | "compact";
}) {
	const label = pillLabel(tag);
	const hasLogo = tag.kind === "studio" && Boolean(tag.logoUrl);
	const editable = variant === "editable" && onRemove != null;
	const compact = density === "compact";

	return (
		<span
			className={cn(
				"inline-flex shrink-0 items-center rounded-full bg-background",
				compact ? "h-6 max-w-28 gap-1" : "h-8 max-w-[9.5rem] gap-2 py-1",
				hasLogo ? (compact ? "pl-1.5" : "pl-2.5") : compact ? "pl-2.5" : "pl-4",
				editable ? "pr-1" : compact ? "pr-2.5" : "pr-4",
			)}
		>
			{hasLogo && tag.kind === "studio" && tag.logoUrl ? (
				<Image
					src={tag.logoUrl}
					alt=""
					width={20}
					height={20}
					className={cn(
						"shrink-0 object-contain",
						compact ? "size-4" : "size-5",
					)}
					unoptimized
				/>
			) : null}
			<span
				className={cn(
					"truncate font-medium text-foreground",
					compact ? "text-[11px] leading-none" : "text-xs",
				)}
			>
				{label}
			</span>
			{editable ? (
				<button
					type="button"
					aria-label={`Remove ${label} filter`}
					className="inline-flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground [@media(hover:hover)]:hover:bg-foreground/10 [@media(hover:hover)]:hover:text-foreground"
					onClick={onRemove}
				>
					<X className="size-3.5" aria-hidden />
				</button>
			) : null}
		</span>
	);
}
