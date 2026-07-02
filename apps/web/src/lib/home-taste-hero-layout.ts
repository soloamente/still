/**
 * Shared taste-hero band sizing — lobby trailer + nested hero tile stay aligned.
 * Fixed heights (not aspect-ratio) so the band reliably controls layout; only
 * absolute-positioned children sit inside, which breaks max-height + aspect-ratio.
 */
export const HOME_TASTE_HERO_BAND_CLASSNAME =
	"w-full h-[min(40rem,56svh)] sm:h-[42rem] lg:h-[50rem] xl:h-[58rem] 2xl:h-[64rem]";
/** Pushes the hero block down inside the lobby card on sm+ viewports. */
export const HOME_TASTE_HERO_TOP_OFFSET_CLASSNAME = "sm:mt-6 lg:mt-10";
/** Gap before the sort/venue filter row — tight on desktop per lobby feedback. */
export const HOME_TASTE_HERO_BOTTOM_GAP_CLASSNAME = "mb-2 sm:mb-6 lg:mb-8";
