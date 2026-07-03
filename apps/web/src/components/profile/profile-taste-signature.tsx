"use client";

import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@still/ui/components/popover";
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
		<Popover modal={false}>
			<PopoverTrigger
				render={
					<button
						type="button"
						className={cn(
							TASTE_CATEGORY_PILL_CLASS,
							PROFILE_HEADER_PILL_PRESS_CLASS,
							"cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
						)}
						aria-label={`${label}. Show what this means`}
					>
						{label}
					</button>
				}
			/>
			<PopoverContent
				align="start"
				side="bottom"
				sideOffset={8}
				className="w-[min(calc(100vw-2rem),19rem)] rounded-2xl border-0 bg-background p-4 shadow-mobbin-xl"
			>
				<p className="mb-2 font-medium text-[10px] text-muted-foreground uppercase tracking-[0.12em]">
					{label}
				</p>
				{description.split("\n").map((line, index) => (
					<p
						key={line}
						className={cn(
							"text-balance text-foreground/90 text-sm leading-snug",
							index > 0 && "mt-2",
						)}
					>
						{line}
					</p>
				))}
			</PopoverContent>
		</Popover>
	);
}

/**
 * Taste archetype as a left-rail pill (genre purist, eclectic, …) — tap for explainer.
 */
export function ProfileTasteCategoryPill({
	tasteSignature,
	perspective = "visitor",
}: {
	tasteSignature: TasteSignatureJson | null;
	perspective?: TastePerspective;
}) {
	if (!shouldShowTasteArchetypePill(tasteSignature)) return null;

	return (
		<TasteCategoryPill
			archetype={tasteSignature.archetype}
			perspective={perspective}
		/>
	);
}
