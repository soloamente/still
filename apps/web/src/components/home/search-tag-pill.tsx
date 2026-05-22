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
}: {
	tag: SearchTag;
	onRemove: () => void;
}) {
	const label = pillLabel(tag);
	const hasLogo = tag.kind === "studio" && Boolean(tag.logoUrl);

	return (
		<span
			className={cn(
				"inline-flex h-8 max-w-[9.5rem] shrink-0 items-center gap-2 rounded-full bg-background py-1 pr-1",
				hasLogo ? "pl-2.5" : "pl-4",
			)}
		>
			{hasLogo && tag.kind === "studio" && tag.logoUrl ? (
				<Image
					src={tag.logoUrl}
					alt=""
					width={20}
					height={20}
					className="size-5 shrink-0 object-contain"
					unoptimized
				/>
			) : null}
			<span className="truncate font-medium text-foreground text-xs">
				{label}
			</span>
			<button
				type="button"
				aria-label={`Remove ${label} filter`}
				className="inline-flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground [@media(hover:hover)]:hover:bg-foreground/10 [@media(hover:hover)]:hover:text-foreground"
				onClick={onRemove}
			>
				<X className="size-3.5" aria-hidden />
			</button>
		</span>
	);
}
