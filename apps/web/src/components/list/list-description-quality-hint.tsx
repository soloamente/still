"use client";

import { cn } from "@still/ui/lib/utils";

import {
	LIST_DESCRIPTION_DISCOVERABILITY_MIN_CHARS,
	LIST_DESCRIPTION_PUBLIC_HINT,
	listHasDiscoverabilityDescription,
} from "@/lib/list-quality";

/**
 * Inline copy under list description fields — nudges public lists toward discoverability.
 */
export function ListDescriptionQualityHint({
	description,
	isPublic,
	className,
}: {
	description: string;
	isPublic: boolean;
	className?: string;
}) {
	if (!isPublic) return null;
	const ready = listHasDiscoverabilityDescription(description);
	return (
		<p
			className={cn(
				"text-balance text-center text-xs leading-relaxed",
				ready ? "text-muted-foreground" : "text-muted-foreground/90",
				className,
			)}
		>
			{ready
				? "Description looks good for Community discovery."
				: LIST_DESCRIPTION_PUBLIC_HINT}{" "}
			<span className="tabular-nums">
				({description.trim().length}/
				{LIST_DESCRIPTION_DISCOVERABILITY_MIN_CHARS})
			</span>
		</p>
	);
}
