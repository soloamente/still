"use client";

import { cn } from "@still/ui/lib/utils";
import { List, Search, X } from "lucide-react";

import { SearchDialogGenreIcon } from "@/components/home/search-dialog-genre-icon";
import { SearchDialogStudioLogo } from "@/components/home/search-dialog-studio-logo";
import { searchDialogStudioHasLogo } from "@/lib/search-dialog-studio-logo";
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

function DialogTagMark({ tag }: { tag: SearchTag }) {
	if (tag.kind === "studio") {
		const hasLogo = searchDialogStudioHasLogo(tag.id, tag.logoUrl);
		if (hasLogo) {
			return (
				<SearchDialogStudioLogo
					studioId={tag.id}
					fallbackLogoUrl={tag.logoUrl}
					variant="pillTiny"
				/>
			);
		}
		return <Search className="size-5 shrink-0 opacity-80" aria-hidden />;
	}
	if (tag.kind === "genre" || tag.kind === "curated") {
		return (
			<SearchDialogGenreIcon
				name={tag.kind === "genre" ? tag.name : tag.label}
				className="size-5"
			/>
		);
	}
	if (tag.kind === "lists") {
		return <List className="size-5 shrink-0 opacity-80" aria-hidden />;
	}
	return <Search className="size-5 shrink-0 opacity-80" aria-hidden />;
}

/** Committed filter chip — inset `bg-background` on the raised dialog shell, no rings. */
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
	/** `dialog` — search-bar token row (icon + label, tap to remove). */
	density?: "default" | "compact" | "dialog";
}) {
	const label = pillLabel(tag);
	const hasLogo =
		tag.kind === "studio" && searchDialogStudioHasLogo(tag.id, tag.logoUrl);
	const editable = variant === "editable" && onRemove != null;
	const compact = density === "compact";
	const dialog = density === "dialog";

	if (dialog) {
		const isStudio = tag.kind === "studio";
		const chipClass = cn(
			"inline-flex max-w-[18rem] shrink-0 items-center rounded-full bg-background font-medium text-base text-foreground leading-none",
			// Studio marks need room for a larger logo; genre/curated get padded icon+label.
			isStudio
				? "h-10 gap-2 py-1 pr-3 pl-1.5"
				: "h-10 gap-2 py-1.5 pr-3 pl-2.5",
		);
		const inner = (
			<>
				<DialogTagMark tag={tag} />
				<span className="truncate">{label}</span>
			</>
		);
		if (editable) {
			return (
				<button
					type="button"
					aria-label={`Remove ${label} filter`}
					onClick={onRemove}
					className={chipClass}
				>
					{inner}
				</button>
			);
		}
		return <span className={chipClass}>{inner}</span>;
	}

	return (
		<span
			className={cn(
				"inline-flex shrink-0 items-center rounded-full bg-background",
				compact ? "h-6 max-w-28 gap-1" : "h-8 max-w-[9.5rem] gap-2 py-1",
				hasLogo ? (compact ? "pl-1.5" : "pl-2.5") : compact ? "pl-2.5" : "pl-4",
				editable ? "pr-1" : compact ? "pr-2.5" : "pr-4",
			)}
		>
			{hasLogo && tag.kind === "studio" ? (
				<SearchDialogStudioLogo
					studioId={tag.id}
					fallbackLogoUrl={tag.logoUrl}
					variant={compact ? "pillCompact" : "pill"}
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
