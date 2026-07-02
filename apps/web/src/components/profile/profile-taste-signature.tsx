"use client";

import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@still/ui/components/tooltip";
import { cn } from "@still/ui/lib/utils";

import { PROFILE_HEADER_PILL_PRESS_CLASS } from "@/components/profile/profile-stat-cell";
import {
	shouldShowTasteArchetypePill,
	type TasteArchetype,
	type TastePerspective,
	type TasteSignatureJson,
	tasteArchetypeDescription,
	tasteArchetypeLabel,
} from "@/lib/sense-taste-signature";

const TASTE_CATEGORY_PILL_CLASS =
	"inline-flex min-h-9 max-w-full items-center rounded-full bg-background px-3 py-1.5 text-sm font-medium text-foreground";

/** Compact taste category chip — matches profile stat pills under the banner. */
function TasteCategoryPill({
	archetype,
	perspective,
}: {
	archetype: TasteArchetype;
	perspective: TastePerspective;
}) {
	const label = tasteArchetypeLabel(archetype);
	const description = tasteArchetypeDescription(archetype, perspective);

	if (!description) {
		return (
			<span className={cn(TASTE_CATEGORY_PILL_CLASS, "text-muted-foreground")}>
				{label}
			</span>
		);
	}

	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<button
						type="button"
						className={cn(
							TASTE_CATEGORY_PILL_CLASS,
							PROFILE_HEADER_PILL_PRESS_CLASS,
							"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
						)}
						aria-label={`${label} — what does this mean?`}
					>
						{label}
					</button>
				}
			/>
			<TooltipContent className="w-fit max-w-[19rem] whitespace-pre-line text-balance text-center">
				{description}
			</TooltipContent>
		</Tooltip>
	);
}

/**
 * Taste archetype as a left-rail pill (genre purist, eclectic, …) — no headline block.
 */
export function ProfileTasteCategoryPill({
	tasteSignature,
	perspective = "visitor",
	className,
}: {
	tasteSignature: TasteSignatureJson | null;
	perspective?: TastePerspective;
	className?: string;
}) {
	if (!shouldShowTasteArchetypePill(tasteSignature)) return null;

	return (
		<TooltipProvider delay={280} closeDelay={80}>
			<div className={className}>
				<TasteCategoryPill
					archetype={tasteSignature.archetype}
					perspective={perspective}
				/>
			</div>
		</TooltipProvider>
	);
}
