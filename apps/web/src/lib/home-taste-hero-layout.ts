/**
 * Shared taste-hero band sizing — lobby trailer + nested hero tile stay aligned.
 * Heights cap with `svh` below 2k so the band never exceeds the viewport; tall
 * cinematic sizing is reserved for `min-[2000px]` only.
 */
export const HOME_TASTE_HERO_BAND_CLASSNAME =
	"w-full h-[min(42rem,60svh)] sm:h-[min(44rem,62svh)] lg:h-[min(48rem,66svh)] xl:h-[min(52rem,68svh)] min-[2000px]:h-[min(58rem,64svh)]";
/** Bottom-anchored spotlight — flush to the band floor on sub-2k desktops. */
export const HOME_TASTE_HERO_BAND_CONTENT_ALIGN_CLASSNAME = "justify-end";
export const HOME_TASTE_HERO_BAND_CONTENT_INSET_CLASSNAME =
	"pb-1 sm:pb-2 min-[2000px]:pb-3";
/** Pushes the hero block down inside the lobby card. */
export const HOME_TASTE_HERO_TOP_OFFSET_CLASSNAME =
	"sm:mt-8 lg:mt-12 min-[2000px]:mt-10";
/** Gap before the sort/venue filter row — tight on desktop per lobby feedback. */
export const HOME_TASTE_HERO_BOTTOM_GAP_CLASSNAME = "mb-2 sm:mb-6 lg:mb-8";
