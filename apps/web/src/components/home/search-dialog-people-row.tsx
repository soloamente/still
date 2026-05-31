"use client";

import { cn } from "@still/ui/lib/utils";

import { PatronPortraitAvatar } from "@/components/profile/patron-portrait-avatar";
import type { ProfileSearchRelationship } from "@/lib/profile-search-query";

function relationshipLabel(
	relationship: ProfileSearchRelationship | undefined,
): string | null {
	if (relationship === "mutual") return "Mutual";
	if (relationship === "following") return "Following";
	return null;
}

/**
 * One patron row in the unified search dialog (results or suggestions).
 */
export function SearchDialogPeopleRow({
	handle,
	displayName,
	image,
	relationship,
	metaLine,
	onSelect,
}: {
	handle: string;
	displayName: string;
	image: string | null;
	relationship?: ProfileSearchRelationship;
	/** Secondary line under @handle — taste match stats, etc. */
	metaLine?: string | null;
	onSelect: () => void;
}) {
	const badge = relationshipLabel(relationship);

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
				<PatronPortraitAvatar
					handle={handle}
					avatarUrl={image}
					name={displayName}
					width={44}
					height={44}
					className="size-11 shrink-0 rounded-full"
				/>
				<div className="min-w-0 flex-1">
					<p className="truncate font-semibold text-foreground text-sm leading-snug">
						{displayName}
					</p>
					<p className="truncate text-muted-foreground text-xs leading-snug">
						@{handle}
						{badge ? (
							<span className="text-muted-foreground/80"> · {badge}</span>
						) : null}
					</p>
					{metaLine ? (
						<p className="truncate text-[11px] text-muted-foreground/90 tabular-nums leading-snug">
							{metaLine}
						</p>
					) : null}
				</div>
			</button>
		</li>
	);
}
