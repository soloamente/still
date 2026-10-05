"use client";

import {
	IconSearchDialogCinema,
	IconSearchDialogLists,
	IconSearchDialogMagnifier,
	IconSearchDialogTv,
	IconSearchDialogXmark,
} from "@still/ui/icons/search-dialog-glyphs";
import { cn } from "@still/ui/lib/utils";
import { type MouseEvent, type ReactNode, useState } from "react";
import { SearchDialogGenreIcon } from "@/components/home/search-dialog-genre-icon";
import { SearchDialogStudioLogo } from "@/components/home/search-dialog-studio-logo";
import { WatchlistProviderCircleLogo } from "@/components/watchlist/watchlist-provider-circle-logo";
import { searchDialogStudioHasLogo } from "@/lib/search-dialog-studio-logo";

import type { SearchTag } from "@/lib/search-query-tags";

function pillLabel(tag: SearchTag): string {
	if (tag.kind === "studio") return tag.name;
	if (tag.kind === "streaming") return tag.name;
	if (tag.kind === "media") {
		return tag.listingKind === "movie" ? "Films" : "TV shows";
	}
	if (tag.kind === "genre") return tag.name;
	if (tag.kind === "curated") return tag.label;
	return "Lists";
}

/** Outer shell padding for recent-search pills — same inset for logo-led and icon-led chips. */
export const SEARCH_DIALOG_RECENT_CHIP_SHELL_CLASS =
	"inline-flex h-10 max-w-[min(100%,20rem)] shrink-0 items-center gap-1 rounded-full py-1 pl-1.5 pr-3 text-sm font-medium leading-none";

/** Leading remove control — compact circle so label sits closer to the mark. */
export const SEARCH_DIALOG_RECENT_LEADING_CONTROL_CLASS = "size-7";

/** X affordance on hover — `bg-card` so it reads on dialog chips (`bg-background`). */
export const SEARCH_DIALOG_CHIP_REMOVE_PILL_CLASS =
	"flex size-full items-center justify-center rounded-full bg-card text-foreground";

/**
 * Leading mark (a) ↔ remove X (b) — shared by recent-search pills and dialog tag chips.
 */
export function SearchDialogChipLeadingRemoveControl({
	tag,
	iconSwapState,
	onRemove,
	fallbackLeading,
	ariaLabel,
}: {
	tag: SearchTag | null;
	iconSwapState: "a" | "b";
	onRemove: (event: MouseEvent<HTMLButtonElement>) => void;
	/** Recent rows without a structured tag use the magnifier. */
	fallbackLeading?: ReactNode;
	ariaLabel: string;
}) {
	return (
		<button
			type="button"
			aria-label={ariaLabel}
			className={cn(
				"relative inline-flex shrink-0 cursor-pointer select-none items-center justify-center overflow-visible rounded-full bg-transparent p-0 text-muted-foreground",
				SEARCH_DIALOG_RECENT_LEADING_CONTROL_CLASS,
			)}
			onClick={(event) => {
				event.stopPropagation();
				onRemove(event);
			}}
		>
			<span
				className="search-recent-chip-icon-swap t-icon-swap absolute inset-0 size-full"
				data-state={iconSwapState}
			>
				<span className="t-icon" data-icon="a">
					{tag ? (
						<SearchTagLeadingMark tag={tag} size="recent" />
					) : (
						(fallbackLeading ?? (
							<IconSearchDialogMagnifier size={20} aria-hidden />
						))
					)}
				</span>
				<span className="t-icon" data-icon="b">
					<span className={SEARCH_DIALOG_CHIP_REMOVE_PILL_CLASS}>
						<IconSearchDialogXmark size={14} aria-hidden />
					</span>
				</span>
			</span>
		</button>
	);
}

/** Studio logo size inside recent-search pills (leading + inline “in …” copy). */
export const SEARCH_DIALOG_RECENT_STUDIO_LOGO_VARIANT = "pillRecent" as const;

/** Dialog search bar: h-10 minus py-1.5 — studio/streaming marks fill the inset. */
export const SEARCH_DIALOG_TAG_LOGO_MARK_CLASS = "size-7 shrink-0";

/** Leading mark for a committed search tag (dialog bar + recent-search pills). */
export function SearchTagLeadingMark({
	tag,
	size = "default",
}: {
	tag: SearchTag;
	/** `recent` fits the circular swap control on recent-search pills. */
	size?: "default" | "recent";
}) {
	const iconClass =
		size === "recent" ? "size-5 shrink-0" : "size-5 shrink-0 opacity-80";
	if (tag.kind === "streaming") {
		const streamingLogoSrc = tag.logoUrl?.trim() || null;
		if (streamingLogoSrc) {
			return (
				<WatchlistProviderCircleLogo
					src={streamingLogoSrc}
					name={tag.name}
					className={
						size === "recent" ? "size-7" : SEARCH_DIALOG_TAG_LOGO_MARK_CLASS
					}
					providerId={tag.id}
				/>
			);
		}
		return <IconSearchDialogTv size={20} className={iconClass} />;
	}
	if (tag.kind === "studio") {
		const hasLogo = searchDialogStudioHasLogo(tag.id, tag.logoUrl, tag.name);
		if (hasLogo) {
			return (
				<SearchDialogStudioLogo
					studioId={tag.id}
					studioName={tag.name}
					fallbackLogoUrl={tag.logoUrl}
					variant={
						size === "recent"
							? SEARCH_DIALOG_RECENT_STUDIO_LOGO_VARIANT
							: "pillDialog"
					}
					className={
						size === "recent"
							? "size-full max-h-none max-w-none"
							: SEARCH_DIALOG_TAG_LOGO_MARK_CLASS
					}
				/>
			);
		}
		return <IconSearchDialogMagnifier className={iconClass} />;
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
		return <IconSearchDialogLists className={iconClass} />;
	}
	if (tag.kind === "media") {
		return tag.listingKind === "tv" ? (
			<IconSearchDialogTv size={20} className={iconClass} />
		) : (
			<IconSearchDialogCinema size={20} className={iconClass} />
		);
	}
	return <IconSearchDialogMagnifier className={iconClass} />;
}

/** Dialog search bar chip — icon swap on hover like recent-search pills. */
function SearchTagPillDialog({
	tag,
	label,
	editable,
	onRemove,
}: {
	tag: SearchTag;
	label: string;
	editable: boolean;
	onRemove?: () => void;
}) {
	const isLogoLed = tag.kind === "studio" || tag.kind === "streaming";
	const [iconSwapState, setIconSwapState] = useState<"a" | "b">("a");
	const chipClass = cn(
		"search-dialog-tag-chip inline-flex h-10 max-w-[18rem] shrink-0 items-center gap-1 rounded-full bg-background py-1.5 pr-3 font-medium text-base text-foreground leading-none",
		isLogoLed ? "pl-1.5" : "pl-2.5",
	);

	if (!editable || onRemove == null) {
		return (
			<span className={chipClass}>
				<span
					className={cn(
						"inline-flex shrink-0 items-center justify-center",
						SEARCH_DIALOG_RECENT_LEADING_CONTROL_CLASS,
					)}
				>
					<SearchTagLeadingMark tag={tag} size="recent" />
				</span>
				<span className="truncate">{label}</span>
			</span>
		);
	}

	const removeLabel = `Remove ${label} filter`;

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: hover swaps the leading remove icon on the tag pill
		<span
			className={chipClass}
			onMouseEnter={() => setIconSwapState("b")}
			onMouseLeave={() => setIconSwapState("a")}
		>
			<SearchDialogChipLeadingRemoveControl
				tag={tag}
				iconSwapState={iconSwapState}
				ariaLabel={removeLabel}
				onRemove={() => onRemove()}
			/>
			<button
				type="button"
				onClick={() => onRemove()}
				className="min-w-0 flex-1 truncate text-left text-base leading-none"
			>
				{label}
			</button>
		</span>
	);
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
		(tag.kind === "studio" &&
			searchDialogStudioHasLogo(tag.id, tag.logoUrl, tag.name)) ||
		(tag.kind === "streaming" && Boolean(tag.logoUrl));
	const editable = variant === "editable" && onRemove != null;
	const compact = density === "compact";
	const dialog = density === "dialog";

	if (dialog) {
		return (
			<SearchTagPillDialog
				tag={tag}
				label={label}
				editable={editable}
				onRemove={onRemove}
			/>
		);
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
					studioName={tag.name}
					fallbackLogoUrl={tag.logoUrl}
					variant={compact ? "pillCompact" : "pill"}
				/>
			) : hasLogo && tag.kind === "streaming" ? (
				<WatchlistProviderCircleLogo
					src={tag.logoUrl}
					name={tag.name}
					className={compact ? "size-6" : "size-7"}
					providerId={tag.id}
				/>
			) : (
				<SearchTagLeadingMark tag={tag} size="recent" />
			)}
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
					<IconSearchDialogXmark size={14} aria-hidden />
				</button>
			) : null}
		</span>
	);
}
