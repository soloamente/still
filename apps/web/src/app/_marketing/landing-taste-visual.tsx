import { LANDING_TASTE_SPECIMEN } from "./landing-copy";

/** Decorative taste pill — not a live signature, not interactive. */
export function LandingTasteVisual() {
	return (
		<div className="flex flex-col items-center gap-3" aria-hidden>
			<span className="inline-flex min-h-9 items-center rounded-full bg-card px-3 py-1.5 font-medium font-sans text-foreground text-sm">
				{LANDING_TASTE_SPECIMEN.pill}
			</span>
			<p className="max-w-[22ch] text-pretty text-center font-sans text-muted-foreground text-sm">
				{LANDING_TASTE_SPECIMEN.line}
			</p>
		</div>
	);
}
