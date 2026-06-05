"use client";

import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@still/ui/components/tooltip";
import { cn } from "@still/ui/lib/utils";

import {
	resolveTasteHeadline,
	type TasteArchetype,
	type TastePerspective,
	type TasteSignatureJson,
	tasteArchetypeDescription,
	tasteArchetypeLabel,
} from "@/lib/sense-taste-signature";

/** Archetype pill with hover/focus tooltip — explains what the label means. */
function TasteArchetypePill({
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
			<span className="mt-2.5 inline-flex max-w-full items-center justify-center rounded-full bg-card px-2.5 py-1 font-medium text-[10px] text-muted-foreground tracking-wide">
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
							"mt-2.5 inline-flex max-w-full items-center justify-center rounded-full bg-card px-2.5 py-1 font-medium text-[10px] text-muted-foreground tracking-wide",
							"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
							"[@media(hover:hover)]:hover:text-foreground/80",
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
 * Identity core on patron profiles — labeled taste block, more prominent than volume stats.
 */
export function ProfileTasteSignature({
	tasteSignature,
	perspective = "self",
	className,
}: {
	tasteSignature: TasteSignatureJson | null;
	/** Own profile uses second person; visitors see neutral third person. */
	perspective?: TastePerspective;
	className?: string;
}) {
	const headline = resolveTasteHeadline(tasteSignature, perspective);
	const archetype = tasteSignature?.archetype;
	const confidence = tasteSignature?.confidence ?? "low";
	// Pill names the viewing lens — hide legacy scoring-only archetypes.
	const showArchetype =
		archetype != null &&
		archetype !== "forming" &&
		archetype !== "contrarian" &&
		archetype !== "generous" &&
		archetype !== "selective" &&
		archetype !== "curator" &&
		confidence !== "low";

	// Always paint the taste block — placeholder when copy is not ready yet.
	const displayHeadline =
		headline ??
		(perspective === "self"
			? "Sense is still learning your taste — log a few titles to begin."
			: "Taste map still forming — not enough logs yet.");

	return (
		<section
			aria-label="Taste signature"
			className={cn(
				// Content-sized tile — avoids a full-bleed strip under the handle.
				"mx-auto w-fit max-w-[min(100%,20rem)] rounded-2xl bg-background px-5 py-4 text-center",
				className,
			)}
		>
			<p className="font-medium text-[10px] text-muted-foreground uppercase tracking-[0.12em]">
				Taste
			</p>
			<p
				className={cn(
					"mt-2.5 text-pretty font-editorial text-[0.9375rem] leading-relaxed sm:text-base",
					confidence === "low" ? "text-foreground/75" : "text-foreground/92",
				)}
			>
				{displayHeadline}
			</p>
			{showArchetype && archetype ? (
				<TooltipProvider delay={280} closeDelay={80}>
					<TasteArchetypePill archetype={archetype} perspective={perspective} />
				</TooltipProvider>
			) : null}
		</section>
	);
}
