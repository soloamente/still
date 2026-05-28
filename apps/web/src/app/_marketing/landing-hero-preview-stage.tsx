import {
	LANDING_HERO_PREVIEW_CARD_CLASS,
	LANDING_HERO_PREVIEW_WELL_CLASS,
	LANDING_HERO_PREVIEW_WELL_INNER_CLASS,
} from "./landing-mobbin-hero";

/**
 * Hero product preview — Mobbin gray well with a centered card and image placeholder.
 */
export function LandingHeroPreviewStage() {
	return (
		<div className={LANDING_HERO_PREVIEW_WELL_CLASS} aria-hidden>
			<div className={LANDING_HERO_PREVIEW_WELL_INNER_CLASS}>
				<div className={LANDING_HERO_PREVIEW_CARD_CLASS}>
					{/* Product screenshot / screen recording drops in here later. */}
					<div className="flex aspect-16/10 w-full items-center justify-center bg-muted/40">
						<p className="font-sans text-muted-foreground text-sm">
							Product preview
						</p>
					</div>
				</div>
			</div>
		</div>
	);
}
