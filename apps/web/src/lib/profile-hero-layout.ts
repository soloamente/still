/**
 * Profile patron header — full-bleed banner media (parity with home taste hero shell).
 * Bleed matches profile lobby padding (`p-6 sm:p-8`).
 */
/** Layout band — banner region only; portrait straddles this floor. */
export const PROFILE_HERO_BAND_HEIGHT_CLASSNAME =
	"h-[min(22rem,42svh)] sm:h-[min(26rem,44svh)] lg:h-[min(30rem,46svh)]";

/** Hero band — banner crop; portrait anchors to `bottom` + straddle offset. */
export const PROFILE_HERO_BAND_CLASSNAME = `relative w-full shrink-0 ${PROFILE_HERO_BAND_HEIGHT_CLASSNAME}`;

/** Center of the PFP sits on the banner floor (half on banner, half on card). */
export const PROFILE_HERO_PORTRAIT_STRADDLE_CLASSNAME = "translate-y-1/2";

/** Document-flow reserve for the portrait lower half + pill overlay band. */
export const PROFILE_HERO_LOWER_HALF_SLOT_CLASSNAME = "relative h-14 sm:h-16";

/** Full-width flanking pills — vertically centered in the lower-half slot. */
export const PROFILE_HERO_STAT_ROW_OVERLAY_CLASSNAME =
	"pointer-events-none absolute inset-0 z-10 flex items-center justify-between gap-2 sm:gap-3";

/** Card-colored ambient shadow — soft glow around the portrait (no ring stroke). */
export const PROFILE_HERO_PORTRAIT_SHADOW_CLASSNAME =
	"pointer-events-none absolute inset-0 rounded-full shadow-[0_0_12px_8px_color-mix(in_oklab,var(--card)_78%,transparent),0_0_24px_16px_color-mix(in_oklab,var(--card)_42%,transparent)] sm:shadow-[0_0_14px_9px_color-mix(in_oklab,var(--card)_80%,transparent),0_0_28px_18px_color-mix(in_oklab,var(--card)_44%,transparent)]";

/** Media inside the band — bottom pinned to banner floor; bleeds over lobby padding. */
export const PROFILE_HERO_SHELL_MEDIA_CLASSNAME =
	"pointer-events-none absolute -top-6 -right-6 -left-6 bottom-0 z-0 overflow-hidden bg-absolute-black [transform:translateZ(0)] sm:-top-8 sm:-right-8 sm:-left-8";

/** Kill anti-alias slivers on rounded card corners. */
export const PROFILE_HERO_MEDIA_OVERSCAN_CLASSNAME = "-inset-px";

/** Long bottom ramp — darkens only the lowest strip before the banner floor. */
export const PROFILE_HERO_SCRIM_BOTTOM_VERTICAL_CLASSNAME =
	"absolute inset-0 z-2 bg-[linear-gradient(to_top,rgba(0,0,0,0.78)_0%,rgba(0,0,0,0.5)_5%,rgba(0,0,0,0.26)_10%,rgba(0,0,0,0.1)_15%,rgba(0,0,0,0.03)_20%,transparent_26%,transparent_100%)]";

export const PROFILE_HERO_SCRIM_SIDE_CLASSNAME =
	"absolute inset-0 z-2 bg-[linear-gradient(to_right,rgba(0,0,0,0.34)_0%,rgba(0,0,0,0.08)_28%,transparent_48%,transparent_52%,rgba(0,0,0,0.08)_72%,rgba(0,0,0,0.3)_100%)] [mask-image:linear-gradient(to_bottom,transparent_0%,transparent_68%,rgba(0,0,0,0.3)_80%,black_92%)]";

/** Fade media into `bg-card` at the banner floor — ramp only on the bottom edge. */
export const PROFILE_HERO_SCRIM_CARD_FADE_CLASSNAME =
	"absolute inset-0 z-3 bg-[linear-gradient(to_bottom,transparent_0%,transparent_86%,color-mix(in_oklab,var(--card)_6%,transparent)_90%,color-mix(in_oklab,var(--card)_22%,transparent)_93%,color-mix(in_oklab,var(--card)_48%,transparent)_96%,color-mix(in_oklab,var(--card)_76%,transparent)_98%,var(--card)_100%)]";
